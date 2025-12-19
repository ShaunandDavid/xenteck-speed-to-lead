/**
 * LIGHTNING EMAIL
 * ===============
 * Sends immediate email via Gmail API with booking link.
 */

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
    
    // Initialize Gmail client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )
    
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    })
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
    
    // Extract first name
    const firstName = lead.name?.split(' ')[0] || 'there'
    const agentName = process.env.AGENT_NAME || 'Shaun'
    const agentEmail = process.env.AGENT_EMAIL || 'admin@xenteck.com'
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}`
    const bookingLink = `${baseUrl}/book/${leadId}`
    
    // Craft the email - professional but human
    const subject = `${firstName} - Quick response from XenTeck ⚡`
    
    const emailBody = `Hey ${firstName},

Thanks for reaching out! I saw your message come through and wanted to respond right away.

I've got a few minutes right now if you'd like to connect. If you're busy, no problem at all — here's my calendar:

${bookingLink}

Just pick a time that works for you, and we'll make it happen.

Looking forward to chatting,
${agentName}
XenTeck

---
This message was sent ${Date.now() - parseInt(lead.t0_received || '0')}ms after you submitted your inquiry.
We believe speed matters.`

    // Encode email for Gmail API
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
    
    // Send email
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    })
    
    const emailLatency = Date.now() - t0
    
    // Log to Redis
    const redis = Redis.fromEnv()
    await redis.hset(`lead:${leadId}`, {
      email_id: result.data.id,
      email_thread_id: result.data.threadId,
      email_status: 'sent',
      email_latency_ms: emailLatency,
      email_sent_at: new Date().toISOString(),
      t_email_sent: Date.now()
    })
    
    // Also log to email history for analytics
    await redis.lpush(`email:history`, JSON.stringify({
      leadId,
      messageId: result.data.id,
      to: lead.email,
      latency_ms: emailLatency,
      sent_at: new Date().toISOString()
    }))
    
    return Response.json({
      status: 'sent',
      messageId: result.data.id,
      threadId: result.data.threadId,
      latency_ms: emailLatency
    })
    
  } catch (error) {
    const errorLatency = Date.now() - t0
    console.error('Email error:', error)
    
    return Response.json(
      { 
        error: 'Email failed',
        details: (error as Error).message,
        latency_ms: errorLatency
      },
      { status: 500 }
    )
  }
}
