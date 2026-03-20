'use client'

import { useState, useRef, useEffect } from 'react'
import { Star, Paperclip, Reply, Forward, Archive, Trash2, MailOpen, Mail } from 'lucide-react'
import type { Email } from '@/lib/types'
import { useMailStore } from '@/lib/store'
import { api } from '@/lib/api'
import { formatDate, getEmailName, getAvatarColor, cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'

interface EmailItemProps {
  email: Email
  selected: boolean
  checked: boolean
  onCheck: (id: string) => void
  anyChecked: boolean
}

interface ContextMenu {
  x: number
  y: number
}

export function EmailItem({ email, selected, checked, onCheck, anyChecked }: EmailItemProps) {
  const {
    setSelectedEmail,
    updateEmail,
    removeEmail,
    addToast,
    openCompose,
  } = useMailStore()

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [hovering, setHovering] = useState(false)
  const contextRef = useRef<HTMLDivElement>(null)

  const senderName = getEmailName(email.from_addr)
  const avatarColor = getAvatarColor(email.from_addr)

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const handler = (e: MouseEvent) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [contextMenu])

  const handleClick = async () => {
    setSelectedEmail(email)
    if (!email.is_read) {
      try {
        await api.markRead(email.id)
        updateEmail(email.id, { is_read: true })
      } catch { /* silent */ }
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleFlag = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      if (email.is_flagged) {
        await api.unflagEmail(email.id)
        updateEmail(email.id, { is_flagged: false })
      } else {
        await api.flagEmail(email.id)
        updateEmail(email.id, { is_flagged: true })
      }
    } catch {
      addToast({ type: 'error', message: 'Failed to update flag' })
    }
  }

  const handleMarkRead = async () => {
    try {
      await api.markRead(email.id)
      updateEmail(email.id, { is_read: true })
    } catch {
      addToast({ type: 'error', message: 'Failed to mark as read' })
    }
    setContextMenu(null)
  }

  const handleMarkUnread = async () => {
    try {
      await api.markUnread(email.id)
      updateEmail(email.id, { is_read: false })
    } catch {
      addToast({ type: 'error', message: 'Failed to mark as unread' })
    }
    setContextMenu(null)
  }

  const handleArchive = async () => {
    try {
      await api.moveEmail(email.id, 'Archive')
      removeEmail(email.id)
      addToast({ type: 'success', message: 'Moved to Archive' })
    } catch {
      addToast({ type: 'error', message: 'Failed to archive' })
    }
    setContextMenu(null)
  }

  const handleDelete = async () => {
    try {
      await api.deleteEmail(email.id)
      removeEmail(email.id)
      addToast({ type: 'success', message: 'Email deleted' })
    } catch {
      addToast({ type: 'error', message: 'Failed to delete email' })
    }
    setContextMenu(null)
  }

  const bg = selected
    ? '#ede9fe'
    : !email.is_read
    ? '#f0f4ff'
    : 'white'

  return (
    <>
      <div
        className={cn(
          'relative flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-[#e8ecf4] transition-colors group',
          selected && 'ring-inset ring-1 ring-[#667eea]/40'
        )}
        style={{ backgroundColor: bg }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        role="button"
        aria-selected={selected}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
      >
        {/* Checkbox */}
        <div
          className={cn(
            'flex-shrink-0 mt-0.5 transition-opacity',
            hovering || anyChecked || checked ? 'opacity-100' : 'opacity-0'
          )}
          onClick={(e) => { e.stopPropagation(); onCheck(email.id) }}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={() => onCheck(email.id)}
            className="w-4 h-4 rounded border-[#e8ecf4] text-[#667eea] focus:ring-[#667eea] cursor-pointer"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select email from ${senderName}`}
          />
        </div>

        {/* Avatar */}
        <Avatar name={senderName} color={avatarColor} size="sm" />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span
              className={cn(
                'text-sm truncate',
                !email.is_read ? 'font-semibold text-[#2d3748]' : 'font-medium text-[#4a5568]'
              )}
            >
              {senderName}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {email.is_flagged && (
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              )}
              {email.has_attachments && (
                <Paperclip className="w-3 h-3 text-[#718096]" />
              )}
              <span className="text-xs text-[#718096]">{formatDate(email.created_at)}</span>
            </div>
          </div>

          <p
            className={cn(
              'text-sm truncate mb-0.5',
              !email.is_read ? 'font-medium text-[#2d3748]' : 'text-[#4a5568]'
            )}
          >
            {email.subject || '(No subject)'}
          </p>

          <div className="flex items-center gap-2">
            <p className="text-xs text-[#718096] truncate flex-1">
              {email.body_text?.slice(0, 100) || ''}
            </p>
            {/* Label dots */}
            {email.labels?.map((label) => (
              <span
                key={label.id}
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: label.color }}
                title={label.name}
              />
            ))}
          </div>
        </div>

        {/* Flag button — always rendered but only visible on hover */}
        <button
          onClick={handleFlag}
          className={cn(
            'flex-shrink-0 p-1 rounded transition-colors mt-0.5',
            email.is_flagged
              ? 'text-yellow-400'
              : 'text-transparent group-hover:text-[#718096] hover:!text-yellow-400'
          )}
          title={email.is_flagged ? 'Unflag' : 'Flag'}
          aria-label={email.is_flagged ? 'Unflag email' : 'Flag email'}
        >
          <Star
            className="w-4 h-4"
            fill={email.is_flagged ? 'currentColor' : 'none'}
          />
        </button>

        {/* Unread dot */}
        {!email.is_read && (
          <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#667eea]" />
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextRef}
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            className="context-menu-item"
            onClick={() => {
              setContextMenu(null)
              openCompose({
                mode: 'reply',
                replyTo: email.from_addr,
                subject: `Re: ${email.subject}`,
              })
            }}
          >
            <Reply className="w-4 h-4" />
            Reply
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              setContextMenu(null)
              openCompose({ mode: 'forward', subject: `Fwd: ${email.subject}` })
            }}
          >
            <Forward className="w-4 h-4" />
            Forward
          </button>
          <div className="context-menu-separator" />
          {email.is_read ? (
            <button className="context-menu-item" onClick={handleMarkUnread}>
              <Mail className="w-4 h-4" />
              Mark as Unread
            </button>
          ) : (
            <button className="context-menu-item" onClick={handleMarkRead}>
              <MailOpen className="w-4 h-4" />
              Mark as Read
            </button>
          )}
          <button
            className="context-menu-item"
            onClick={() => {
              setContextMenu(null)
              handleFlag({ stopPropagation: () => {} } as React.MouseEvent)
            }}
          >
            <Star className="w-4 h-4" />
            {email.is_flagged ? 'Unflag' : 'Flag'}
          </button>
          <div className="context-menu-separator" />
          <button className="context-menu-item" onClick={handleArchive}>
            <Archive className="w-4 h-4" />
            Archive
          </button>
          <button className="context-menu-item danger" onClick={handleDelete}>
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      )}
    </>
  )
}
