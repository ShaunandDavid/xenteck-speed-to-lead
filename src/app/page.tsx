'use client'

import { useEffect, useState } from 'react'

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 10000)
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
  
  const handleTest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    
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
    alert(`Lead captured in ${data.capture_latency_ms}ms! ID: ${data.leadId}`)
    form.reset()
    setTimeout(fetchStats, 2000)
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
        <h1 className="text-3xl font-bold mb-8">Speed-to-Lead Dashboard</h1>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-900 rounded-xl p-6">
            <div className="text-3xl font-bold">{stats?.total_leads_today || 0}</div>
            <div className="text-gray-400 text-sm">Leads Today</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-6">
            <div className="text-3xl font-bold">{stats?.target_5s?.hit_rate_percent || 0}%</div>
            <div className="text-gray-400 text-sm">Target Hit Rate</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-6">
            <div className="text-3xl font-bold">{stats?.latency_metrics?.p95_ms || 0}ms</div>
            <div className="text-gray-400 text-sm">p95 Latency</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-6">
            <div className="text-3xl font-bold">{stats?.latency_metrics?.p99_ms || 0}ms</div>
            <div className="text-gray-400 text-sm">p99 Latency</div>
          </div>
        </div>
        
        <div className="bg-gray-900 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Test Lead Capture</h2>
          <form onSubmit={handleTest} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <input name="name" placeholder="Name" className="bg-gray-800 rounded-lg px-4 py-2 text-white placeholder-gray-500" />
              <input name="email" type="email" placeholder="Email" className="bg-gray-800 rounded-lg px-4 py-2 text-white placeholder-gray-500" />
              <input name="phone" placeholder="Phone" className="bg-gray-800 rounded-lg px-4 py-2 text-white placeholder-gray-500" />
              <input name="headache" placeholder="Biggest challenge?" className="bg-gray-800 rounded-lg px-4 py-2 text-white placeholder-gray-500" />
            </div>
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium transition">
              Test Lead Capture
            </button>
          </form>
        </div>
        
        <div className="bg-gray-900 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Leads</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-left">
                <th className="pb-3">Name</th>
                <th className="pb-3">Latency</th>
                <th className="pb-3">Target</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {stats?.recent_leads?.map((lead: any) => (
                <tr key={lead.id} className="border-t border-gray-800">
                  <td className="py-3">{lead.name || 'Unknown'}</td>
                  <td className="py-3">{lead.total_latency_ms}ms</td>
                  <td className="py-3">{lead.target_met === 'YES' ? '✓' : '✗'}</td>
                  <td className="py-3">{lead.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}