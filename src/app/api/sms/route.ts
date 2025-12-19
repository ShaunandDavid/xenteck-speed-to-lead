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
    
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    )
    
    const firstName = lead.name?.split(' ')[0] || 'there'
    const agentName = process.env.AGENT_NAME || 'Shaun'
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}`
    const bookingLink = `${baseUrl}/book/${leadId}`
    
    const messageBody = `Hey ${firstName}, I've got a few minutes right now if you want to talk. If you're busy: ${bookingLink} - just tell me what works best for you. - ${agentName}`
    
    const message = await client.messages.create({
      to: lead.phone,
      from: process.env.TWILIO_PHONE_NUMBER,
      body: messageBody
    })
    
    const smsLatency = Date.now() - t0
    
    const redis = Redis.fromEnv()
    await redis.hset(`lead:${leadId}`, {
      sms_sid: message.sid,
      sms_status: message.status,
      sms_latency_ms: smsLatency,
      sms_sent_at: new Date().toISOString()
    })
    
    return Response.json({ status: 'sent', sid: message.sid, latency_ms: smsLatency })
    
  } catch (error) {
    return Response.json({ error: 'SMS failed' }, { status: 500 })
  }
}