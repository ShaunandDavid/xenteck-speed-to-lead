import { Redis } from '@upstash/redis'

let redis: Redis | null = null

export function getRedis(): Redis {
  if (!redis) {
    redis = Redis.fromEnv()
  }
  return redis
}

export async function getLead(leadId: string) {
  const redis = getRedis()
  const data = await redis.hgetall(`lead:${leadId}`)
  if (!data || !data.id) return null
  return data
}

export async function updateLead(leadId: string, updates: Record<string, any>) {
  const redis = getRedis()
  await redis.hset(`lead:${leadId}`, updates)
}