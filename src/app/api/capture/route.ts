/**
 * EDGE CAPTURE API
 * ================
 * Entry point for all leads. Runs on Vercel Edge for minimum latency.
 * Target: p95 < 150ms, p99 < 300ms
 */

import { Redis } from '@upstash/redis'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

type LeadPayload = {
  name?: string
  email?: string
  phone?: string
  source?: string
  headache?: string
  website?: string
}

async function parseBody(req: NextRequest): Promise<LeadPayload> {
  const contentType = req.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const json = await req.json()
    return typeof json === 'object' && json ? json : {}
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await req.text()
    return Object.fromEntries(new URLSearchParams(text))
  }

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const data: Record<string, string> = {}
    formData.forEach((value, key) => {
      data[key] = typeof value === 'string' ? value : value.name
    })
    return data
  }

  const text = await req.text()
  if (!text) {
    return {}
  }

  try {
    const json = JSON.parse(text)
    return typeof json === 'object' && json ? json : {}
  } catch {
    return Object.fromEntries(new URLSearchParams(text))
  }
}

export async function POST(req: NextRequest) {
  const t0 = Date.now()

  try {
    const body = await parseBody(req)
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
  return Response.json({ status: 'ok', service: 'capture', runtime: 'edge' })
}
