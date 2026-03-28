import { Router } from "express";
import nodemailer from "nodemailer";
import { config } from "../config/index.js";

const router = Router();

// Internal Postfix transport (port 10025, no auth — Docker network only)
const transport = nodemailer.createTransport({
  host: config.SMTP_HOST || "postfix",
  port: 10025,
  secure: false,
  ignoreTLS: true,
});

// POST /inbound/brevo
// Brevo Inbound Parsing webhook — receives parsed emails and re-injects them
// into Postfix on port 10025, which delivers via LMTP to Dovecot.
//
// Brevo webhook JSON shape:
//   { From: {Name, Address}, To: [{Name, Address}], Cc: [...],
//     Subject, RawHtmlBody, RawTextBody, Attachments: [...] }
router.post("/brevo", async (req, res) => {
  try {
    const body = req.body;

    const from = body.From?.Address
      ? (body.From.Name ? `"${body.From.Name}" <${body.From.Address}>` : body.From.Address)
      : body.Sender?.Address ?? "";

    const toList: string[] = (body.To ?? []).map((t: { Name?: string; Address: string }) =>
      t.Name ? `"${t.Name}" <${t.Address}>` : t.Address
    );
    const ccList: string[] = (body.Cc ?? []).map((t: { Name?: string; Address: string }) =>
      t.Name ? `"${t.Name}" <${t.Address}>` : t.Address
    );

    if (!from || toList.length === 0) {
      res.status(400).json({ error: "Missing From or To" });
      return;
    }

    const attachments = (body.Attachments ?? []).map((a: {
      Name: string; ContentType: string; Base64Content: string;
    }) => ({
      filename: a.Name,
      content: Buffer.from(a.Base64Content ?? "", "base64"),
      contentType: a.ContentType,
    }));

    await transport.sendMail({
      from,
      to: toList.join(", "),
      cc: ccList.length ? ccList.join(", ") : undefined,
      subject: body.Subject ?? "(no subject)",
      text: body.RawTextBody ?? undefined,
      html: body.RawHtmlBody ?? undefined,
      attachments,
    });

    console.log(`[inbound] Delivered: ${from} → ${toList.join(", ")} "${body.Subject}"`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[inbound] Webhook error:", err);
    res.status(500).json({ error: "Delivery failed" });
  }
});

export default router;
