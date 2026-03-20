'use client'

import { useRef, useCallback, useEffect } from 'react'
import {
  RefreshCw,
  Filter,
  MailOpen,
  Mail,
  Star,
  Archive,
  Trash2,
  Inbox,
} from 'lucide-react'
import { useMailStore } from '@/lib/store'
import { useEmails } from '@/hooks/useEmails'
import { api } from '@/lib/api'
import { EmailItem } from '@/components/EmailItem'
import { TopBar } from '@/components/TopBar'

function SkeletonItem() {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-[#e8ecf4]">
      <div className="skeleton w-4 h-4 rounded mt-0.5 flex-shrink-0" />
      <div className="skeleton w-8 h-8 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex justify-between gap-2">
          <div className="skeleton h-3 w-28 rounded" />
          <div className="skeleton h-3 w-10 rounded" />
        </div>
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-3/4 rounded" />
      </div>
    </div>
  )
}

export function EmailList() {
  const {
    activeFolder,
    emails,
    selectedEmail,
    selectedIds,
    totalEmails,
    currentPage,
    searchQuery,
    toggleSelect,
    selectAll,
    clearSelection,
    updateEmail,
    removeEmail,
    setPage,
    setSearch,
    addToast,
    setUnreadCounts,
  } = useMailStore()

  const { isLoading, refresh } = useEmails()
  const bottomRef = useRef<HTMLDivElement>(null)

  const handleSearch = useCallback(
    (q: string) => {
      setSearch(q)
    },
    [setSearch]
  )

  const folderTitle =
    activeFolder === 'INBOX'
      ? 'Inbox'
      : activeFolder.startsWith('label:')
      ? 'Label'
      : activeFolder

  const handleBulkMarkRead = async () => {
    const ids = Array.from(selectedIds)
    try {
      await api.bulkUpdate(ids, 'mark_read')
      ids.forEach((id) => updateEmail(id, { is_read: true }))
      clearSelection()
      addToast({ type: 'success', message: `Marked ${ids.length} emails as read` })
    } catch {
      addToast({ type: 'error', message: 'Failed to mark as read' })
    }
  }

  const handleBulkMarkUnread = async () => {
    const ids = Array.from(selectedIds)
    try {
      await api.bulkUpdate(ids, 'mark_unread')
      ids.forEach((id) => updateEmail(id, { is_read: false }))
      clearSelection()
      addToast({ type: 'success', message: `Marked ${ids.length} emails as unread` })
    } catch {
      addToast({ type: 'error', message: 'Failed to mark as unread' })
    }
  }

  const handleBulkFlag = async () => {
    const ids = Array.from(selectedIds)
    try {
      await api.bulkUpdate(ids, 'flag')
      ids.forEach((id) => updateEmail(id, { is_flagged: true }))
      clearSelection()
      addToast({ type: 'success', message: `Flagged ${ids.length} emails` })
    } catch {
      addToast({ type: 'error', message: 'Failed to flag emails' })
    }
  }

  const handleBulkArchive = async () => {
    const ids = Array.from(selectedIds)
    try {
      await api.bulkUpdate(ids, 'move', 'Archive')
      ids.forEach((id) => removeEmail(id))
      clearSelection()
      addToast({ type: 'success', message: `Archived ${ids.length} emails` })
    } catch {
      addToast({ type: 'error', message: 'Failed to archive emails' })
    }
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    try {
      await api.bulkUpdate(ids, 'delete')
      ids.forEach((id) => removeEmail(id))
      clearSelection()
      addToast({ type: 'success', message: `Deleted ${ids.length} emails` })
    } catch {
      addToast({ type: 'error', message: 'Failed to delete emails' })
    }
  }

  const handleRefresh = async () => {
    try {
      await refresh()
      const counts = await api.getUnreadCounts()
      setUnreadCounts(counts)
    } catch {
      addToast({ type: 'error', message: 'Failed to refresh' })
    }
  }

  // Infinite scroll — simple page increment
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && emails.length < totalEmails && !isLoading) {
          setPage(currentPage + 1)
        }
      },
      { threshold: 0.5 }
    )
    const el = bottomRef.current
    if (el) observer.observe(el)
    return () => { if (el) observer.unobserve(el) }
  }, [emails.length, totalEmails, isLoading, currentPage, setPage])

  const anyChecked = selectedIds.size > 0
  const allChecked = emails.length > 0 && selectedIds.size === emails.length

  return (
    <div className="flex flex-col h-full">
      {/* TopBar with search */}
      <TopBar onSearch={handleSearch} />

      {/* List header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#e8ecf4] bg-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={allChecked ? clearSelection : selectAll}
            className="w-4 h-4 rounded border-[#e8ecf4] text-[#667eea] focus:ring-[#667eea] cursor-pointer"
            aria-label="Select all"
          />
          <h2 className="text-sm font-semibold text-[#2d3748]">{folderTitle}</h2>
          {totalEmails > 0 && (
            <span className="text-xs text-[#718096]">({totalEmails})</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-[#718096] hover:text-[#2d3748] hover:bg-[#f7f8fc] transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            className="p-1.5 rounded-lg text-[#718096] hover:text-[#2d3748] hover:bg-[#f7f8fc] transition-colors"
            title="Filter"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bulk toolbar */}
      {anyChecked && (
        <div className="flex items-center gap-1 px-3 py-2 bg-[#f0f4ff] border-b border-[#e8ecf4] flex-shrink-0">
          <span className="text-xs font-medium text-[#667eea] mr-1">
            {selectedIds.size} selected
          </span>
          <button
            onClick={handleBulkMarkRead}
            className="p-1.5 rounded text-[#718096] hover:text-[#2d3748] hover:bg-white transition-colors"
            title="Mark read"
          >
            <MailOpen className="w-4 h-4" />
          </button>
          <button
            onClick={handleBulkMarkUnread}
            className="p-1.5 rounded text-[#718096] hover:text-[#2d3748] hover:bg-white transition-colors"
            title="Mark unread"
          >
            <Mail className="w-4 h-4" />
          </button>
          <button
            onClick={handleBulkFlag}
            className="p-1.5 rounded text-[#718096] hover:text-[#2d3748] hover:bg-white transition-colors"
            title="Flag"
          >
            <Star className="w-4 h-4" />
          </button>
          <button
            onClick={handleBulkArchive}
            className="p-1.5 rounded text-[#718096] hover:text-[#2d3748] hover:bg-white transition-colors"
            title="Archive"
          >
            <Archive className="w-4 h-4" />
          </button>
          <button
            onClick={handleBulkDelete}
            className="p-1.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Email list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && emails.length === 0 ? (
          <>
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
          </>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 px-6">
            <div className="w-16 h-16 rounded-full bg-[#f0f4ff] flex items-center justify-center mb-4">
              <Inbox className="w-8 h-8 text-[#667eea]" />
            </div>
            <p className="text-sm font-medium text-[#2d3748] mb-1">
              {searchQuery ? 'No results found' : 'No emails here'}
            </p>
            <p className="text-xs text-[#718096] text-center">
              {searchQuery
                ? `No emails match "${searchQuery}"`
                : `${folderTitle} is empty`}
            </p>
          </div>
        ) : (
          <>
            {emails.map((email) => (
              <EmailItem
                key={email.id}
                email={email}
                selected={selectedEmail?.id === email.id}
                checked={selectedIds.has(email.id)}
                onCheck={toggleSelect}
                anyChecked={anyChecked}
              />
            ))}
            {/* Infinite scroll trigger */}
            <div ref={bottomRef} className="h-4" />
            {isLoading && emails.length > 0 && (
              <div className="flex justify-center py-3">
                <div className="w-5 h-5 rounded-full border-2 border-transparent border-t-[#667eea] animate-spin" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
