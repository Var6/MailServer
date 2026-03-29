/**
 * Cloudflare Email Worker — inbound-email.js
 *
 * Receives emails sent to @yourdomain.com via Cloudflare Email Routing,
 * then POSTs the raw message to your mail server's backend API so it lands
 * in the correct Dovecot inbox (visible in webmail).
 *
 * ── Setup ────────────────────────────────────────────────────────────────────
 * 1. In Cloudflare Dashboard → Workers & Pages → Create Worker
 * 2. Paste this entire file, click Save & Deploy
 * 3. Add an environment variable in the Worker settings:
 *      WEBHOOK_SECRET = (same value as INBOUND_WEBHOOK_SECRET in your .env)
 * 4. In Email Routing → Email Workers → set this worker as the catch-all action
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Your mail server's public URL (the one Cloudflare Tunnel exposes)
const BACKEND_URL = "https://mail.citizenhousing.in/api/inbound/cloudflare";

/**
 * Convert an ArrayBuffer to a base64 string without blowing the call stack.
 * Processing in 8 KB chunks avoids "Maximum call stack size exceeded" on
 * large emails that would happen with a single spread operator.
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export default {
  /**
   * Cloudflare Email Workers receive an EmailMessage object:
   *   message.from   — envelope sender  (e.g. "someone@gmail.com")
   *   message.to     — envelope recipient (e.g. "john@citizenhousing.in")
   *   message.raw    — ReadableStream<Uint8Array> of the full RFC 5322 email
   */
  async email(message, env, _ctx) {
    // Read the entire raw email into memory
    const rawArrayBuffer = await new Response(message.raw).arrayBuffer();
    const rawBase64 = arrayBufferToBase64(rawArrayBuffer);

    let response;
    try {
      response = await fetch(BACKEND_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": env.WEBHOOK_SECRET ?? "",
        },
        body: JSON.stringify({
          raw:  rawBase64,
          from: message.from,
          to:   message.to,
        }),
      });
    } catch (err) {
      // Network error — throw so Cloudflare retries delivery
      throw new Error(`[inbound-worker] Network error reaching backend: ${err.message}`);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `[inbound-worker] Backend rejected delivery (${response.status}): ${body}`
      );
    }

    console.log(`[inbound-worker] Delivered: ${message.from} → ${message.to}`);
  },
};
