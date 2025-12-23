'use client'

import { useEffect, useState } from 'react'

interface Stats {
  date: string
  total_leads_today: number
  total_leads_all_time: number
  latency_metrics: {
    p50_ms: number
    p95_ms: number
    p99_ms: number
    samples: number
  }
  target_5s: {
    hit_rate_percent: string
    under_5s: number
    over_5s: number
  }
  actions: {
    sms_sent: number
    emails_sent: number
  }
  recent_leads: Array<{
    id: string
    name: string
    source: string
    first_touch_latency_ms: string
    total_latency_ms: string
    target_met: string
    status: string
    created_at: string
  }>
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
            label="Leads Today" 
            value={stats?.total_leads_today || 0} 
          />
          <StatCard 
            label="Target Hit Rate" 
            value={`${stats?.target_5s.hit_rate_percent || 0}%`}
            sublabel="Under 5 seconds"
          />
          <StatCard 
            label="p95 First Touch" 
            value={`${stats?.latency_metrics.p95_ms || 0}ms`}
          />
          <StatCard 
            label="p99 First Touch" 
            value={`${stats?.latency_metrics.p99_ms || 0}ms`}
          />
        </div>
        
        {/* Actions Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-900 rounded-xl p-6">
            <div className="text-2xl font-bold text-green-400">{stats?.actions.sms_sent || 0}</div>
            <div className="text-gray-400 text-sm">SMS Sent</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-6">
            <div className="text-2xl font-bold text-blue-400">{stats?.actions.emails_sent || 0}</div>
            <div className="text-gray-400 text-sm">Emails Sent</div>
          </div>
        </div>
        
        {/* Recent Leads */}
        <div className="bg-gray-900 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Leads</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left">
                  <th className="pb-3">Name</th>
                  <th className="pb-3">Source</th>
                  <th className="pb-3">First Touch</th>
                  <th className="pb-3">Target</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats?.recent_leads.map((lead) => (
                  <tr key={lead.id} className="border-t border-gray-800">
                    <td className="py-3">{lead.name || 'Unknown'}</td>
                    <td className="py-3 text-gray-400">{lead.source}</td>
                    <td className="py-3">
                      {(() => {
                        const latencyValue = lead.first_touch_latency_ms || lead.total_latency_ms
                        if (!latencyValue) {
                          return <span className="text-gray-500">N/A</span>
                        }

                        const latencyMs = parseInt(latencyValue, 10)
                        const latencyClass = latencyMs < 5000 ? 'text-green-400' : 'text-red-400'
                        return <span className={latencyClass}>{latencyValue}ms</span>
                      })()}
                    </td>
                    <td className="py-3">
                      {lead.target_met === 'YES' ? (
                        <span className="text-green-400">✓</span>
                      ) : (
                        <span className="text-red-400">✗</span>
                      )}
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-1 bg-gray-800 rounded text-xs">
                        {lead.status}
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

function StatCard({ label, value, sublabel }: { label: string; value: string | number; sublabel?: string }) {
  return (
    <div className="bg-gray-900 rounded-xl p-6">
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-gray-400 text-sm">{label}</div>
      {sublabel && <div className="text-gray-600 text-xs mt-1">{sublabel}</div>}
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
      setResult(data)
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
