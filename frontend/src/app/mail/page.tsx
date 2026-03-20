'use client'

import { useEffect, useCallback } from 'react'
import { useMailStore } from '@/lib/store'
import { api } from '@/lib/api'
import { Sidebar } from '@/components/Sidebar'
import { EmailList } from '@/components/EmailList'
import { EmailView } from '@/components/EmailView'
import { ComposeModal } from '@/components/ComposeModal'
import { SettingsPanel } from '@/components/SettingsPanel'
import { AdminPanel } from '@/components/AdminPanel'
import { ContactsPanel } from '@/components/ContactsPanel'
import { useWebSocket } from '@/hooks/useWebSocket'

export default function MailPage() {
  const {
    activePanel,
    composeOpen,
    setUnreadCounts,
    openCompose,
    selectedEmail,
    setSearch,
    addToast,
  } = useMailStore()

  // Init WebSocket
  useWebSocket()

  // Fetch unread counts on mount
  useEffect(() => {
    api
      .getUnreadCounts()
      .then(setUnreadCounts)
      .catch(() => {/* silent */})
  }, [setUnreadCounts])

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable

      // '/' focuses search — allow always
      if (e.key === '/' && !isInput) {
        e.preventDefault()
        const searchInput = document.getElementById('search-input')
        if (searchInput) searchInput.focus()
        return
      }

      if (isInput) return

      switch (e.key) {
        case 'c':
        case 'C':
          e.preventDefault()
          openCompose({ mode: 'new' })
          break
        case '?':
          addToast({
            type: 'info',
            message: 'Shortcuts: C=Compose  /=Search  R=Reply  F=Forward  E=Archive  #=Delete',
            duration: 6000,
          })
          break
      }
    },
    [openCompose, addToast]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const renderMainContent = () => {
    if (activePanel === 'settings') return <SettingsPanel />
    if (activePanel === 'admin') return <AdminPanel />
    if (activePanel === 'contacts') return <ContactsPanel />
    return null
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f8fc]">
      {/* Sidebar */}
      <Sidebar />

      {/* Main area */}
      <div className="flex flex-1 min-w-0 overflow-hidden">
        {activePanel ? (
          /* Panel mode: full width panel */
          <div className="flex-1 overflow-hidden">
            {renderMainContent()}
          </div>
        ) : (
          /* Mail mode: email list + reading pane */
          <>
            {/* Email list column */}
            <div className="w-[360px] flex-shrink-0 border-r border-[#e8ecf4] overflow-hidden flex flex-col bg-white">
              <EmailList />
            </div>

            {/* Reading pane */}
            <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
              <EmailView />
            </div>
          </>
        )}
      </div>

      {/* Compose modal */}
      {composeOpen && <ComposeModal />}
    </div>
  )
}
