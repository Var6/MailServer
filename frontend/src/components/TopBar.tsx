'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, Bell, Settings, ShieldCheck, LogOut, Keyboard, User } from 'lucide-react'
import { useMailStore } from '@/lib/store'
import { useAuth } from '@/hooks/useAuth'
import { Avatar } from '@/components/ui/Avatar'
import { getAvatarColor } from '@/lib/utils'

interface TopBarProps {
  onSearch: (q: string) => void
}

export function TopBar({ onSearch }: TopBarProps) {
  const { user } = useMailStore()
  const { logout } = useAuth()
  const { setActivePanel } = useMailStore()

  const [query, setQuery] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = useCallback(
    (value: string) => {
      setQuery(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onSearch(value)
      }, 300)
    },
    [onSearch]
  )

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const avatarColor = user?.avatar_color || getAvatarColor(user?.email || '')

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-[#e8ecf4] flex-shrink-0">
      {/* Search */}
      <div className="flex-1 relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#718096]" />
        <input
          id="search-input"
          type="search"
          value={query}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search emails…"
          className="w-full pl-9 pr-4 py-2 bg-[#f7f8fc] border border-[#e8ecf4] rounded-lg text-sm text-[#2d3748] placeholder-[#a0aec0] focus:outline-none focus:ring-2 focus:ring-[#667eea]/30 focus:border-[#667eea] focus:bg-white transition-all"
        />
      </div>

      {/* Bell */}
      <button
        className="relative p-2 rounded-lg text-[#718096] hover:text-[#2d3748] hover:bg-[#f7f8fc] transition-colors"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
      </button>

      {/* User avatar + dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 p-1 rounded-lg hover:bg-[#f7f8fc] transition-colors"
          aria-label="User menu"
          aria-expanded={dropdownOpen}
        >
          <Avatar
            name={user?.display_name || user?.email || 'U'}
            color={avatarColor}
            size="sm"
          />
          <span className="text-sm font-medium text-[#2d3748] hidden md:block max-w-[120px] truncate">
            {user?.display_name || user?.email}
          </span>
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-[#e8ecf4] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.1)] z-50 overflow-hidden fade-in">
            {/* User info */}
            <div className="px-4 py-3 border-b border-[#e8ecf4]">
              <p className="text-sm font-semibold text-[#2d3748] truncate">
                {user?.display_name}
              </p>
              <p className="text-xs text-[#718096] truncate">{user?.email}</p>
            </div>

            <div className="py-1">
              <button
                onClick={() => { setActivePanel('settings'); setDropdownOpen(false) }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#2d3748] hover:bg-[#f7f8fc] transition-colors"
              >
                <User className="w-4 h-4 text-[#718096]" />
                Profile
              </button>
              <button
                onClick={() => { setActivePanel('settings'); setDropdownOpen(false) }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#2d3748] hover:bg-[#f7f8fc] transition-colors"
              >
                <Settings className="w-4 h-4 text-[#718096]" />
                Settings
              </button>
              {user?.is_admin && (
                <button
                  onClick={() => { setActivePanel('admin'); setDropdownOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#2d3748] hover:bg-[#f7f8fc] transition-colors"
                >
                  <ShieldCheck className="w-4 h-4 text-[#718096]" />
                  Admin Panel
                </button>
              )}
            </div>

            <div className="border-t border-[#e8ecf4] py-1">
              <button
                onClick={() => setDropdownOpen(false)}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#2d3748] hover:bg-[#f7f8fc] transition-colors"
              >
                <Keyboard className="w-4 h-4 text-[#718096]" />
                Keyboard Shortcuts
              </button>
            </div>

            <div className="border-t border-[#e8ecf4] py-1">
              <button
                onClick={() => { setDropdownOpen(false); logout() }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
