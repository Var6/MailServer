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
  date: string;
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
  attachments: Array<{ filename: string; contentType: string; size: number; cid?: string }>;
}

export interface PaginatedMessages {
  messages: MailHeader[];
  total: number;
  page: number;
  limit: number;
  folder: string;
}
