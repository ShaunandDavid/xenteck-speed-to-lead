import { Redis } from '@upstash/redis'
import { NextRequest } from 'next/server'
import { google } from 'googleapis'

export async function POST(req: NextRequest) {
  const t0 = Date.now()
  
  try {
    const { leadId, lead } = await req.json()
    
    if (!lead.email) {
      return Response.json({ error: 'No email address' }, { status: 400 })
    }
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )
    
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    })
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
    
    const firstName = lead.name?.split(' ')[0] || 'there'
    const agentName = process.env.AGENT_NAME || 'Shaun'
    const agentEmail = process.env.AGENT_EMAIL || 'admin@xenteck.com'
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}`
    const bookingLink = `${baseUrl}/book/${leadId}`
    
    const subject = `${firstName} - Quick response from XenTeck`
    const emailBody = `Hey ${firstName},\n\nThanks for reaching out! I've got a few minutes right now if you'd like to connect.\n\nIf you're busy: ${bookingLink}\n\nLooking forward to chatting,\n${agentName}\nXenTeck`
    
    const emailLines = [
      `From: ${agentName} <${agentEmail}>`,
      `To: ${lead.email}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      emailBody
    ]
    
    const encodedMessage = Buffer.from(emailLines.join('\r\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage }
    })
    
    const emailLatency = Date.now() - t0
    
    const redis = Redis.fromEnv()
    await redis.hset(`lead:${leadId}`, {
      email_id: result.data.id,
      email_status: 'sent',
      email_latency_ms: emailLatency,
      email_sent_at: new Date().toISOString()
    })
    
    return Response.json({ status: 'sent', messageId: result.data.id, latency_ms: emailLatency })
    
  } catch (error) {
    return Response.json({ error: 'Email failed' }, { status: 500 })
  }
}