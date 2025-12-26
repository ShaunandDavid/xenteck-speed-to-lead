/**
 * TYPES
 * =====
 * Shared TypeScript types for the Speed-to-Lead system.
 */

// Lead submission from forms/webhooks
export interface LeadSubmission {
  name?: string
  email?: string
  phone?: string
  source?: string
  headache?: string
  website?: string
}

// Lead stored in Redis
export interface Lead extends LeadSubmission {
  id: string
  status: LeadStatus
  t0_received: number
  created_at: string
  // Tracking
  total_latency_ms?: number
  first_touch_latency_ms?: number
  router_latency_ms?: number
  sms_latency_ms?: number
  email_latency_ms?: number
  target_5s_met?: 'YES' | 'NO'
  t_first_touch?: number
  // SMS
  sms_sid?: string
  sms_status?: string
  sms_sent_at?: string
  // Email
  email_id?: string
  email_thread_id?: string
  email_status?: string
  email_sent_at?: string
  // Booking
  booking_event_id?: string
  booking_link?: string
  booking_start?: string
  booking_end?: string
  booked_at?: string
}

export type LeadStatus = 
  | 'received'
  | 'routing'
  | 'routed'
  | 'dedupe_blocked'
  | 'compliance_blocked'
  | 'booked'
  | 'contacted'
  | 'closed_won'
  | 'closed_lost'

// API responses
export interface CaptureResponse {
  status: 'received'
  leadId: string
  capture_latency_ms: number
  timestamp: string
}

export interface RouterResponse {
  status: 'routed' | 'blocked'
  leadId: string
  router_latency_ms: number
  total_latency_ms: number
  first_touch_latency_ms?: number | null
  target_5s_met: 'YES' | 'NO'
  actions_dispatched: number
  reason?: string
}

export interface SMSResponse {
  status: 'sent' | 'failed'
  sid?: string
  latency_ms: number
  error?: string
}

export interface EmailResponse {
  status: 'sent' | 'failed'
  messageId?: string
  threadId?: string
  latency_ms: number
  error?: string
}

export interface BookingSlot {
  start: string
  end: string
}

export interface StatsResponse {
  range_days: number
  leads_tracked: number
  time_to_booking_p95_ms: number
  fastest_time_ms: number
  under_5s_rate_percent: string
  delivery_success_rate_percent: string
  recent_leads: Array<{
    id: string
    submitted_at: string
    channel: 'Email' | 'SMS' | 'Both'
    latency_ms: number | null
    status: 'Sent' | 'Accepted' | 'Failed' | 'Bounced'
    fallback: 'Y' | 'N'
  }>
}
