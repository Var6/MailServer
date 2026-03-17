import nodemailer from "nodemailer";
import { config } from "../config/index.js";
import type { SendMailOptions } from "../types/index.js";

const transporter = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: false,
  requireTLS: true,
  tls: { rejectUnauthorized: false },
});

export async function sendMail(opts: SendMailOptions, senderPassword: string): Promise<void> {
  const authTransport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: false,
    requireTLS: true,
    auth: { user: opts.from, pass: senderPassword },
    tls: { rejectUnauthorized: false },
  });

  await authTransport.sendMail({
    from: opts.from,
    to: Array.isArray(opts.to) ? opts.to.join(", ") : opts.to,
    cc: opts.cc ? (Array.isArray(opts.cc) ? opts.cc.join(", ") : opts.cc) : undefined,
    bcc: opts.bcc ? (Array.isArray(opts.bcc) ? opts.bcc.join(", ") : opts.bcc) : undefined,
    replyTo: opts.replyTo,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    attachments: opts.attachments?.map(a => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  });
}
