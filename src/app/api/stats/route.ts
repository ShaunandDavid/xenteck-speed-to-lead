/**
 * STATS API
 * =========
 * Returns speed-to-lead metrics for dashboard.
 */

import { Redis } from '@upstash/redis'

// Force dynamic - no caching
export const dynamic = 'force-dynamic'
export const revalidate = 0

const RANGE_DAYS = 7
const RECENT_LEAD_LIMIT = 20
const SUCCESS_STATUSES = new Set(['sent', 'accepted'])
const FAILURE_STATUSES = new Set(['failed', 'bounced'])

function normalizeStatus(value?: string): string {
  return (value || '').trim().toLowerCase()
}

function parseLatency(value?: string): number | null {
  const latency = Number(value)
  return Number.isFinite(latency) && latency > 0 ? latency : null
}

function getChannel(lead: Record<string, string>): 'Email' | 'SMS' | 'Both' {
  const hasEmail = Boolean(lead.email)
  const hasSms = Boolean(lead.phone)
  if (hasEmail && hasSms) return 'Both'
  if (hasSms) return 'SMS'
  return 'Email'
}

function getDeliveryStatus(lead: Record<string, string>): 'Sent' | 'Accepted' | 'Failed' | 'Bounced' {
  if (lead.status === 'booked') return 'Accepted'

  const smsStatus = normalizeStatus(lead.sms_status)
  const emailStatus = normalizeStatus(lead.email_status)
  const hasSuccess =
    SUCCESS_STATUSES.has(smsStatus) ||
    SUCCESS_STATUSES.has(emailStatus) ||
    parseLatency(lead.first_touch_latency_ms) !== null
  const hasBounce = smsStatus === 'bounced' || emailStatus === 'bounced'
  const hasFailure = FAILURE_STATUSES.has(smsStatus) || FAILURE_STATUSES.has(emailStatus)

  if (hasSuccess) return 'Sent'
  if (hasBounce) return 'Bounced'
  if (hasFailure) return 'Failed'
  return 'Failed'
}

function getFallback(lead: Record<string, string>): 'Y' | 'N' {
  const smsStatus = normalizeStatus(lead.sms_status)
  const emailStatus = normalizeStatus(lead.email_status)
  const smsSuccess = SUCCESS_STATUSES.has(smsStatus)
  const emailSuccess = SUCCESS_STATUSES.has(emailStatus)
  const smsFailure = FAILURE_STATUSES.has(smsStatus)
  const emailFailure = FAILURE_STATUSES.has(emailStatus)

  return smsFailure && emailSuccess || emailFailure && smsSuccess ? 'Y' : 'N'
}

function getLatencyMs(lead: Record<string, string>): number | null {
  return parseLatency(lead.first_touch_latency_ms)
}

export async function GET() {
  try {
    const redis = Redis.fromEnv()
    const now = new Date()
    const dayKeys = Array.from({ length: RANGE_DAYS }, (_, offset) => {
      const day = new Date(now)
      day.setDate(now.getDate() - offset)
      return day.toISOString().split('T')[0]
    })

    const leadIdsByDay = await Promise.all(
      dayKeys.map((dayKey) => redis.zrange(`leads:${dayKey}`, 0, -1))
    )
    const leadIds7d = leadIdsByDay.flat().filter(Boolean) as string[]
    const leads7d = await Promise.all(
      leadIds7d.map(async (leadId) => {
        const data = await redis.hgetall(`lead:${leadId}`)
        return data as Record<string, string> | null
      })
    )
    const validLeads7d = leads7d.filter(lead => lead && lead.id) as Record<string, string>[]

    const latencies = validLeads7d
      .map(getLatencyMs)
      .filter((latency): latency is number => typeof latency === 'number')
      .sort((a, b) => a - b)

    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0
    const fastest = latencies[0] || 0
    const under5s = latencies.filter(latency => latency < 5000).length
    const under5sRate = latencies.length > 0
      ? ((under5s / latencies.length) * 100).toFixed(1)
      : '0'

    const deliveryTotals = validLeads7d.reduce(
      (acc, lead) => {
        const smsStatus = normalizeStatus(lead.sms_status)
        const emailStatus = normalizeStatus(lead.email_status)
        const hasSuccess =
          SUCCESS_STATUSES.has(smsStatus) ||
          SUCCESS_STATUSES.has(emailStatus) ||
          parseLatency(lead.first_touch_latency_ms) !== null
        const hasFailure = FAILURE_STATUSES.has(smsStatus) || FAILURE_STATUSES.has(emailStatus)

        if (hasSuccess || hasFailure) {
          acc.samples += 1
          if (hasSuccess) acc.success += 1
        }

        return acc
      },
      { samples: 0, success: 0 }
    )

    const deliverySuccessRate = deliveryTotals.samples > 0
      ? ((deliveryTotals.success / deliveryTotals.samples) * 100).toFixed(1)
      : '0'

    const recentLeadIds = await redis.zrange('leads:all', 0, RECENT_LEAD_LIMIT - 1, { rev: true }) as string[]
    const recentLeads = await Promise.all(
      recentLeadIds.map(async (leadId) => {
        const data = await redis.hgetall(`lead:${leadId}`)
        return data as Record<string, string> | null
      })
    )
    const validRecentLeads = recentLeads.filter(lead => lead && lead.id) as Record<string, string>[]

    const responseData = {
      range_days: RANGE_DAYS,
      leads_tracked: leadIds7d.length,
      time_to_booking_p95_ms: p95,
      fastest_time_ms: fastest,
      under_5s_rate_percent: under5sRate,
      delivery_success_rate_percent: deliverySuccessRate,
      recent_leads: validRecentLeads.map(lead => ({
        id: lead.id,
        submitted_at: lead.created_at,
        channel: getChannel(lead),
        latency_ms: getLatencyMs(lead),
        status: getDeliveryStatus(lead),
        fallback: getFallback(lead)
      }))
    }

    return new Response(JSON.stringify(responseData), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })

  } catch (error) {
    console.error('Stats error:', error)
    return new Response(JSON.stringify({ error: 'Failed to get stats' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    })
  }
}
