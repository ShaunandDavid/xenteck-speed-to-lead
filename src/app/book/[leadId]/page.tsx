'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface Slot {
  start: string
  end: string
}

export default function BookingPage() {
  const params = useParams()
  const leadId = params.leadId as string
  
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState(false)
  const [booked, setBooked] = useState<{ start: string; link: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    fetchSlots()
  }, [])
  
  const fetchSlots = async () => {
    try {
      const res = await fetch('/api/book?days=7')
      const data = await res.json()
      setSlots(data.slots || [])
    } catch (err) {
      setError('Failed to load available times')
    } finally {
      setLoading(false)
    }
  }
  
  const bookSlot = async (slot: Slot) => {
    setBooking(true)
    setError(null)
    
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          slotStart: slot.start,
          slotEnd: slot.end,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      })
      
      const data = await res.json()
      
      if (data.status === 'booked') {
        setBooked({ start: slot.start, link: data.eventLink })
      } else {
        setError(data.error || 'Booking failed')
      }
    } catch (err) {
      setError('Failed to book appointment')
    } finally {
      setBooking(false)
    }
  }
  
  const formatSlot = (isoString: string) => {
    const date = new Date(isoString)
    return {
      day: date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }
  }
  
  // Group slots by day
  const slotsByDay = slots.reduce((acc, slot) => {
    const day = new Date(slot.start).toDateString()
    if (!acc[day]) acc[day] = []
    acc[day].push(slot)
    return acc
  }, {} as Record<string, Slot[]>)
  
  if (booked) {
    const { day, time } = formatSlot(booked.start)
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-900 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">You're Booked!</h1>
          <p className="text-gray-400 mb-6">
            {day} at {time}
          </p>
          <p className="text-sm text-gray-500 mb-6">
            You'll receive a calendar invite shortly. Looking forward to speaking with you!
          </p>
          <a 
            href={booked.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-medium transition"
          >
            View Calendar Event
          </a>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-950 text-white p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-8">
          <h1 className="text-3xl font-bold mb-2">Pick a Time</h1>
          <p className="text-gray-400">30-minute discovery call with XenTeck</p>
        </div>
        
        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 text-red-400 text-center">
            {error}
          </div>
        )}
        
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        
        {/* Slots */}
        {!loading && Object.entries(slotsByDay).map(([day, daySlots]) => (
          <div key={day} className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-gray-300">
              {new Date(day).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {daySlots.map((slot) => {
                const { time } = formatSlot(slot.start)
                return (
                  <button
                    key={slot.start}
                    onClick={() => bookSlot(slot)}
                    disabled={booking}
                    className="bg-gray-800 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 rounded-lg text-sm font-medium transition"
                  >
                    {time}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        
        {/* No slots */}
        {!loading && slots.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No available times found. Please check back later.
          </div>
        )}
        
        {/* Footer */}
        <div className="text-center mt-12 pb-8">
          <p className="text-xs text-gray-600">
            Powered by XenTeck Speed-to-Lead
          </p>
        </div>
      </div>
    </div>
  )
}
