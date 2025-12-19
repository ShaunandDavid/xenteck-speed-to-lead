/**
 * BOOKING API
 * ===========
 * Handles booking confirmations and creates Google Calendar events.
 */

import { Redis } from '@upstash/redis'
import { NextRequest } from 'next/server'
import { google } from 'googleapis'

export async function POST(req: NextRequest) {
  const t0 = Date.now()
  
  try {
    const { leadId, slotStart, slotEnd, timezone } = await req.json()
    
    if (!leadId || !slotStart) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    const redis = Redis.fromEnv()
    
    // Get lead data
    const lead = await redis.hgetall(`lead:${leadId}`) as Record<string, string>
    
    if (!lead || !lead.id) {
      return Response.json({ error: 'Lead not found' }, { status: 404 })
    }
    
    // Initialize Google Calendar
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )
    
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    })
    
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
    
    // Create calendar event
    const agentName = process.env.AGENT_NAME || 'Shaun'
    const firstName = lead.name?.split(' ')[0] || 'Lead'
    
    const event = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: `XenTeck Call: ${firstName}`,
        description: `
Speed-to-Lead booking from ${lead.source || 'website'}

Lead: ${lead.name || 'Unknown'}
Email: ${lead.email || 'N/A'}
Phone: ${lead.phone || 'N/A'}
Headache: ${lead.headache || 'N/A'}
Website: ${lead.website || 'N/A'}

Lead ID: ${leadId}
Booked: ${new Date().toISOString()}
        `.trim(),
        start: {
          dateTime: slotStart,
          timeZone: timezone || 'America/Detroit'
        },
        end: {
          dateTime: slotEnd || new Date(new Date(slotStart).getTime() + 30 * 60000).toISOString(),
          timeZone: timezone || 'America/Detroit'
        },
        attendees: lead.email ? [{ email: lead.email }] : [],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 60 },
            { method: 'popup', minutes: 15 }
          ]
        }
      }
    })
    
    const bookingLatency = Date.now() - t0
    
    // Update lead with booking info
    await redis.hset(`lead:${leadId}`, {
      status: 'booked',
      booking_event_id: event.data.id,
      booking_link: event.data.htmlLink,
      booking_start: slotStart,
      booking_end: slotEnd,
      booking_latency_ms: bookingLatency,
      booked_at: new Date().toISOString()
    })
    
    return Response.json({
      status: 'booked',
      eventId: event.data.id,
      eventLink: event.data.htmlLink,
      start: slotStart,
      latency_ms: bookingLatency
    })
    
  } catch (error) {
    console.error('Booking error:', error)
    return Response.json(
      { error: 'Booking failed', details: (error as Error).message },
      { status: 500 }
    )
  }
}

// GET available slots (precomputed from cache ideally)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const days = parseInt(searchParams.get('days') || '7')
    
    // Initialize Google Calendar
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )
    
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    })
    
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
    
    // Get busy times
    const now = new Date()
    const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
    
    const freeBusy = await calendar.freebusy.query({
      requestBody: {
        timeMin: now.toISOString(),
        timeMax: endDate.toISOString(),
        items: [{ id: 'primary' }]
      }
    })
    
    const busySlots = freeBusy.data.calendars?.primary?.busy || []
    
    // Generate available 30-min slots (9am-5pm EST, Mon-Fri)
    const availableSlots: { start: string; end: string }[] = []
    const current = new Date(now)
    current.setMinutes(0, 0, 0)
    
    while (current < endDate && availableSlots.length < 20) {
      const day = current.getDay()
      const hour = current.getHours()
      
      // Mon-Fri, 9am-5pm
      if (day >= 1 && day <= 5 && hour >= 9 && hour < 17) {
        const slotStart = current.toISOString()
        const slotEnd = new Date(current.getTime() + 30 * 60000).toISOString()
        
        // Check if slot overlaps with busy times
        const isBusy = busySlots.some(busy => {
          const busyStart = new Date(busy.start || 0)
          const busyEnd = new Date(busy.end || 0)
          return current >= busyStart && current < busyEnd
        })
        
        if (!isBusy && current > now) {
          availableSlots.push({ start: slotStart, end: slotEnd })
        }
      }
      
      current.setMinutes(current.getMinutes() + 30)
    }
    
    return Response.json({
      slots: availableSlots,
      timezone: 'America/Detroit',
      generated_at: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Slots error:', error)
    return Response.json(
      { error: 'Failed to get slots' },
      { status: 500 }
    )
  }
}
