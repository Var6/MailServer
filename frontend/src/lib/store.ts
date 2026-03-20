import { create } from 'zustand'
import type { User, Email, Label, Contact, UnreadCounts, Toast, ComposeData } from './types'

interface MailStore {
  // Auth
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  setUser: (user: User) => void
  setTokens: (access: string, refresh?: string) => void
  clearAuth: () => void

  // Navigation
  activeFolder: string
  activePanel: string | null
  setActiveFolder: (folder: string) => void
  setActivePanel: (panel: string | null) => void

  // Emails
  emails: Email[]
  selectedEmail: Email | null
  selectedIds: Set<string>
  totalEmails: number
  currentPage: number
  searchQuery: string
  unreadCounts: UnreadCounts
  setEmails: (emails: Email[], total: number) => void
  setSelectedEmail: (email: Email | null) => void
  toggleSelect: (id: string) => void
  selectAll: () => void
  clearSelection: () => void
  updateEmail: (id: string, patch: Partial<Email>) => void
  removeEmail: (id: string) => void
  setPage: (page: number) => void
  setSearch: (q: string) => void
  setUnreadCounts: (counts: UnreadCounts) => void

  // Compose
  composeOpen: boolean
  composeData: ComposeData | null
  openCompose: (data?: ComposeData) => void
  closeCompose: () => void

  // Labels
  labels: Label[]
  setLabels: (labels: Label[]) => void

  // Contacts
  contacts: Contact[]
  setContacts: (contacts: Contact[]) => void

  // Toasts
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

export const useMailStore = create<MailStore>((set, get) => ({
  // Auth
  user: null,
  accessToken: null,
  refreshToken: null,
  setUser: (user) => set({ user }),
  setTokens: (access, refresh) => {
    set({ accessToken: access, refreshToken: refresh || null })
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', access)
      if (refresh) localStorage.setItem('refresh_token', refresh)
    }
  },
  clearAuth: () => {
    set({ user: null, accessToken: null, refreshToken: null })
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user')
    }
  },

  // Navigation
  activeFolder: 'INBOX',
  activePanel: null,
  setActiveFolder: (folder) => set({ activeFolder: folder, activePanel: null, selectedEmail: null, currentPage: 1, searchQuery: '' }),
  setActivePanel: (panel) => set({ activePanel: panel, selectedEmail: null }),

  // Emails
  emails: [],
  selectedEmail: null,
  selectedIds: new Set(),
  totalEmails: 0,
  currentPage: 1,
  searchQuery: '',
  unreadCounts: {},
  setEmails: (emails, total) => set({ emails, totalEmails: total }),
  setSelectedEmail: (email) => set({ selectedEmail: email }),
  toggleSelect: (id) => {
    const { selectedIds } = get()
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    set({ selectedIds: next })
  },
  selectAll: () => {
    const { emails } = get()
    set({ selectedIds: new Set(emails.map((e) => e.id)) })
  },
  clearSelection: () => set({ selectedIds: new Set() }),
  updateEmail: (id, patch) => {
    const { emails, selectedEmail } = get()
    const updated = emails.map((e) => (e.id === id ? { ...e, ...patch } : e))
    set({ emails: updated })
    if (selectedEmail?.id === id) {
      set({ selectedEmail: { ...selectedEmail, ...patch } })
    }
  },
  removeEmail: (id) => {
    const { emails, selectedEmail } = get()
    set({ emails: emails.filter((e) => e.id !== id) })
    if (selectedEmail?.id === id) {
      set({ selectedEmail: null })
    }
  },
  setPage: (page) => set({ currentPage: page }),
  setSearch: (q) => set({ searchQuery: q, currentPage: 1 }),
  setUnreadCounts: (counts) => set({ unreadCounts: counts }),

  // Compose
  composeOpen: false,
  composeData: null,
  openCompose: (data) => set({ composeOpen: true, composeData: data || null }),
  closeCompose: () => set({ composeOpen: false, composeData: null }),

  // Labels
  labels: [],
  setLabels: (labels) => set({ labels }),

  // Contacts
  contacts: [],
  setContacts: (contacts) => set({ contacts }),

  // Toasts
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).slice(2)
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }))
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))
