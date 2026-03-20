'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (token) {
      router.replace('/mail')
    } else {
      router.replace('/login')
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f8fc]">
      <div className="flex flex-col items-center gap-4">
        {/* Gradient spinner */}
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-4 border-[#e8ecf4]" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#667eea] animate-spin" />
        </div>
        <p className="text-sm text-[#718096]">Loading Enterprise Mail…</p>
      </div>
    </div>
  )
}
