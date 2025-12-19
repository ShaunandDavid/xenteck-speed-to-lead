/**
 * STATS API
 * =========
 * Returns speed-to-lead metrics for dashboard.
 * 
 * Metrics:
 * - SFT (Speed-to-First-Touch) p50/p95/p99
 * - Total leads today
 * - Target hit rate (% under 5s)
 * - Recent leads with latencies
 */

import { Redis } from '@upstash/redis'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const redis = Redis.fromEnv()
    
    // Get recent leads (last 100)
    const leadKeys = await redis.keys('lead:*')
    const recentKeys = leadKeys.slice(0, 100)
    
    const leads = await Promise.all(
      recentKeys.map(async (key) => {
        const data = await redis.hgetall(key) as Record<string, string>
        return data
      })
    )
    
    // Filter to today's leads
    const today = new Date().toISOString().split('T')[0]
    const todayLeads = leads.filter(lead => 
      lead.created_at?.startsWith(today)
    )
    
    // Calculate latency metrics
    const latencies = todayLeads
      .map(lead => parseInt(lead.total_latency_ms || '0'))
      .filter(l => l > 0)
      .sort((a, b) => a - b)
    
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0
    
    // Target hit rate
    const under5s = latencies.filter(l => l < 5000).length
    const hitRate = latencies.length > 0 
      ? ((under5s / latencies.length) * 100).toFixed(1)
      : '0'
    
    // Get SMS and Email history counts
    const smsCount = await redis.llen('sms:history')
    const emailCount = await redis.llen('email:history')
    
    return Response.json({
      date: today,
      total_leads_today: todayLeads.length,
      total_leads_all_time: leads.length,
      latency_metrics: {
        p50_ms: p50,
        p95_ms: p95,
        p99_ms: p99,
        samples: latencies.length
      },
      target_5s: {
        hit_rate_percent: hitRate,
        under_5s: under5s,
        over_5s: latencies.length - under5s
      },
      actions: {
        sms_sent: smsCount,
        emails_sent: emailCount
      },
      recent_leads: todayLeads.slice(0, 10).map(lead => ({
        id: lead.id,
        name: lead.name,
        source: lead.source,
        total_latency_ms: lead.total_latency_ms,
        target_met: lead.target_5s_met,
        status: lead.status,
        created_at: lead.created_at
      }))
    })
    
  } catch (error) {
    console.error('Stats error:', error)
    return Response.json(
      { error: 'Failed to get stats' },
      { status: 500 }
    )
  }
}
