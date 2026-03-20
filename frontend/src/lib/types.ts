export interface User {
  id: string
  email: string
  display_name: string
  avatar_color: string
  has_avatar: boolean
  quota_bytes: number
  used_bytes: number
  is_admin: boolean
  is_active: boolean
  signature: string
  created_at: string
  last_login: string | null
}

export interface Email {
  id: string
  message_id: string
  user_id: string
  folder: string
  from_addr: string
  to_addrs: string[]
  cc: string[]
  bcc: string[]
  reply_to: string | null
  subject: string
  body_text: string
  body_html: string
  size_bytes: number
  is_read: boolean
  is_flagged: boolean
  has_attachments: boolean
  attachment_ids: string[]
  thread_id: string
  spam_score: number
  created_at: string
  attachments: Attachment[]
  labels: Label[]
  label_ids: string[]
}

export interface Attachment {
  id: string
  email_id: string
  filename: string
  content_type: string
  size_bytes: number
}

export interface Contact {
  id: string
  user_id: string
  name: string
  email: string
  phone: string | null
  notes: string
  created_at: string
}

export interface Label {
  id: string
  user_id: string
  name: string
  color: string
}

export interface EmailsResponse {
  emails: Email[]
  total: number
  page: number
  limit: number
}

export interface UnreadCounts {
  [folder: string]: number
}

export interface SendEmailData {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body_text?: string
  body_html?: string
  reply_to?: string
  draft_id?: string
  attachments?: File[]
}

export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}

export interface ComposeData {
  to?: string[]
  subject?: string
  body?: string
  draftId?: string
  replyTo?: string
  mode?: 'reply' | 'reply-all' | 'forward' | 'new'
}

export interface ServerStats {
  total_users: number
  active_users: number
  total_emails: number
  total_storage_bytes: number
  emails_today: number
  spam_blocked_today: number
}
