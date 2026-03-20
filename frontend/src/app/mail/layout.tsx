'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMailStore } from '@/lib/store'
import { api } from '@/lib/api'

export default function MailLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { setUser, setTokens, setLabels } = useMailStore()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    const refresh = localStorage.getItem('refresh_token')

    if (!token) {
      router.replace('/login')
      return
    }

    setTokens(token, refresh ?? undefined)

    api
      .getMe()
      .then((user) => {
        setUser(user)
        // Also load labels on boot
        return api.getLabels()
      })
      .then((labels) => {
        setLabels(labels)
      })
      .catch(() => {
        router.replace('/login')
      })
      .finally(() => {
        setChecking(false)
      })
  }, [router, setUser, setTokens, setLabels])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f8fc]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-4 border-[#e8ecf4]" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#667eea] animate-spin" />
          </div>
          <p className="text-sm text-[#718096]">Loading your mail…</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
