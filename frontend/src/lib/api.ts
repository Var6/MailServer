import type {
  User,
  Email,
  EmailsResponse,
  Contact,
  Label,
  UnreadCounts,
  SendEmailData,
  ServerStats,
} from './types'

const BASE = '/api'

class ApiClient {
  private getAccessToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('access_token')
  }

  private getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('refresh_token')
  }

  private clearTokens(): void {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
  }

  private redirectToLogin(): void {
    this.clearTokens()
    window.location.href = '/login'
  }

  private async refreshToken(): Promise<string> {
    const refreshToken = this.getRefreshToken()
    if (!refreshToken) {
      this.redirectToLogin()
      throw new Error('No refresh token')
    }

    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!res.ok) {
      this.redirectToLogin()
      throw new Error('Token refresh failed')
    }

    const data = await res.json()
    localStorage.setItem('access_token', data.access_token)
    return data.access_token
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
    retry = true
  ): Promise<T> {
    const token = this.getAccessToken()
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json'
    }

    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers,
    })

    if (res.status === 401 && retry) {
      try {
        const newToken = await this.refreshToken()
        return this.request<T>(path, {
          ...options,
          headers: {
            ...headers,
            Authorization: `Bearer ${newToken}`,
          },
        }, false)
      } catch {
        throw new Error('Authentication failed')
      }
    }

    if (!res.ok) {
      let errorMessage = `Request failed: ${res.status}`
      try {
        const errData = await res.json()
        errorMessage = errData.detail || errData.message || errorMessage
      } catch {
        // ignore
      }
      throw new Error(errorMessage)
    }

    if (res.status === 204) {
      return undefined as T
    }

    return res.json()
  }

  // ── Auth ────────────────────────────────────────
  async login(
    email: string,
    password: string
  ): Promise<{ access_token: string; refresh_token: string; user: User }> {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!res.ok) {
      let msg = 'Login failed'
      try {
        const err = await res.json()
        msg = err.detail || err.message || msg
      } catch { /* empty */ }
      throw new Error(msg)
    }

    return res.json()
  }

  async logout(): Promise<void> {
    try {
      await this.request<void>('/auth/logout', { method: 'POST' })
    } catch { /* ignore */ } finally {
      this.clearTokens()
    }
  }

  async getMe(): Promise<User> {
    return this.request<User>('/auth/me')
  }

  async updatePassword(current: string, newPwd: string): Promise<void> {
    return this.request<void>('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ current_password: current, new_password: newPwd }),
    })
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    return this.request<User>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  // ── Emails ────────────────────────────────────────
  async getEmails(
    folder: string,
    page = 1,
    search?: string
  ): Promise<EmailsResponse> {
    const params = new URLSearchParams({ folder, page: String(page), limit: '50' })
    if (search) params.set('search', search)
    return this.request<EmailsResponse>(`/emails?${params}`)
  }

  async getEmail(id: string): Promise<Email> {
    return this.request<Email>(`/emails/${id}`)
  }

  async sendEmail(data: SendEmailData): Promise<Email> {
    const formData = new FormData()
    formData.append('to', JSON.stringify(data.to))
    if (data.cc) formData.append('cc', JSON.stringify(data.cc))
    if (data.bcc) formData.append('bcc', JSON.stringify(data.bcc))
    formData.append('subject', data.subject)
    if (data.body_text) formData.append('body_text', data.body_text)
    if (data.body_html) formData.append('body_html', data.body_html)
    if (data.reply_to) formData.append('reply_to', data.reply_to)
    if (data.draft_id) formData.append('draft_id', data.draft_id)
    if (data.attachments) {
      data.attachments.forEach((file) => formData.append('attachments', file))
    }

    return this.request<Email>('/emails', {
      method: 'POST',
      body: formData,
    })
  }

  async saveDraft(data: SendEmailData): Promise<Email> {
    const formData = new FormData()
    formData.append('to', JSON.stringify(data.to))
    if (data.cc) formData.append('cc', JSON.stringify(data.cc))
    if (data.bcc) formData.append('bcc', JSON.stringify(data.bcc))
    formData.append('subject', data.subject)
    if (data.body_text) formData.append('body_text', data.body_text)
    if (data.body_html) formData.append('body_html', data.body_html)
    if (data.draft_id) formData.append('draft_id', data.draft_id)

    return this.request<Email>('/emails/draft', {
      method: 'POST',
      body: formData,
    })
  }

  async markRead(id: string): Promise<void> {
    return this.request<void>(`/emails/${id}/read`, { method: 'PUT' })
  }

  async markUnread(id: string): Promise<void> {
    return this.request<void>(`/emails/${id}/unread`, { method: 'PUT' })
  }

  async flagEmail(id: string): Promise<void> {
    return this.request<void>(`/emails/${id}/flag`, { method: 'PUT' })
  }

  async unflagEmail(id: string): Promise<void> {
    return this.request<void>(`/emails/${id}/unflag`, { method: 'PUT' })
  }

  async moveEmail(id: string, folder: string): Promise<void> {
    return this.request<void>(`/emails/${id}/move`, {
      method: 'PUT',
      body: JSON.stringify({ folder }),
    })
  }

  async deleteEmail(id: string): Promise<void> {
    return this.request<void>(`/emails/${id}`, { method: 'DELETE' })
  }

  async bulkUpdate(
    ids: string[],
    action: string,
    folder?: string
  ): Promise<void> {
    return this.request<void>('/emails/bulk', {
      method: 'PUT',
      body: JSON.stringify({ ids, action, folder }),
    })
  }

  async getUnreadCounts(): Promise<UnreadCounts> {
    return this.request<UnreadCounts>('/emails/unread-counts')
  }

  async getAttachment(emailId: string, attId: string): Promise<Blob> {
    const token = this.getAccessToken()
    const res = await fetch(`${BASE}/emails/${emailId}/attachments/${attId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) throw new Error('Failed to download attachment')
    return res.blob()
  }

  // ── Contacts ────────────────────────────────────────
  async getContacts(search?: string): Promise<Contact[]> {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    return this.request<Contact[]>(`/contacts?${params}`)
  }

  async createContact(data: Partial<Contact>): Promise<Contact> {
    return this.request<Contact>('/contacts', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateContact(id: string, data: Partial<Contact>): Promise<Contact> {
    return this.request<Contact>(`/contacts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteContact(id: string): Promise<void> {
    return this.request<void>(`/contacts/${id}`, { method: 'DELETE' })
  }

  async suggestContacts(q: string): Promise<Contact[]> {
    return this.request<Contact[]>(`/contacts/suggest?q=${encodeURIComponent(q)}`)
  }

  // ── Labels ────────────────────────────────────────
  async getLabels(): Promise<Label[]> {
    return this.request<Label[]>('/labels')
  }

  async createLabel(name: string, color: string): Promise<Label> {
    return this.request<Label>('/labels', {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    })
  }

  async updateLabel(id: string, data: Partial<Label>): Promise<Label> {
    return this.request<Label>(`/labels/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteLabel(id: string): Promise<void> {
    return this.request<void>(`/labels/${id}`, { method: 'DELETE' })
  }

  async addEmailLabel(emailId: string, labelId: string): Promise<void> {
    return this.request<void>(`/emails/${emailId}/labels/${labelId}`, {
      method: 'POST',
    })
  }

  async removeEmailLabel(emailId: string, labelId: string): Promise<void> {
    return this.request<void>(`/emails/${emailId}/labels/${labelId}`, {
      method: 'DELETE',
    })
  }

  // ── Admin ────────────────────────────────────────
  async getAdminUsers(): Promise<User[]> {
    return this.request<User[]>('/admin/users')
  }

  async createAdminUser(data: Record<string, unknown>): Promise<User> {
    return this.request<User>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateAdminUser(id: string, data: Record<string, unknown>): Promise<User> {
    return this.request<User>(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteAdminUser(id: string): Promise<void> {
    return this.request<void>(`/admin/users/${id}`, { method: 'DELETE' })
  }

  async getServerStats(): Promise<ServerStats> {
    return this.request<ServerStats>('/admin/stats')
  }
}

export const api = new ApiClient()
export default api
