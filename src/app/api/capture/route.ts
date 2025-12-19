/**
 * EDGE CAPTURE API
 * ================
 * Entry point for all leads. Runs on Vercel Edge for minimum latency.
 * Target: p95 < 150ms, p99 < 300ms
 */

import { Redis } from '@upstash/redis'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  const t0 = Date.now()

  try {
    const body = await req.json()
    const { name, email, phone, source, headache, website } = body

    if (!email && !phone) {
      return Response.json(
        { error: 'Missing required fields: need email or phone' },
        { status: 400 }
      )
    }

    const timestamp = Date.now()
    const phoneSlug = phone ? phone.replace(/\D/g, '').slice(-4) : 'noph'
    const leadId = `lead_${timestamp}_${phoneSlug}`

    const redis = Redis.fromEnv()
    const today = new Date().toISOString().split('T')[0]

    const leadData = {
      id: leadId,
      name: name || '',
      email: email || '',
      phone: phone || '',
      source: source || 'direct',
      headache: headache || '',
      website: website || '',
      t0_received: t0,
      status: 'received',
      created_at: new Date().toISOString()
    }

    // Store lead data and track in sorted sets
    await redis.hset(`lead:${leadId}`, leadData)
    await redis.zadd('leads:all', { score: timestamp, member: leadId })
    await redis.zadd(`leads:${today}`, { score: timestamp, member: leadId })

    // Fire hot router (non-blocking)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}`

    fetch(`${baseUrl}/api/router`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, t0 })
    }).catch(err => console.error('Router fire failed:', err))

    const captureLatency = Date.now() - t0

    return Response.json({
      status: 'received',
      leadId,
      capture_latency_ms: captureLatency,
      timestamp: new Date().toISOString(),
      message: `Lead captured in ${captureLatency}ms - response incoming`
    })

  } catch (error) {
    const errorLatency = Date.now() - t0
    console.error('Capture error:', error)
    return Response.json(
      { error: 'Capture failed', latency_ms: errorLatency },
      { status: 500 }
    )
  }
}

export async function GET() {
  const redis = Redis.fromEnv()
  const today = new Date().toISOString().split('T')[0]

  const allCount = await redis.zcard('leads:all')
  const todayCount = await redis.zcard(`leads:${today}`)
  const allMembers = await redis.zrange('leads:all', 0, -1)

  return Response.json({
    status: 'debug',
    leads_all_count: allCount,
    leads_today_count: todayCount,
    leads_all_members: allMembers,
    today_key: `leads:${today}`,
    env_check: {
      has_url: !!process.env.UPSTASH_REDIS_REST_URL,
      has_token: !!process.env.UPSTASH_REDIS_REST_TOKEN
    }
  })
}
