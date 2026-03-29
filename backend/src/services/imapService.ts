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

async function createFreshClient(email: string, password: string): Promise<ImapFlow> {
  const client = new ImapFlow({
    host: config.IMAP_HOST,
    port: config.IMAP_PORT,
    secure: false,
    auth: { user: email, pass: password },
    logger: false,
    tls: { rejectUnauthorized: false },
  });
  // Swallow socket-level errors on idle connections so they don't crash the process
  client.on("error", () => { pool.delete(email); });
  await client.connect();
  pool.set(email, { client, lastUsed: Date.now() });
  return client;
}

async function getClient(email: string, password: string): Promise<ImapFlow> {
  const existing = pool.get(email);
  if (existing) {
    // Check the connection is still alive before reusing it
    if (existing.client.usable) {
      existing.lastUsed = Date.now();
      return existing.client;
    }
    // Connection is stale — evict and reconnect
    pool.delete(email);
    existing.client.logout().catch(() => {});
  }
  return createFreshClient(email, password);
}

// Wrap any IMAP operation with automatic retry on connection failure
async function withClient<T>(
  email: string,
  password: string,
  fn: (client: ImapFlow) => Promise<T>
): Promise<T> {
  let client = await getClient(email, password);
  try {
    return await fn(client);
  } catch (err: unknown) {
    // On connection-level errors, evict the broken client and retry once
    const isConnErr = err instanceof Error && (
      err.message.includes("connect") ||
      err.message.includes("socket") ||
      err.message.includes("ECONNRESET") ||
      err.message.includes("ETIMEDOUT") ||
      err.message.includes("closed") ||
      err.message.includes("Lost connection") ||
      !client.usable
    );
    if (isConnErr) {
      pool.delete(email);
      client.logout().catch(() => {});
      client = await createFreshClient(email, password);
      return await fn(client);
    }
    throw err;
  }
}

// Helper: parse address object from imapflow into "Name <email>" string
function fmtAddr(a: { name?: string; address?: string } | undefined): string {
  if (!a) return "";
  const addr = a.address ?? "";
  return a.name ? `${a.name} <${addr}>` : addr;
}

export async function listFolders(email: string, password: string): Promise<MailFolder[]> {
  return withClient(email, password, async (client) => {
    const list = await client.list();
    return list.map(mailbox => ({
      path: mailbox.path,
      name: mailbox.name,
      delimiter: mailbox.delimiter ?? "/",
      flags: Array.from(mailbox.flags ?? []),
      specialUse: mailbox.specialUse,
      subscribed: mailbox.subscribed ?? false,
    }));
  });
}

export async function fetchMessages(
  email: string,
  password: string,
  folder: string,
  page: number,
  limit: number
): Promise<PaginatedMessages> {
  return withClient(email, password, async (client) => {
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
  });
}

export async function fetchMessage(
  email: string,
  password: string,
  folder: string,
  uid: number
): Promise<MailMessage | null> {
  return withClient(email, password, async (client) => {
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
  });
}

export async function fetchAttachment(
  email: string,
  password: string,
  folder: string,
  uid: number,
  attachmentIndex: number
): Promise<{ filename: string; contentType: string; content: Buffer; size: number } | null> {
  return withClient(email, password, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      for await (const msg of client.fetch({ uid }, {
        source: true,
      })) {
        const parsed = await simpleParser(msg.source ?? Buffer.alloc(0));
        const attachments = parsed.attachments ?? [];
        const attachment = attachments[attachmentIndex];
        if (!attachment || !attachment.content) return null;
        return {
          filename: attachment.filename ?? `attachment-${attachmentIndex + 1}`,
          contentType: attachment.contentType || "application/octet-stream",
          content: attachment.content,
          size: attachment.size ?? attachment.content.length,
        };
      }
      return null;
    } finally {
      lock.release();
    }
  });
}

export async function moveMessage(
  email: string,
  password: string,
  sourceFolder: string,
  uid: number,
  destFolder: string
): Promise<void> {
  return withClient(email, password, async (client) => {
    const lock = await client.getMailboxLock(sourceFolder);
    try {
      await client.messageMove({ uid }, destFolder, { uid: true });
    } finally {
      lock.release();
    }
  });
}

export async function deleteMessage(
  email: string,
  password: string,
  folder: string,
  uid: number
): Promise<void> {
  await moveMessage(email, password, folder, uid, "Trash");
}

export async function expungeMessage(
  email: string,
  password: string,
  folder: string,
  uid: number
): Promise<void> {
  return withClient(email, password, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      await client.messageFlagsAdd({ uid }, ["\\Deleted"], { uid: true });
      await client.messageDelete({ uid }, { uid: true });
    } finally {
      lock.release();
    }
  });
}

export async function toggleFlag(
  email: string,
  password: string,
  folder: string,
  uid: number,
  flag: string,
  add: boolean
): Promise<void> {
  return withClient(email, password, async (client) => {
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
  });
}

// ── Backup / Restore ─────────────────────────────────────

export interface BackupMessage {
  flags: string[];
  date: string;       // ISO
  raw: string;        // base64 RFC 5322
}

export interface BackupFolder {
  folder: string;
  messages: BackupMessage[];
}

export interface MailboxBackup {
  version: 1;
  email: string;
  exportedAt: string;
  folders: BackupFolder[];
}

export async function exportMailbox(email: string, password: string): Promise<MailboxBackup> {
  const folders = await listFolders(email, password);
  const result: BackupFolder[] = [];

  for (const f of folders) {
    const folderMessages: BackupMessage[] = [];
    try {
      await withClient(email, password, async (client) => {
        const lock = await client.getMailboxLock(f.path);
        try {
          const status = await client.status(f.path, { messages: true });
          const total = status.messages ?? 0;
          if (total === 0) return;

          for await (const msg of client.fetch("1:*", { uid: true, flags: true, internalDate: true, source: true })) {
            folderMessages.push({
              flags: Array.from(msg.flags ?? []),
              date: (msg.internalDate ?? new Date()).toISOString(),
              raw: (msg.source ?? Buffer.alloc(0)).toString("base64"),
            });
          }
        } finally {
          lock.release();
        }
      });
    } catch {
      // Skip unreadable folders (e.g. \Noselect)
    }
    if (folderMessages.length > 0) {
      result.push({ folder: f.path, messages: folderMessages });
    }
  }

  return { version: 1, email, exportedAt: new Date().toISOString(), folders: result };
}

export async function importMailbox(
  email: string,
  password: string,
  backup: MailboxBackup,
  onProgress: (done: number, total: number) => void
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;
  const totalMessages = backup.folders.reduce((s, f) => s + f.messages.length, 0);
  let done = 0;

  for (const folderData of backup.folders) {
    try {
      await withClient(email, password, async (client) => {
        // Create folder if it doesn't exist
        try { await client.mailboxCreate(folderData.folder); } catch { /* already exists */ }

        const lock = await client.getMailboxLock(folderData.folder);
        try {
          for (const msg of folderData.messages) {
            try {
              const raw = Buffer.from(msg.raw, "base64");
              await client.append(folderData.folder, raw, msg.flags, new Date(msg.date));
              imported++;
            } catch {
              skipped++;
            }
            done++;
            onProgress(done, totalMessages);
          }
        } finally {
          lock.release();
        }
      });
    } catch {
      skipped += folderData.messages.length;
      done += folderData.messages.length;
      onProgress(done, totalMessages);
    }
  }

  return { imported, skipped };
}

export async function appendToSent(
  email: string,
  password: string,
  opts: { from: string; to: string; subject: string; text?: string; html?: string }
): Promise<void> {
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
    await withClient(email, password, async (client) => {
      const mailboxes = await client.list();
      const sentBySpecial = mailboxes.find((m) => (m.specialUse ?? "").toLowerCase().includes("\\sent"));
      const sentByName = mailboxes.find((m) => /(^|\b)(sent|sent items|sent mail)(\b|$)/i.test(`${m.name} ${m.path}`));
      const sentPath = sentBySpecial?.path ?? sentByName?.path ?? "Sent";

      try {
        await client.append(sentPath, Buffer.from(raw), ["\\Seen"]);
      } catch {
        await client.mailboxCreate("Sent").catch(() => {});
        await client.append("Sent", Buffer.from(raw), ["\\Seen"]);
      }
    });
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
