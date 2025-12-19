export interface LeadSubmission {
  name?: string
  email?: string
  phone?: string
  source?: string
  headache?: string
  website?: string
}

export interface Lead extends LeadSubmission {
  id: string
  status: string
  t0_received: number
  created_at: string
  total_latency_ms?: number
  router_latency_ms?: number
  sms_latency_ms?: number
  email_latency_ms?: number
  target_5s_met?: 'YES' | 'NO'
  sms_sid?: string
  sms_status?: string
  email_id?: string
  email_status?: string
  booking_event_id?: string
  booking_link?: string
  booked_at?: string
}