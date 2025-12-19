import { Redis } from '@upstash/redis'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  const t0 = Date.now()
  
  try {
    const body = await req.json()
    const { name, email, phone, source, headache, website } = body
    
    if (!email && !phone) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    const timestamp = Date.now()
    const phoneSlug = phone ? phone.replace(/\D/g, '').slice(-4) : 'noph'
    const leadId = `lead_${timestamp}_${phoneSlug}`
    
    const redis = Redis.fromEnv()
    
    await redis.hset(`lead:${leadId}`, {
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
    })
    
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
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    return Response.json({ error: 'Capture failed' }, { status: 500 })
  }
}

export async function GET() {
  return Response.json({ status: 'ok', service: 'capture', runtime: 'edge' })
}