/**
 * REDIS HELPER
 * ============
 * Upstash Redis client wrapper with typed operations.
 */

import { Redis } from '@upstash/redis'

// Singleton Redis client
let redis: Redis | null = null

export function getRedis(): Redis {
  if (!redis) {
    redis = Redis.fromEnv()
  }
  return redis
}

// Lead operations
export interface Lead {
  id: string
  name: string
  email: string
  phone: string
  source: string
  headache: string
  website: string
  status: string
  t0_received: number
  created_at: string
  // Latency tracking
  total_latency_ms?: number
  first_touch_latency_ms?: number
  router_latency_ms?: number
  sms_latency_ms?: number
  email_latency_ms?: number
  target_5s_met?: string
  t_first_touch?: number
  // SMS fields
  sms_sid?: string
  sms_status?: string
  // Email fields
  email_id?: string
  email_status?: string
  // Booking fields
  booking_event_id?: string
  booking_link?: string
  booked_at?: string
}

export async function getLead(leadId: string): Promise<Lead | null> {
  const redis = getRedis()
  const data = await redis.hgetall(`lead:${leadId}`)
  if (!data || Object.keys(data).length === 0) return null
  return data as unknown as Lead
}

export async function updateLead(leadId: string, updates: Partial<Lead>): Promise<void> {
  const redis = getRedis()
  await redis.hset(`lead:${leadId}`, updates)
}

// Dedupe operations
export async function checkDedupe(key: string): Promise<string | null> {
  const redis = getRedis()
  return await redis.get(`dedupe:${key}`)
}

export async function setDedupe(key: string, leadId: string, ttlSeconds: number): Promise<void> {
  const redis = getRedis()
  await redis.setex(`dedupe:${key}`, ttlSeconds, leadId)
}

// Cache operations (for precomputed data)
export async function getCache<T>(key: string): Promise<T | null> {
  const redis = getRedis()
  return await redis.get(key)
}

export async function setCache<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
  const redis = getRedis()
  if (ttlSeconds) {
    await redis.setex(key, ttlSeconds, JSON.stringify(value))
  } else {
    await redis.set(key, JSON.stringify(value))
  }
}
