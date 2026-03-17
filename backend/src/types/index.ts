export interface MailUser {
  id: number;
  email: string;
  domain_id: number;
  quota_mb: number;
}

export interface AuthTokenPayload {
  sub: string;   // email
  domain: string;
  iat?: number;
  exp?: number;
}

export interface MailFolder {
  path: string;
  name: string;
  delimiter: string;
  flags: string[];
  specialUse?: string;
  subscribed: boolean;
}

export interface MailHeader {
  uid: number;
  seq: number;
  flags: string[];
  from: string;
  to: string;
  subject: string;
  date: Date;
  size: number;
  seen: boolean;
  answered: boolean;
  flagged: boolean;
  hasAttachments: boolean;
  preview?: string;
}

export interface MailMessage extends MailHeader {
  html?: string;
  text?: string;
  attachments: MailAttachment[];
}

export interface MailAttachment {
  filename: string;
  contentType: string;
  size: number;
  cid?: string;
  content?: Buffer;
}

export interface SendMailOptions {
  from: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
}

export interface PaginatedMessages {
  messages: MailHeader[];
  total: number;
  page: number;
  limit: number;
  folder: string;
}
