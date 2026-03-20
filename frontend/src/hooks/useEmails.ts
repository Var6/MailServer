'use client'

import useSWR from 'swr'
import { useMailStore } from '@/lib/store'
import { api } from '@/lib/api'
import type { EmailsResponse } from '@/lib/types'
import { useEffect } from 'react'

export function useEmails() {
  const { activeFolder, currentPage, searchQuery, setEmails, addToast } =
    useMailStore()

  const key = `emails:${activeFolder}:${currentPage}:${searchQuery}`

  const { data, error, isLoading, mutate } = useSWR<EmailsResponse>(
    key,
    () => api.getEmails(activeFolder, currentPage, searchQuery || undefined),
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  )

  useEffect(() => {
    if (data) {
      setEmails(data.emails, data.total)
    }
  }, [data, setEmails])

  useEffect(() => {
    if (error) {
      addToast({ type: 'error', message: 'Failed to load emails' })
    }
  }, [error, addToast])

  return {
    emails: data?.emails ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    refresh: mutate,
  }
}
