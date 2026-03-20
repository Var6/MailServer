import nodemailer from "nodemailer";
import { config } from "../config/index.js";
import type { SendMailOptions } from "../types/index.js";

function createTransport(user: string, pass: string) {
  const host = config.SMTP_HOST;
  const port = config.SMTP_PORT;

  // Dev mode: if SMTP_HOST is not configured, use Ethereal (fake SMTP — emails viewable at the URL logged below)
  if (!host) {
    return null; // signal to use Ethereal per-send
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: false,
    requireTLS: true,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

export async function sendMail(opts: SendMailOptions, senderPassword: string): Promise<void> {
  const toAddr   = Array.isArray(opts.to)  ? opts.to.join(", ")  : opts.to;
  const ccAddr   = opts.cc  ? (Array.isArray(opts.cc)  ? opts.cc.join(", ")  : opts.cc)  : undefined;
  const bccAddr  = opts.bcc ? (Array.isArray(opts.bcc) ? opts.bcc.join(", ") : opts.bcc) : undefined;

  const message = {
    from:    opts.from,
    to:      toAddr,
    cc:      ccAddr,
    bcc:     bccAddr,
    replyTo: opts.replyTo,
    subject: opts.subject,
    text:    opts.text,
    html:    opts.html,
    attachments: opts.attachments?.map(a => ({
      filename:    a.filename,
      content:     a.content,
      contentType: a.contentType,
    })),
  };

  const transport = createTransport(opts.from, senderPassword);

  if (!transport) {
    // No SMTP server configured — use Ethereal test account for development
    const testAccount = await nodemailer.createTestAccount();
    const ethereal = nodemailer.createTransport({
      host:   "smtp.ethereal.email",
      port:   587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    const info = await ethereal.sendMail(message);
    console.log("\n📧  DEV MODE — email captured by Ethereal (not actually sent)");
    console.log(`    From:    ${opts.from}`);
    console.log(`    To:      ${toAddr}`);
    console.log(`    Subject: ${opts.subject}`);
    console.log(`    Preview: ${nodemailer.getTestMessageUrl(info)}\n`);
    return;
  }

  try {
    await transport.sendMail(message);
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException & { responseCode?: number; response?: string };
    const detail = e.response ?? e.message ?? String(e);
    console.error("SMTP send error:", detail);
    throw new Error(
      e.responseCode
        ? `SMTP error ${e.responseCode}: ${detail}`
        : `Could not connect to mail server (${config.SMTP_HOST}:${config.SMTP_PORT}). Check SMTP_HOST in your .env.`
    );
  }
}
