/**
 * LIGHTNING SMS - SlickText
 * =========================
 * Sends immediate SMS via SlickText API with booking link.
 * Swap to Twilio when 10DLC approval clears.
 * 
 * SlickText API: POST https://api.slicktext.com/v1/messages/
 * Auth: HTTP Basic (public_key:private_key)
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
    
    // Extract first name
    const firstName = lead.name?.split(' ')[0] || 'there'
    const calendarLink = process.env.CALENDAR_LINK || 'https://calendar.app.google/8D2uSEALucdV3Krz9'
    
    // Craft message (keep under 160 chars for single SMS)
    const messageBody = `Hey ${firstName} — it's XenTeck. Thanks for reaching out 👋\nBook a quick 15-min call: ${calendarLink}\nReply STOP to opt out.`
    
    // Format phone for SlickText (needs +1 prefix)
    let phone = lead.phone.replace(/\D/g, '')
    if (phone.length === 10) phone = '1' + phone
    if (!phone.startsWith('+')) phone = '+' + phone
    
    // SlickText API credentials
    const publicKey = process.env.SLICKTEXT_PUBLIC_KEY
    const privateKey = process.env.SLICKTEXT_PRIVATE_KEY
    const textwordId = process.env.SLICKTEXT_TEXTWORD_ID
    
    if (!publicKey || !privateKey || !textwordId) {
      throw new Error('SlickText credentials not configured')
    }
    
    // HTTP Basic auth
    const authString = Buffer.from(`${publicKey}:${privateKey}`).toString('base64')
    
    // Send SMS via SlickText
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
      throw new Error(result.error || result.message || `SlickText error: ${response.status}`)
    }
    
    // Log to Redis
    const redis = Redis.fromEnv()
    await redis.hset(`lead:${leadId}`, {
      sms_provider: 'slicktext',
      sms_message_id: result.messageId || result.id || 'sent',
      sms_status: 'sent',
      sms_latency_ms: smsLatency,
      sms_sent_at: new Date().toISOString(),
      t_sms_sent: Date.now()
    })
    
    // Log to SMS history for analytics
    await redis.lpush('sms:history', JSON.stringify({
      leadId,
      provider: 'slicktext',
      messageId: result.messageId || result.id,
      to: phone,
      status: 'sent',
      latency_ms: smsLatency,
      sent_at: new Date().toISOString()
    }))
    
    return Response.json({
      status: 'sent',
      provider: 'slicktext',
      messageId: result.messageId || result.id,
      latency_ms: smsLatency
    })
    
  } catch (error) {
    const errorLatency = Date.now() - t0
    console.error('SMS error:', error)
    
    // Log the failure
    try {
      const body = await req.clone().json()
      const redis = Redis.fromEnv()
      await redis.hset(`lead:${body.leadId}`, {
        sms_provider: 'slicktext',
        sms_status: 'failed',
        sms_error: (error as Error).message,
        sms_latency_ms: errorLatency
      })
    } catch (e) {
      // Ignore logging errors
    }
    
    return Response.json(
      { 
        error: 'SMS failed',
        provider: 'slicktext',
        details: (error as Error).message,
        latency_ms: errorLatency
      },
      { status: 500 }
    )
  }
}
