/**
 * LIGHTNING SMS - Telnyx
 * ======================
 * Sends immediate SMS via Telnyx API with booking link.
 */

import { Redis } from '@upstash/redis'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const t0 = Date.now()

  try {
    const { leadId, lead } = await req.json()

    if (!lead.phone) {
      return Response.json({ error: 'No phone number' }, { status: 400 })
    }

    const calendarLink = process.env.CALENDAR_LINK || 'https://calendar.app.google/8D2uSEALucdV3Krz9'

    const displayName = lead.name?.trim() || 'there'
    const messageBody = `Hey ${displayName},

Thanks for reaching out! I saw your message and wanted to respond right away.

I've got a few minutes right now if you'd like to connect. If you're busy, no problem - here's my calendar:

${calendarLink}

Just pick a time that works for you.

Looking forward to chatting,
XenTeck`

    let phone = lead.phone.replace(/\D/g, '')
    if (phone.length === 10) phone = '1' + phone
    if (!phone.startsWith('+')) phone = '+' + phone

    const apiKey = process.env.TELNYX_API_KEY
    const fromNumber = process.env.TELNYX_FROM_NUMBER

    if (!apiKey || !fromNumber) {
      throw new Error('Telnyx credentials not configured')
    }

    const response = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromNumber,
        to: phone,
        text: messageBody
      })
    })

    const result = await response.json()
    const smsLatency = Date.now() - t0

    if (!response.ok || !result?.data?.id) {
      const message = result?.errors?.[0]?.detail || result?.message || 'Telnyx error'
      throw new Error(message)
    }

    const redis = Redis.fromEnv()
    await redis.hset(`lead:${leadId}`, {
      sms_provider: 'telnyx',
      sms_message_id: result.data.id,
      sms_status: result.data.status || 'queued',
      sms_latency_ms: smsLatency,
      sms_sent_at: new Date().toISOString(),
      t_sms_sent: Date.now()
    })

    await redis.lpush('sms:history', JSON.stringify({
      leadId,
      provider: 'telnyx',
      to: phone,
      status: result.data.status || 'queued',
      latency_ms: smsLatency,
      sent_at: new Date().toISOString()
    }))

    return Response.json({
      status: 'sent',
      provider: 'telnyx',
      latency_ms: smsLatency
    })

  } catch (error) {
    const errorLatency = Date.now() - t0
    console.error('SMS error:', error)

    try {
      const body = await req.clone().json()
      const redis = Redis.fromEnv()
      await redis.hset(`lead:${body.leadId}`, {
        sms_status: 'failed',
        sms_error: (error as Error).message,
        sms_latency_ms: errorLatency
      })
    } catch (e) {}

    return Response.json(
      { error: 'SMS failed', details: (error as Error).message, latency_ms: errorLatency },
      { status: 500 }
    )
  }
}
