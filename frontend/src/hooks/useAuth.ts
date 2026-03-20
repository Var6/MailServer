'use client'

import { useMailStore } from '@/lib/store'
import { api } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

export function useAuth() {
  const { user, accessToken, clearAuth, addToast } = useMailStore()
  const router = useRouter()

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      // ignore logout errors
    } finally {
      clearAuth()
      addToast({ type: 'success', message: 'Signed out successfully' })
      router.push('/login')
    }
  }, [clearAuth, addToast, router])

  return {
    user,
    accessToken,
    isAuthenticated: !!accessToken,
    logout,
  }
}
