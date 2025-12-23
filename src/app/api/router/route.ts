/**
 * HOT ROUTER
 * ==========
 * Processes leads and dispatches actions in parallel.
 * 
 * Target: p95 < 200ms, p99 < 500ms
 * 
 * This endpoint:
 * 1. Gets lead data from ledger
 * 2. Checks dedupe (recent contact within 5 min window)
 * 3. Checks compliance (opt-out, DNC, quiet hours)
 * 4. Fires SMS + Email in PARALLEL
 * 5. Updates lead status
 */

import { Redis } from '@upstash/redis'
import { NextRequest } from 'next/server'

type ActionResult = {
  channel: 'sms' | 'email'
  ok: boolean
  completed_at: number
  error?: string
}

export async function POST(req: NextRequest) {
  const t0 = Date.now()
  
  try {
    const { leadId, t0: captureTime } = await req.json()
    
    if (!leadId) {
      return Response.json({ error: 'Missing leadId' }, { status: 400 })
    }
    
    const redis = Redis.fromEnv()
    
    // 1. Get lead data from ledger
    const lead = await redis.hgetall(`lead:${leadId}`) as Record<string, string>
    
    if (!lead || !lead.id) {
      return Response.json({ error: 'Lead not found' }, { status: 404 })
    }
    
    // 2. Dedupe check - prevent double-contact within window
    const dedupeWindow = parseInt(process.env.DEDUPE_WINDOW_SECONDS || '300')
    const dedupeKey = lead.phone ? `dedupe:phone:${lead.phone}` : `dedupe:email:${lead.email}`
    
    const recentContact = await redis.get(dedupeKey)
    if (recentContact) {
      await redis.hset(`lead:${leadId}`, { 
        status: 'dedupe_blocked',
        blocked_reason: 'recent_contact',
        blocked_by_lead: recentContact
      })
      
      return Response.json({ 
        status: 'blocked', 
        reason: 'recent_contact',
        existing_lead: recentContact
      })
    }
    
    // 3. Set dedupe lock
    await redis.setex(dedupeKey, dedupeWindow, leadId)
    
    // 4. Check compliance (opt-out, DNC, quiet hours)
    // TODO: Implement opt-out check against DNC list
    // TODO: Implement quiet hours check based on lead timezone
    
    // 5. Update status to routing
    await redis.hset(`lead:${leadId}`, { 
      status: 'routing',
      t1_routing_start: Date.now()
    })
    
    // 6. Fire parallel actions (SMS + Email)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}`
    
    const actions: Array<Promise<ActionResult>> = []
    
    // Fire SMS if phone exists
    if (lead.phone) {
      actions.push(
        fetch(`${baseUrl}/api/sms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId, lead })
        })
          .then(async (res) => {
            const completedAt = Date.now()
            if (!res.ok) {
              const errorText = await res.text().catch(() => '')
              return {
                channel: 'sms',
                ok: false,
                completed_at: completedAt,
                error: errorText || `HTTP ${res.status}`
              }
            }
            return { channel: 'sms', ok: true, completed_at: completedAt }
          })
          .catch(err => ({
            channel: 'sms',
            ok: false,
            completed_at: Date.now(),
            error: err?.message || 'sms_failed'
          }))
      )
    }
    
    // Fire Email if email exists
    if (lead.email) {
      actions.push(
        fetch(`${baseUrl}/api/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId, lead })
        })
          .then(async (res) => {
            const completedAt = Date.now()
            if (!res.ok) {
              const errorText = await res.text().catch(() => '')
              return {
                channel: 'email',
                ok: false,
                completed_at: completedAt,
                error: errorText || `HTTP ${res.status}`
              }
            }
            return { channel: 'email', ok: true, completed_at: completedAt }
          })
          .catch(err => ({
            channel: 'email',
            ok: false,
            completed_at: Date.now(),
            error: err?.message || 'email_failed'
          }))
      )
    }
    
    // Wait for all actions to complete
    const results = await Promise.all(actions)
    
    // 7. Calculate latencies
    const routerLatency = Date.now() - t0
    const totalLatency = Date.now() - captureTime
    const firstTouchAt = results
      .filter(result => result.ok)
      .map(result => result.completed_at)
      .sort((a, b) => a - b)[0]
    const firstTouchLatency = firstTouchAt ? firstTouchAt - captureTime : null
    const targetMet = firstTouchLatency !== null && firstTouchLatency < 5000 ? 'YES' : 'NO'
    
    // 8. Update lead status with final metrics
    const leadUpdate: Record<string, string | number> = { 
      status: 'routed',
      t2_routed: Date.now(),
      router_latency_ms: routerLatency,
      total_latency_ms: totalLatency,
      target_5s_met: targetMet,
      actions_dispatched: actions.length
    }

    if (firstTouchLatency !== null) {
      leadUpdate.first_touch_latency_ms = firstTouchLatency
      leadUpdate.t_first_touch = firstTouchAt
    }

    await redis.hset(`lead:${leadId}`, leadUpdate)
    
    return Response.json({ 
      status: 'routed',
      leadId,
      router_latency_ms: routerLatency,
      total_latency_ms: totalLatency,
      first_touch_latency_ms: firstTouchLatency,
      target_5s_met: targetMet,
      actions_dispatched: actions.length,
      results: results.map(result => (result.ok ? 'fulfilled' : 'rejected'))
    })
    
  } catch (error) {
    console.error('Router error:', error)
    return Response.json(
      { error: 'Router failed', details: (error as Error).message },
      { status: 500 }
    )
  }
}
