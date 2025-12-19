/**
 * LIGHTNING SMS
 * =============
 * Sends immediate SMS via Twilio with booking link.
 * 
 * Message template:
 * "Hey {firstName}, I've got a few minutes right now if you want to talk.
 * If you're busy: {bookingLink} — just tell me what works best for you. - {agentName}"
 */

import { Redis } from '@upstash/redis'
import { NextRequest } from 'next/server'
import twilio from 'twilio'

export async function POST(req: NextRequest) {
  const t0 = Date.now()
  
  try {
    const { leadId, lead } = await req.json()
    
    if (!lead.phone) {
      return Response.json({ error: 'No phone number' }, { status: 400 })
    }
    
    // Initialize Twilio client
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    )
    
    // Extract first name
    const firstName = lead.name?.split(' ')[0] || 'there'
    const agentName = process.env.AGENT_NAME || 'Shaun'
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}`
    const bookingLink = `${baseUrl}/book/${leadId}`
    
    // Craft the message - human, direct, gives options
    const messageBody = `Hey ${firstName}, I've got a few minutes right now if you want to talk. If you're busy: ${bookingLink} — just tell me what works best for you. - ${agentName}`
    
    // Send SMS
    const message = await client.messages.create({
      to: lead.phone,
      from: process.env.TWILIO_PHONE_NUMBER,
      body: messageBody
    })
    
    const smsLatency = Date.now() - t0
    
    // Log to Redis
    const redis = Redis.fromEnv()
    await redis.hset(`lead:${leadId}`, {
      sms_sid: message.sid,
      sms_status: message.status,
      sms_latency_ms: smsLatency,
      sms_sent_at: new Date().toISOString(),
      t_sms_sent: Date.now()
    })
    
    // Also log to SMS history for analytics
    await redis.lpush(`sms:history`, JSON.stringify({
      leadId,
      sid: message.sid,
      to: lead.phone,
      status: message.status,
      latency_ms: smsLatency,
      sent_at: new Date().toISOString()
    }))
    
    return Response.json({
      status: 'sent',
      sid: message.sid,
      latency_ms: smsLatency
    })
    
  } catch (error) {
    const errorLatency = Date.now() - t0
    console.error('SMS error:', error)
    
    // Log the failure
    try {
      const { leadId } = await req.json()
      const redis = Redis.fromEnv()
      await redis.hset(`lead:${leadId}`, {
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
        details: (error as Error).message,
        latency_ms: errorLatency
      },
      { status: 500 }
    )
  }
}
