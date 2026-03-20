'use client'

import { useState } from 'react'
import {
  Mail,
  Inbox,
  Star,
  Send,
  FileText,
  Archive,
  AlertTriangle,
  Trash2,
  PenSquare,
  Tag,
  Plus,
  Users,
  Settings,
  ShieldCheck,
  HardDrive,
  X,
  Loader2,
} from 'lucide-react'
import { useMailStore } from '@/lib/store'
import { api } from '@/lib/api'
import { formatBytes } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  folder?: string
  panel?: string
  badge?: number
}

export function Sidebar() {
  const {
    user,
    activeFolder,
    activePanel,
    unreadCounts,
    labels,
    setActiveFolder,
    setActivePanel,
    openCompose,
    setLabels,
    addToast,
  } = useMailStore()

  const [addingLabel, setAddingLabel] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState('#667eea')
  const [savingLabel, setSavingLabel] = useState(false)

  const mailFolders: NavItem[] = [
    {
      id: 'INBOX',
      label: 'Inbox',
      icon: <Inbox className="w-4 h-4" />,
      folder: 'INBOX',
      badge: unreadCounts['INBOX'],
    },
    {
      id: 'Starred',
      label: 'Starred',
      icon: <Star className="w-4 h-4" />,
      folder: 'Starred',
    },
    {
      id: 'Sent',
      label: 'Sent',
      icon: <Send className="w-4 h-4" />,
      folder: 'Sent',
    },
    {
      id: 'Drafts',
      label: 'Drafts',
      icon: <FileText className="w-4 h-4" />,
      folder: 'Drafts',
      badge: unreadCounts['Drafts'],
    },
    {
      id: 'Archive',
      label: 'Archive',
      icon: <Archive className="w-4 h-4" />,
      folder: 'Archive',
    },
    {
      id: 'Spam',
      label: 'Spam',
      icon: <AlertTriangle className="w-4 h-4" />,
      folder: 'Spam',
      badge: unreadCounts['Spam'],
    },
    {
      id: 'Trash',
      label: 'Trash',
      icon: <Trash2 className="w-4 h-4" />,
      folder: 'Trash',
    },
  ]

  const isActive = (item: NavItem) => {
    if (item.panel) return activePanel === item.panel
    return !activePanel && activeFolder === item.folder
  }

  const handleNavClick = (item: NavItem) => {
    if (item.panel) {
      setActivePanel(item.panel)
    } else if (item.folder) {
      setActiveFolder(item.folder)
    }
  }

  const handleAddLabel = async () => {
    if (!newLabelName.trim()) return
    setSavingLabel(true)
    try {
      const label = await api.createLabel(newLabelName.trim(), newLabelColor)
      setLabels([...labels, label])
      setNewLabelName('')
      setAddingLabel(false)
      addToast({ type: 'success', message: 'Label created' })
    } catch {
      addToast({ type: 'error', message: 'Failed to create label' })
    } finally {
      setSavingLabel(false)
    }
  }

  const usedPercent = user
    ? Math.round((user.used_bytes / Math.max(user.quota_bytes, 1)) * 100)
    : 0
  const storageBarColor =
    usedPercent >= 90 ? '#fc8181' : usedPercent >= 80 ? '#ed8936' : '#48bb78'

  return (
    <div
      className="w-[240px] flex-shrink-0 flex flex-col h-full overflow-hidden"
      style={{ backgroundColor: '#1a1d27' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
        >
          <Mail className="w-4 h-4 text-white" />
        </div>
        <span className="text-white font-semibold text-sm">Enterprise Mail</span>
      </div>

      {/* Compose button */}
      <div className="px-3 py-3">
        <button
          onClick={() => openCompose({ mode: 'new' })}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-white text-sm font-semibold transition-all hover:shadow-lg hover:opacity-90 active:scale-95"
          style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
        >
          <PenSquare className="w-4 h-4" />
          Compose
        </button>
      </div>

      {/* Scrollable nav */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {/* Mail section */}
        <div className="mb-1">
          <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest px-3 py-2">
            Mail
          </p>
          {mailFolders.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors group"
              style={{
                backgroundColor: isActive(item) ? '#2d3748' : 'transparent',
                color: isActive(item) ? '#fff' : 'rgba(255,255,255,0.65)',
                borderLeft: isActive(item) ? '3px solid #667eea' : '3px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (!isActive(item)) {
                  e.currentTarget.style.backgroundColor = '#252836'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.9)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive(item)) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.65)'
                }
              }}
            >
              <div className="flex items-center gap-2.5">
                {item.icon}
                <span>{item.label}</span>
              </div>
              {item.badge && item.badge > 0 ? (
                <Badge count={item.badge} variant="primary" />
              ) : null}
            </button>
          ))}
        </div>

        {/* Labels section */}
        <div className="mb-1 mt-2">
          <div className="flex items-center justify-between px-3 py-2">
            <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest">
              Labels
            </p>
            <button
              onClick={() => setAddingLabel(true)}
              className="text-white/40 hover:text-white/80 transition-colors"
              title="Add label"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {labels.map((label) => (
            <button
              key={label.id}
              onClick={() => setActiveFolder(`label:${label.id}`)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{
                backgroundColor:
                  activeFolder === `label:${label.id}` ? '#2d3748' : 'transparent',
                color:
                  activeFolder === `label:${label.id}`
                    ? '#fff'
                    : 'rgba(255,255,255,0.65)',
              }}
              onMouseEnter={(e) => {
                if (activeFolder !== `label:${label.id}`) {
                  e.currentTarget.style.backgroundColor = '#252836'
                }
              }}
              onMouseLeave={(e) => {
                if (activeFolder !== `label:${label.id}`) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }
              }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: label.color }}
              />
              <span className="truncate">{label.name}</span>
            </button>
          ))}

          {addingLabel && (
            <div className="mx-2 mt-1 p-2 bg-white/10 rounded-lg">
              <input
                autoFocus
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddLabel()
                  if (e.key === 'Escape') setAddingLabel(false)
                }}
                placeholder="Label name…"
                className="w-full bg-white/10 text-white text-xs placeholder-white/40 px-2 py-1 rounded mb-1.5 outline-none focus:ring-1 focus:ring-white/30"
              />
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newLabelColor}
                  onChange={(e) => setNewLabelColor(e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                  title="Pick color"
                />
                <button
                  onClick={handleAddLabel}
                  disabled={savingLabel || !newLabelName.trim()}
                  className="flex-1 text-xs bg-[#667eea] text-white rounded px-2 py-1 disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {savingLabel ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Add
                </button>
                <button
                  onClick={() => setAddingLabel(false)}
                  className="text-white/40 hover:text-white/80"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* More section */}
        <div className="mt-2">
          <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest px-3 py-2">
            More
          </p>
          {[
            { id: 'contacts', label: 'Contacts', icon: <Users className="w-4 h-4" />, panel: 'contacts' },
            { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" />, panel: 'settings' },
            ...(user?.is_admin
              ? [{ id: 'admin', label: 'Admin', icon: <ShieldCheck className="w-4 h-4" />, panel: 'admin' }]
              : []),
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item as NavItem)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{
                backgroundColor: activePanel === item.panel ? '#2d3748' : 'transparent',
                color:
                  activePanel === item.panel ? '#fff' : 'rgba(255,255,255,0.65)',
                borderLeft:
                  activePanel === item.panel
                    ? '3px solid #667eea'
                    : '3px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (activePanel !== item.panel) {
                  e.currentTarget.style.backgroundColor = '#252836'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.9)'
                }
              }}
              onMouseLeave={(e) => {
                if (activePanel !== item.panel) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.65)'
                }
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Storage bar */}
      {user && (
        <div className="px-4 py-3 border-t border-white/5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <HardDrive className="w-3.5 h-3.5 text-white/40" />
            <span className="text-white/40 text-xs">
              {formatBytes(user.used_bytes)} / {formatBytes(user.quota_bytes)}
            </span>
            <span className="ml-auto text-white/30 text-xs">{usedPercent}%</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(usedPercent, 100)}%`,
                backgroundColor: storageBarColor,
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
