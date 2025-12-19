'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'

export default function BookingPage() {
  const params = useParams()
  const leadId = params.leadId as string
  const [booked, setBooked] = useState(false)
  const [booking, setBooking] = useState(false)
  
  const slots = [
    { day: 'Tomorrow', times: ['9:00 AM', '10:00 AM', '11:00 AM', '2:00 PM', '3:00 PM'] },
    { day: 'Day After', times: ['9:00 AM', '10:30 AM', '1:00 PM', '4:00 PM'] }
  ]
  
  const bookSlot = async (day: string, time: string) => {
    setBooking(true)
    // In production, this would call /api/book
    await new Promise(r => setTimeout(r, 1000))
    setBooked(true)
    setBooking(false)
  }
  
  if (booked) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-900 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">You're Booked!</h1>
          <p className="text-gray-400">We'll send you a calendar invite shortly.</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-950 text-white p-4">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Pick a Time</h1>
          <p className="text-gray-400">30-minute discovery call with XenTeck</p>
        </div>
        
        {slots.map((slot) => (
          <div key={slot.day} className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-gray-300">{slot.day}</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slot.times.map((time) => (
                <button
                  key={time}
                  onClick={() => bookSlot(slot.day, time)}
                  disabled={booking}
                  className="bg-gray-800 hover:bg-blue-600 disabled:opacity-50 px-4 py-3 rounded-lg text-sm font-medium transition"
                >
                  {time}
                </button>
              ))}
            </div>
          </div>
        ))}
        
        <div className="text-center mt-12 text-xs text-gray-600">
          Lead ID: {leadId}
        </div>
      </div>
    </div>
  )
}