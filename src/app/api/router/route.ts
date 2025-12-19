import { Redis } from '@upstash/redis'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const t0 = Date.now()
  
  try {
    const { leadId, t0: captureTime } = await req.json()
    
    if (!leadId) {
      return Response.json({ error: 'Missing leadId' }, { status: 400 })
    }
    
    const redis = Redis.fromEnv()
    const lead = await redis.hgetall(`lead:${leadId}`) as Record<string, string>
    
    if (!lead || !lead.id) {
      return Response.json({ error: 'Lead not found' }, { status: 404 })
    }
    
    const dedupeWindow = parseInt(process.env.DEDUPE_WINDOW_SECONDS || '300')
    const dedupeKey = lead.phone ? `dedupe:phone:${lead.phone}` : `dedupe:email:${lead.email}`
    
    const recentContact = await redis.get(dedupeKey)
    if (recentContact) {
      await redis.hset(`lead:${leadId}`, { status: 'dedupe_blocked' })
      return Response.json({ status: 'blocked', reason: 'recent_contact' })
    }
    
    await redis.setex(dedupeKey, dedupeWindow, leadId)
    await redis.hset(`lead:${leadId}`, { status: 'routing', t1_routing_start: Date.now() })
    
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}`
    
    const actions = []
    
    if (lead.phone) {
      actions.push(
        fetch(`${baseUrl}/api/sms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId, lead })
        }).catch(err => ({ error: 'sms_failed' }))
      )
    }
    
    if (lead.email) {
      actions.push(
        fetch(`${baseUrl}/api/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId, lead })
        }).catch(err => ({ error: 'email_failed' }))
      )
    }
    
    await Promise.allSettled(actions)
    
    const routerLatency = Date.now() - t0
    const totalLatency = Date.now() - captureTime
    const targetMet = totalLatency < 5000 ? 'YES' : 'NO'
    
    await redis.hset(`lead:${leadId}`, { 
      status: 'routed',
      t2_routed: Date.now(),
      router_latency_ms: routerLatency,
      total_latency_ms: totalLatency,
      target_5s_met: targetMet
    })
    
    return Response.json({ 
      status: 'routed',
      leadId,
      router_latency_ms: routerLatency,
      total_latency_ms: totalLatency,
      target_5s_met: targetMet
    })
    
  } catch (error) {
    return Response.json({ error: 'Router failed' }, { status: 500 })
  }
}