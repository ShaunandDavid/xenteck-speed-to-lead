'use client'

import { useEffect, useState } from 'react'

interface Stats {
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

function formatSeconds(latencyMs?: number | null): string {
  if (!latencyMs || latencyMs <= 0) return 'N/A'
  return `${(latencyMs / 1000).toFixed(1)}s`
}

function formatTimestamp(value?: string): string {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 10000) // Refresh every 10s
    return () => clearInterval(interval)
  }, [])
  
  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats')
      const data = await res.json()
      setStats(data)
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    } finally {
      setLoading(false)
    }
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">⚡ Speed-to-Lead Dashboard</h1>
          <p className="text-gray-400">Real-time performance metrics</p>
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Time to Booking Link Sent (p95)"
            value={formatSeconds(stats?.time_to_booking_p95_ms)}
            badge={`Fastest recorded: ${formatSeconds(stats?.fastest_time_ms)}`}
          />
          <StatCard
            label="Under-5s SLA Pass Rate"
            value={`${stats?.under_5s_rate_percent || '0'}%`}
          />
          <StatCard
            label="Delivery Success Rate"
            value={`${stats?.delivery_success_rate_percent || '0'}%`}
          />
          <StatCard
            label="Leads Tracked (last 7 days)"
            value={(stats?.leads_tracked ?? 0).toLocaleString()}
          />
        </div>
        
        {/* Proof Table */}
        <div className="bg-gray-900 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Proof Table</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left">
                  <th className="pb-3">Submitted</th>
                  <th className="pb-3">Channel</th>
                  <th className="pb-3">Latency</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Fallback</th>
                </tr>
              </thead>
              <tbody>
                {stats?.recent_leads.map((lead) => (
                  <tr key={lead.id} className="border-t border-gray-800">
                    <td className="py-3 text-gray-300">{formatTimestamp(lead.submitted_at)}</td>
                    <td className="py-3 text-gray-400">{lead.channel}</td>
                    <td className="py-3">
                      <span className={
                        lead.latency_ms === null
                          ? 'text-gray-500'
                          : lead.latency_ms < 5000
                            ? 'text-green-400'
                            : 'text-red-400'
                      }>
                        {formatSeconds(lead.latency_ms)}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        lead.status === 'Accepted' || lead.status === 'Sent'
                          ? 'bg-green-500/10 text-green-300'
                          : lead.status === 'Bounced'
                            ? 'bg-orange-500/10 text-orange-300'
                            : 'bg-red-500/10 text-red-300'
                      }`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={lead.fallback === 'Y' ? 'text-amber-300' : 'text-gray-500'}>
                        {lead.fallback}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Test Form */}
        <div className="mt-8 bg-gray-900 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Test Lead Capture</h2>
          <TestForm onSubmit={fetchStats} />
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  sublabel,
  badge
}: {
  label: string
  value: string | number
  sublabel?: string
  badge?: string
}) {
  return (
    <div className="bg-gray-900 rounded-xl p-6">
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-gray-400 text-sm">{label}</div>
      {sublabel && <div className="text-gray-600 text-xs mt-1">{sublabel}</div>}
      {badge && (
        <div className="mt-2 inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
          {badge}
        </div>
      )}
    </div>
  )
}

function TestForm({ onSubmit }: { onSubmit: () => void }) {
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<any>(null)
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setResult(null)
    
    const form = e.currentTarget
    const formData = new FormData(form)
    
    try {
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          email: formData.get('email'),
          phone: formData.get('phone'),
          source: 'dashboard_test',
          headache: formData.get('headache')
        })
      })
      
      const data = await res.json()
      if (data && typeof data === 'object') {
        const displayData = { ...data }
        delete (displayData as { capture_latency_ms?: number }).capture_latency_ms
        setResult(displayData)
      } else {
        setResult(data)
      }
      form.reset()
      
      // Refresh stats after a delay
      setTimeout(onSubmit, 2000)
    } catch (err) {
      setResult({ error: 'Failed to submit' })
    } finally {
      setSubmitting(false)
    }
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <input
          name="name"
          placeholder="Name"
          className="bg-gray-800 rounded-lg px-4 py-2 text-white placeholder-gray-500"
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          className="bg-gray-800 rounded-lg px-4 py-2 text-white placeholder-gray-500"
        />
        <input
          name="phone"
          placeholder="Phone"
          className="bg-gray-800 rounded-lg px-4 py-2 text-white placeholder-gray-500"
        />
        <input
          name="headache"
          placeholder="What's your biggest challenge?"
          className="bg-gray-800 rounded-lg px-4 py-2 text-white placeholder-gray-500"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-2 rounded-lg font-medium transition"
      >
        {submitting ? 'Sending...' : 'Test Lead Capture'}
      </button>
      
      {result && (
        <div className={`mt-4 p-4 rounded-lg ${result.error ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
          <pre className="text-xs overflow-auto">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </form>
  )
}
