import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { config } from "../config/index.js";
import type { MailFolder, MailHeader, MailMessage, PaginatedMessages } from "../types/index.js";

// Simple in-process connection pool keyed by email
const pool = new Map<string, { client: ImapFlow; lastUsed: number }>();

// Evict idle connections
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of pool) {
    if (now - entry.lastUsed > config.IMAP_POOL_IDLE_TTL_MS) {
      entry.client.logout().catch(() => {});
      pool.delete(key);
    }
  }
}, 60_000);

async function getClient(email: string, password: string): Promise<ImapFlow> {
  const existing = pool.get(email);
  if (existing) {
    existing.lastUsed = Date.now();
    return existing.client;
  }
  const client = new ImapFlow({
    host: config.IMAP_HOST,
    port: config.IMAP_PORT,
    secure: false,
    auth: { user: email, pass: password },
    logger: false,
    tls: { rejectUnauthorized: false },
  });
  await client.connect();
  pool.set(email, { client, lastUsed: Date.now() });
  return client;
}

// Helper: parse address object from imapflow into "Name <email>" string
function fmtAddr(a: { name?: string; address?: string } | undefined): string {
  if (!a) return "";
  const addr = a.address ?? "";
  return a.name ? `${a.name} <${addr}>` : addr;
}

export async function listFolders(email: string, password: string): Promise<MailFolder[]> {
  const client = await getClient(email, password);
  const list = await client.list();   // returns Promise<ListResponse[]>
  return list.map(mailbox => ({
    path: mailbox.path,
    name: mailbox.name,
    delimiter: mailbox.delimiter ?? "/",
    flags: Array.from(mailbox.flags ?? []),
    specialUse: mailbox.specialUse,
    subscribed: mailbox.subscribed ?? false,
  }));
}

export async function fetchMessages(
  email: string,
  password: string,
  folder: string,
  page: number,
  limit: number
): Promise<PaginatedMessages> {
  const client = await getClient(email, password);
  const lock = await client.getMailboxLock(folder);
  try {
    const status = await client.status(folder, { messages: true });
    const total = status.messages ?? 0;

    if (total === 0) {
      return { messages: [], total: 0, page, limit, folder };
    }

    const start = Math.max(1, total - (page * limit) + 1);
    const end   = Math.max(1, total - ((page - 1) * limit));
    const range = `${start}:${end}`;

    const messages: MailHeader[] = [];
    for await (const msg of client.fetch(range, {
      uid: true, flags: true, envelope: true, bodyStructure: true, size: true,
    })) {
      const from = (msg.envelope?.from as Array<{ name?: string; address?: string }>)?.[0];
      const toList = (msg.envelope?.to as Array<{ name?: string; address?: string }>) ?? [];
      messages.push({
        uid: msg.uid,
        seq: msg.seq,
        flags: Array.from(msg.flags ?? []),
        from: fmtAddr(from),
        to: toList.map(a => a.address ?? "").join(", "),
        subject: msg.envelope?.subject ?? "(no subject)",
        date: msg.envelope?.date ?? new Date(),
        size: msg.size ?? 0,
        seen: (msg.flags ?? new Set()).has("\\Seen"),
        answered: (msg.flags ?? new Set()).has("\\Answered"),
        flagged: (msg.flags ?? new Set()).has("\\Flagged"),
        hasAttachments: hasAttachment(msg.bodyStructure),
      });
    }

    return { messages: messages.reverse(), total, page, limit, folder };
  } finally {
    lock.release();
  }
}

export async function fetchMessage(
  email: string,
  password: string,
  folder: string,
  uid: number
): Promise<MailMessage | null> {
  const client = await getClient(email, password);
  const lock = await client.getMailboxLock(folder);
  try {
    const msgs: MailMessage[] = [];
    for await (const msg of client.fetch({ uid }, {
      uid: true, flags: true, envelope: true, bodyStructure: true, source: true, size: true,
    })) {
      const parsed = await simpleParser(msg.source ?? Buffer.alloc(0));
      const from = (msg.envelope?.from as Array<{ name?: string; address?: string }>)?.[0];
      const toList = (msg.envelope?.to as Array<{ name?: string; address?: string }>) ?? [];
      msgs.push({
        uid: msg.uid,
        seq: msg.seq,
        flags: Array.from(msg.flags ?? []),
        from: fmtAddr(from),
        to: toList.map(a => a.address ?? "").join(", "),
        subject: msg.envelope?.subject ?? "(no subject)",
        date: msg.envelope?.date ?? new Date(),
        size: msg.size ?? 0,
        seen: (msg.flags ?? new Set()).has("\\Seen"),
        answered: (msg.flags ?? new Set()).has("\\Answered"),
        flagged: (msg.flags ?? new Set()).has("\\Flagged"),
        hasAttachments: (parsed.attachments?.length ?? 0) > 0,
        html: typeof parsed.html === "string" ? parsed.html : undefined,
        text: parsed.text ?? undefined,
        attachments: (parsed.attachments ?? []).map(a => ({
          filename: a.filename ?? "attachment",
          contentType: a.contentType,
          size: a.size ?? 0,
          cid: a.cid,
        })),
      });
    }

    if (msgs.length) {
      await client.messageFlagsAdd({ uid }, ["\\Seen"], { uid: true });
    }

    return msgs[0] ?? null;
  } finally {
    lock.release();
  }
}

export async function moveMessage(
  email: string,
  password: string,
  sourceFolder: string,
  uid: number,
  destFolder: string
): Promise<void> {
  const client = await getClient(email, password);
  const lock = await client.getMailboxLock(sourceFolder);
  try {
    await client.messageMove({ uid }, destFolder, { uid: true });
  } finally {
    lock.release();
  }
}

export async function deleteMessage(
  email: string,
  password: string,
  folder: string,
  uid: number
): Promise<void> {
  await moveMessage(email, password, folder, uid, "Trash");
}

export async function toggleFlag(
  email: string,
  password: string,
  folder: string,
  uid: number,
  flag: string,
  add: boolean
): Promise<void> {
  const client = await getClient(email, password);
  const lock = await client.getMailboxLock(folder);
  try {
    if (add) {
      await client.messageFlagsAdd({ uid }, [flag], { uid: true });
    } else {
      await client.messageFlagsRemove({ uid }, [flag], { uid: true });
    }
  } finally {
    lock.release();
  }
}

export async function appendToSent(
  email: string,
  password: string,
  opts: { from: string; to: string; subject: string; text?: string; html?: string }
): Promise<void> {
  const client = await getClient(email, password);
  const date = new Date().toUTCString();
  const body = opts.text ?? (opts.html ? opts.html.replace(/<[^>]*>/g, "") : "");
  const raw = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `Date: ${date}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    body,
  ].join("\r\n");
  try {
    await client.append("Sent", Buffer.from(raw), ["\\Seen"]);
  } catch {
    // Non-fatal: don't fail the send if Sent append fails
  }
}

function hasAttachment(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (b.disposition === "attachment") return true;
  if (Array.isArray(b.childNodes)) return (b.childNodes as unknown[]).some(hasAttachment);
  return false;
}
