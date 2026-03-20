'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Reply,
  Forward,
  Star,
  Archive,
  Trash2,
  ChevronDown,
  Paperclip,
  Download,
  MailOpen,
  ArrowLeft,
  Mail,
} from 'lucide-react'
import { useMailStore } from '@/lib/store'
import { api } from '@/lib/api'
import { Avatar } from '@/components/ui/Avatar'
import { formatDateLong, formatBytes, getEmailName, getAvatarColor } from '@/lib/utils'
import type { Email } from '@/lib/types'

function AttachmentChip({
  emailId,
  attachment,
}: {
  emailId: string
  attachment: Email['attachments'][0]
}) {
  const addToast = useMailStore((s) => s.addToast)
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const blob = await api.getAttachment(emailId, attachment.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = attachment.filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      addToast({ type: 'error', message: 'Failed to download attachment' })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="attachment-chip group">
      <Paperclip className="w-3.5 h-3.5 text-[#718096]" />
      <span className="text-xs text-[#2d3748] max-w-[140px] truncate">{attachment.filename}</span>
      <span className="text-xs text-[#718096]">({formatBytes(attachment.size_bytes)})</span>
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="ml-1 p-0.5 rounded text-[#718096] hover:text-[#667eea] opacity-0 group-hover:opacity-100 transition-opacity"
        title="Download"
      >
        <Download className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function EmailIframe({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) return

    doc.open()
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 14px;
            line-height: 1.6;
            color: #2d3748;
            margin: 0;
            padding: 0;
            word-wrap: break-word;
            overflow-wrap: break-word;
          }
          img { max-width: 100%; height: auto; }
          a { color: #667eea; }
          blockquote {
            border-left: 3px solid #e8ecf4;
            padding-left: 12px;
            color: #718096;
            margin: 8px 0;
          }
          pre { white-space: pre-wrap; word-wrap: break-word; }
        </style>
      </head>
      <body>${html}</body>
      </html>
    `)
    doc.close()

    // Auto-resize
    const resize = () => {
      if (iframe.contentDocument?.body) {
        iframe.style.height = iframe.contentDocument.body.scrollHeight + 'px'
      }
    }
    iframe.onload = resize
    resize()
  }, [html])

  return (
    <iframe
      ref={iframeRef}
      className="email-iframe w-full"
      sandbox="allow-same-origin"
      title="Email body"
    />
  )
}

export function EmailView() {
  const {
    selectedEmail: email,
    updateEmail,
    removeEmail,
    openCompose,
    addToast,
  } = useMailStore()

  const [showDetails, setShowDetails] = useState(false)
  const [moveDropdown, setMoveDropdown] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const moveRef = useRef<HTMLDivElement>(null)

  // Keyboard shortcuts for active email
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!email) return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      switch (e.key) {
        case 'r':
        case 'R':
          e.preventDefault()
          openCompose({
            mode: 'reply',
            to: [email.from_addr],
            subject: `Re: ${email.subject}`,
          })
          break
        case 'f':
        case 'F':
          e.preventDefault()
          openCompose({ mode: 'forward', subject: `Fwd: ${email.subject}` })
          break
        case 'e':
        case 'E':
          e.preventDefault()
          handleArchive()
          break
        case '#':
          e.preventDefault()
          handleDelete()
          break
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [email, openCompose]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Close move dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moveRef.current && !moveRef.current.contains(e.target as Node)) {
        setMoveDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleFlag = async () => {
    if (!email) return
    setLoading('flag')
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
    } finally {
      setLoading(null)
    }
  }

  const handleArchive = async () => {
    if (!email) return
    setLoading('archive')
    try {
      await api.moveEmail(email.id, 'Archive')
      removeEmail(email.id)
      addToast({ type: 'success', message: 'Moved to Archive' })
    } catch {
      addToast({ type: 'error', message: 'Failed to archive' })
    } finally {
      setLoading(null)
    }
  }

  const handleDelete = async () => {
    if (!email) return
    setLoading('delete')
    try {
      await api.deleteEmail(email.id)
      removeEmail(email.id)
      addToast({ type: 'success', message: 'Email deleted' })
    } catch {
      addToast({ type: 'error', message: 'Failed to delete email' })
    } finally {
      setLoading(null)
    }
  }

  const handleMove = async (folder: string) => {
    if (!email) return
    setMoveDropdown(false)
    try {
      await api.moveEmail(email.id, folder)
      removeEmail(email.id)
      addToast({ type: 'success', message: `Moved to ${folder}` })
    } catch {
      addToast({ type: 'error', message: 'Failed to move email' })
    }
  }

  // Empty state
  if (!email) {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#f7f8fc]">
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <div className="w-20 h-20 rounded-full bg-white shadow-card flex items-center justify-center mb-5">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="20" fill="url(#emailGrad)" />
              <path
                d="M8 14l10.667 7.111a2 2 0 002.666 0L32 14M10 28h20a2 2 0 002-2V14a2 2 0 00-2-2H10a2 2 0 00-2 2v12a2 2 0 002 2z"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient id="emailGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#667eea" />
                  <stop offset="1" stopColor="#764ba2" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h3 className="text-base font-semibold text-[#2d3748] mb-2">Select an email to read it</h3>
          <p className="text-sm text-[#718096] text-center max-w-xs">
            Choose an email from the list on the left to view its contents here.
          </p>
          <div className="mt-6 flex flex-col gap-1 text-xs text-[#718096]">
            <p><kbd className="bg-white border border-[#e8ecf4] rounded px-1.5 py-0.5 font-mono text-[#2d3748]">C</kbd> Compose</p>
            <p><kbd className="bg-white border border-[#e8ecf4] rounded px-1.5 py-0.5 font-mono text-[#2d3748]">R</kbd> Reply</p>
            <p><kbd className="bg-white border border-[#e8ecf4] rounded px-1.5 py-0.5 font-mono text-[#2d3748]">F</kbd> Forward</p>
            <p><kbd className="bg-white border border-[#e8ecf4] rounded px-1.5 py-0.5 font-mono text-[#2d3748]">E</kbd> Archive &nbsp; <kbd className="bg-white border border-[#e8ecf4] rounded px-1.5 py-0.5 font-mono text-[#2d3748]">#</kbd> Delete</p>
            <p><kbd className="bg-white border border-[#e8ecf4] rounded px-1.5 py-0.5 font-mono text-[#2d3748]">?</kbd> All shortcuts</p>
          </div>
        </div>
      </div>
    )
  }

  const senderName = getEmailName(email.from_addr)
  const avatarColor = getAvatarColor(email.from_addr)
  const folders = ['INBOX', 'Archive', 'Spam', 'Trash', 'Drafts']

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden slide-in-right">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 py-2.5 border-b border-[#e8ecf4] flex-shrink-0">
        <button
          onClick={() => openCompose({ mode: 'reply', to: [email.from_addr], subject: `Re: ${email.subject}` })}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[#2d3748] hover:bg-[#f7f8fc] transition-colors font-medium"
          title="Reply (R)"
        >
          <Reply className="w-4 h-4" />
          Reply
        </button>
        <button
          onClick={() => openCompose({ mode: 'reply-all', subject: `Re: ${email.subject}` })}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[#2d3748] hover:bg-[#f7f8fc] transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Reply All
        </button>
        <button
          onClick={() => openCompose({ mode: 'forward', subject: `Fwd: ${email.subject}` })}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[#2d3748] hover:bg-[#f7f8fc] transition-colors font-medium"
          title="Forward (F)"
        >
          <Forward className="w-4 h-4" />
          Forward
        </button>

        <div className="flex-1" />

        <button
          onClick={handleFlag}
          disabled={loading === 'flag'}
          className={`p-2 rounded-lg transition-colors ${
            email.is_flagged
              ? 'text-yellow-500 bg-yellow-50 hover:bg-yellow-100'
              : 'text-[#718096] hover:bg-[#f7f8fc] hover:text-yellow-500'
          }`}
          title={email.is_flagged ? 'Unflag' : 'Flag'}
        >
          <Star
            className="w-4 h-4"
            fill={email.is_flagged ? 'currentColor' : 'none'}
          />
        </button>

        {/* Move dropdown */}
        <div className="relative" ref={moveRef}>
          <button
            onClick={() => setMoveDropdown(!moveDropdown)}
            className="flex items-center gap-1 p-2 rounded-lg text-[#718096] hover:bg-[#f7f8fc] hover:text-[#2d3748] transition-colors"
            title="Move to folder"
          >
            <Mail className="w-4 h-4" />
            <ChevronDown className="w-3 h-3" />
          </button>
          {moveDropdown && (
            <div className="dropdown absolute right-0 top-full mt-1 w-40">
              {folders.map((f) => (
                <button
                  key={f}
                  onClick={() => handleMove(f)}
                  className="w-full text-left px-3 py-2 text-sm text-[#2d3748] hover:bg-[#f7f8fc] transition-colors"
                >
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleArchive}
          disabled={loading === 'archive'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[#718096] hover:bg-[#f7f8fc] hover:text-[#2d3748] transition-colors"
          title="Archive (E)"
        >
          <Archive className="w-4 h-4" />
          Archive
        </button>

        <button
          onClick={handleDelete}
          disabled={loading === 'delete'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          title="Delete (#)"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6">
          {/* Subject */}
          <h1 className="text-xl font-bold text-[#2d3748] mb-4 leading-tight">
            {email.subject || '(No subject)'}
          </h1>

          {/* Sender info */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex items-start gap-3">
              <Avatar name={senderName} color={avatarColor} size="md" />
              <div>
                <p className="font-semibold text-sm text-[#2d3748]">{senderName}</p>
                <p className="text-xs text-[#718096]">{email.from_addr}</p>
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-xs text-[#667eea] hover:underline mt-0.5 flex items-center gap-1"
                >
                  {showDetails ? 'Hide details' : 'Show details'}
                  <ChevronDown
                    className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-180' : ''}`}
                  />
                </button>

                {showDetails && (
                  <div className="mt-2 space-y-1">
                    {email.to_addrs.length > 0 && (
                      <p className="text-xs text-[#718096]">
                        <span className="font-medium text-[#2d3748]">To: </span>
                        {email.to_addrs.join(', ')}
                      </p>
                    )}
                    {email.cc.length > 0 && (
                      <p className="text-xs text-[#718096]">
                        <span className="font-medium text-[#2d3748]">CC: </span>
                        {email.cc.join(', ')}
                      </p>
                    )}
                    <p className="text-xs text-[#718096]">
                      <span className="font-medium text-[#2d3748]">Date: </span>
                      {formatDateLong(email.created_at)}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-[#718096] flex-shrink-0">
              {formatDateLong(email.created_at)}
            </p>
          </div>

          {/* Labels */}
          {email.labels?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {email.labels.map((label) => (
                <span
                  key={label.id}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: label.color }}
                >
                  {label.name}
                </span>
              ))}
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-[#e8ecf4] mb-5" />

          {/* Email body */}
          <div className="email-body">
            {email.body_html ? (
              <EmailIframe html={email.body_html} />
            ) : (
              <pre className="text-sm text-[#2d3748] whitespace-pre-wrap leading-relaxed font-sans">
                {email.body_text}
              </pre>
            )}
          </div>

          {/* Attachments */}
          {email.has_attachments && email.attachments?.length > 0 && (
            <div className="mt-6 pt-5 border-t border-[#e8ecf4]">
              <p className="text-xs font-semibold text-[#718096] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5" />
                Attachments ({email.attachments.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {email.attachments.map((att) => (
                  <AttachmentChip key={att.id} emailId={email.id} attachment={att} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick reply bar */}
      <div className="flex-shrink-0 px-6 pb-5 pt-3 border-t border-[#e8ecf4] bg-[#f7f8fc]">
        <button
          onClick={() => openCompose({ mode: 'reply', to: [email.from_addr], subject: `Re: ${email.subject}` })}
          className="w-full flex items-center gap-2 px-4 py-2.5 bg-white border border-[#e8ecf4] rounded-xl text-sm text-[#718096] hover:border-[#667eea] hover:text-[#667eea] transition-colors cursor-text"
        >
          <Reply className="w-4 h-4 flex-shrink-0" />
          <span>Reply to {senderName}…</span>
        </button>
      </div>
    </div>
  )
}
