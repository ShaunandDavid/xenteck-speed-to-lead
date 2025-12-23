/**
 * LIGHTNING EMAIL - SendGrid
 * ==========================
 * Sends immediate email via SendGrid API with booking link.
 * Faster than Gmail API (100-200ms vs 300-500ms).
 */

import { Redis } from '@upstash/redis'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const t0 = Date.now()

  try {
    const { leadId, lead } = await req.json()

    if (!lead.email) {
      return Response.json({ error: 'No email address' }, { status: 400 })
    }

    const firstName = lead.name?.split(' ')[0] || 'there'
    const calendarLink = process.env.CALENDAR_LINK || 'https://calendar.app.google/8D2uSEALucdV3Krz9'
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'support@xenteck.com'
    const fromName = process.env.SENDGRID_FROM_NAME || 'XenTeck'
    const apiKey = process.env.SENDGRID_API_KEY

    if (!apiKey) {
      throw new Error('SendGrid API key not configured')
    }

    const subject = `Quick 15-min call - pick a time`

    const htmlBody = `
      <p>Hey ${firstName},</p>
      <p>Thanks for reaching out! I saw your message and wanted to respond right away.</p>
      <p>I've got a few minutes right now if you'd like to connect. If you're busy, no problem - here's my calendar:</p>
      <p><a href="${calendarLink}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">Book a 15-min Call</a></p>
      <p>Just pick a time that works for you.</p>
      <p>Looking forward to chatting,<br>${fromName}</p>
    `

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: lead.email }] }],
        from: { email: fromEmail, name: fromName },
        subject: subject,
        content: [{ type: 'text/html', value: htmlBody }]
      })
    })

    const emailLatency = Date.now() - t0

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`SendGrid error: ${response.status} - ${errorText}`)
    }

    const messageId = response.headers.get('x-message-id') || 'sent'

    const redis = Redis.fromEnv()
    await redis.hset(`lead:${leadId}`, {
      email_provider: 'sendgrid',
      email_id: messageId,
      email_status: 'sent',
      email_latency_ms: emailLatency,
      email_sent_at: new Date().toISOString(),
      t_email_sent: Date.now()
    })

    await redis.lpush('email:history', JSON.stringify({
      leadId,
      provider: 'sendgrid',
      messageId: messageId,
      to: lead.email,
      latency_ms: emailLatency,
      sent_at: new Date().toISOString()
    }))

    return Response.json({
      status: 'sent',
      provider: 'sendgrid',
      messageId: messageId,
      latency_ms: emailLatency
    })

  } catch (error) {
    const errorLatency = Date.now() - t0
    console.error('Email error:', error)

    return Response.json(
      { error: 'Email failed', details: (error as Error).message, latency_ms: errorLatency },
      { status: 500 }
    )
  }
}
