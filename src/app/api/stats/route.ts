import { Redis } from '@upstash/redis'

export async function GET() {
  try {
    const redis = Redis.fromEnv()
    const leadKeys = await redis.keys('lead:*')
    const recentKeys = leadKeys.slice(0, 100)
    
    const leads = await Promise.all(
      recentKeys.map(async (key) => {
        const data = await redis.hgetall(key) as Record<string, string>
        return data
      })
    )
    
    const today = new Date().toISOString().split('T')[0]
    const todayLeads = leads.filter(lead => lead.created_at?.startsWith(today))
    
    const latencies = todayLeads
      .map(lead => parseInt(lead.total_latency_ms || '0'))
      .filter(l => l > 0)
      .sort((a, b) => a - b)
    
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0
    
    const under5s = latencies.filter(l => l < 5000).length
    const hitRate = latencies.length > 0 ? ((under5s / latencies.length) * 100).toFixed(1) : '0'
    
    return Response.json({
      date: today,
      total_leads_today: todayLeads.length,
      total_leads_all_time: leads.length,
      latency_metrics: { p50_ms: p50, p95_ms: p95, p99_ms: p99, samples: latencies.length },
      target_5s: { hit_rate_percent: hitRate, under_5s: under5s, over_5s: latencies.length - under5s },
      recent_leads: todayLeads.slice(0, 10).map(lead => ({
        id: lead.id,
        name: lead.name,
        source: lead.source,
        total_latency_ms: lead.total_latency_ms,
        target_met: lead.target_5s_met,
        status: lead.status
      }))
    })
  } catch (error) {
    return Response.json({ error: 'Failed to get stats' }, { status: 500 })
  }
}