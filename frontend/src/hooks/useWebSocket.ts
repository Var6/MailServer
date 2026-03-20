'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useMailStore } from '@/lib/store'
import type { Email } from '@/lib/types'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080'
const PING_INTERVAL = 25000
const MAX_RECONNECT_DELAY = 30000
const BASE_RECONNECT_DELAY = 1000

export function useWebSocket() {
  const { accessToken, addToast, setUnreadCounts, emails, setEmails, totalEmails } =
    useMailStore()

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const shouldConnectRef = useRef(true)

  const clearTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
    }
  }, [])

  const connect = useCallback(() => {
    if (!accessToken || !shouldConnectRef.current) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      const ws = new WebSocket(`${WS_URL}/ws?token=${accessToken}`)
      wsRef.current = ws

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, PING_INTERVAL)
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string)

          if (msg.type === 'pong') return

          if (msg.type === 'new_email') {
            const newEmail = msg.data as Email
            const { emails: current, totalEmails: total } = useMailStore.getState()
            if (newEmail.folder === useMailStore.getState().activeFolder) {
              setEmails([newEmail, ...current], total + 1)
            }
            addToast({
              type: 'info',
              message: `New email from ${newEmail.from_addr}`,
            })
          }

          if (msg.type === 'unread_count') {
            setUnreadCounts(msg.data as Record<string, number>)
          }
        } catch {
          // ignore parse errors
        }
      }

      ws.onerror = () => {
        // handled in onclose
      }

      ws.onclose = () => {
        clearTimers()
        if (!shouldConnectRef.current) return

        const delay = Math.min(
          BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current),
          MAX_RECONNECT_DELAY
        )
        reconnectAttemptsRef.current++

        reconnectTimeoutRef.current = setTimeout(() => {
          connect()
        }, delay)
      }
    } catch {
      // Failed to create WebSocket
    }
  }, [accessToken, addToast, setUnreadCounts, setEmails, clearTimers])

  const disconnect = useCallback(() => {
    shouldConnectRef.current = false
    clearTimers()
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [clearTimers])

  useEffect(() => {
    if (accessToken) {
      shouldConnectRef.current = true
      connect()
    } else {
      disconnect()
    }

    return () => {
      // Don't fully disconnect on re-render, just on token loss
    }
  }, [accessToken]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return { disconnect }
}
