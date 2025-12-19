/**
 * EDGE CAPTURE API
 * ================
 * Entry point for all leads. Runs on Vercel Edge for minimum latency.
 * 
 * Target: p95 < 150ms, p99 < 300ms
 * 
 * This endpoint:
 * 1. Validates minimal fields
 * 2. Generates idempotency key
 * 3. Writes to Lead Ledger (Redis)
 * 4. Fires hot router (non-blocking)
 * 5. Returns immediately with timestamp proof
 */

import { Redis } from '@upstash/redis'
import { NextRequest } from 'next/server'

// CRITICAL: Edge runtime for minimum latency
export const runtime = 'edge'

export async function POST(req: NextRequest) {
  const t0 = Date.now()
  
  try {
    // 1. Parse & validate (fast)
    const body = await req.json()
    const { name, email, phone, source, headache, website } = body
    
    // Minimal validation - don't slow down the hot path
    if (!email && !phone) {
      return Response.json(
        { error: 'Missing required fields: need email or phone' },
        { status: 400 }
      )
    }
    
    // 2. Generate idempotency key
    const timestamp = Date.now()
    const phoneSlug = phone ? phone.replace(/\D/g, '').slice(-4) : 'noph'
    const leadId = `lead_${timestamp}_${phoneSlug}`
    
    // 3. Write to Lead Ledger (Redis)
    const redis = Redis.fromEnv()
    
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
    
    await redis.hset(`lead:${leadId}`, leadData)
    
    // 4. Fire hot router (NON-BLOCKING - fire and forget)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    const routerUrl = `${baseUrl}/api/router`
    
    // Don't await - this is the key to sub-150ms response
    fetch(routerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, t0 })
    }).catch(err => {
      // Log but don't fail the response
      console.error('Router fire failed:', err)
    })
    
    // 5. Return immediately with timestamp proof
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
      { 
        error: 'Capture failed',
        latency_ms: errorLatency
      },
      { status: 500 }
    )
  }
}

// Health check endpoint
export async function GET() {
  return Response.json({ 
    status: 'ok', 
    service: 'capture',
    runtime: 'edge'
  })
}
