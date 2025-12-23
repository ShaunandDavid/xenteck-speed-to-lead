/**
 * LIGHTNING SMS - SlickText
 * =========================
 * Sends immediate SMS via SlickText API with booking link.
 * Swap to Twilio when 10DLC approval clears.
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

    const firstName = lead.name?.split(' ')[0] || 'there'
    const calendarLink = process.env.CALENDAR_LINK || 'https://calendar.app.google/8D2uSEALucdV3Krz9'

    const messageBody = `Hey ${firstName} - XenTeck here. Book a quick 15-min call: ${calendarLink} Reply STOP to opt out.`

    let phone = lead.phone.replace(/\D/g, '')
    if (phone.length === 10) phone = '1' + phone
    if (!phone.startsWith('+')) phone = '+' + phone

    const publicKey = process.env.SLICKTEXT_PUBLIC_KEY
    const privateKey = process.env.SLICKTEXT_PRIVATE_KEY
    const textwordId = process.env.SLICKTEXT_TEXTWORD_ID

    if (!publicKey || !privateKey || !textwordId) {
      throw new Error('SlickText credentials not configured')
    }

    const authString = Buffer.from(`${publicKey}:${privateKey}`).toString('base64')

    const response = await fetch('https://api.slicktext.com/v1/messages/', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        action: 'SEND',
        textword: textwordId,
        number: phone,
        body: messageBody
      }).toString()
    })

    const result = await response.json()
    const smsLatency = Date.now() - t0

    if (!response.ok || result.error) {
      throw new Error(result.error || result.message || 'SlickText error')
    }

    const redis = Redis.fromEnv()
    await redis.hset(`lead:${leadId}`, {
      sms_provider: 'slicktext',
      sms_message_id: result.messageId || 'sent',
      sms_status: 'sent',
      sms_latency_ms: smsLatency,
      sms_sent_at: new Date().toISOString(),
      t_sms_sent: Date.now()
    })

    await redis.lpush('sms:history', JSON.stringify({
      leadId,
      provider: 'slicktext',
      to: phone,
      status: 'sent',
      latency_ms: smsLatency,
      sent_at: new Date().toISOString()
    }))

    return Response.json({
      status: 'sent',
      provider: 'slicktext',
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
