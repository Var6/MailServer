import { Router } from "express";
import axios from "axios";
import { requireAuth } from "../middleware/auth.js";
import { listFiles, uploadFile, provisionUser } from "../services/nextcloudService.js";
import { listLocalFiles, localStorageLocation, uploadLocalFile } from "../services/localFileService.js";
import { config } from "../config/index.js";

const router = Router();

// Short-lived store for NC session cookies keyed by one-time token (TTL: 60s)
const ncTokenStore = new Map<string, { cookies: string[]; redirect: string; expires: number }>();

function makeToken(): string {
  return Array.from({ length: 6 }, () =>
    Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, "0")
  ).join("");
}

function pruneTokens(): void {
  const now = Date.now();
  for (const [k, v] of ncTokenStore) if (v.expires < now) ncTokenStore.delete(k);
}

// ── Public redirect endpoint (no auth — browser navigates here directly) ──────
// GET /files/nc-redirect?token=<one-time-token>
// Sets NC session cookies on the browser and redirects to Nextcloud
router.get("/nc-redirect", (req, res) => {
  const token = req.query.token as string;
  const entry = token ? ncTokenStore.get(token) : undefined;

  if (!entry || entry.expires < Date.now()) {
    res.status(410).send("Link expired or invalid. Please try again.");
    return;
  }
  ncTokenStore.delete(token); // one-time use

  // Cookies from Nextcloud already have Path=/nextcloud — just strip Domain
  const fixed = entry.cookies.map(c =>
    c.replace(/;\s*Domain=[^;]+/gi, "")
  );
  res.setHeader("Set-Cookie", fixed);
  res.redirect(302, `/nextcloud${entry.redirect}`);
});

// ── Authenticated routes ───────────────────────────────────────────────────────
router.use(requireAuth);

// GET /files/storage-info
router.get("/storage-info", (req, res) => {
  const driver = config.FILE_STORAGE_DRIVER;
  if (driver === "local") {
    const hostBase = config.LOCAL_FILES_HOST_PATH;
    const location = hostBase
      ? `${hostBase.replace(/[\\/]+$/, "")}/${req.user!.sub}`
      : localStorageLocation(req.user!.sub);
    res.json({ driver, location });
    return;
  }
  res.json({ driver, location: `/remote.php/dav/files/${encodeURIComponent(req.user!.sub)}/` });
});

// GET /files?path=/
router.get("/", async (req, res, next) => {
  try {
    const email    = req.user!.sub;
    const path     = (req.query.path as string) || "/";
    let files;

    if (config.FILE_STORAGE_DRIVER === "local") {
      files = await listLocalFiles(email, path);
    } else {
      const password = req.userPassword!;
      // Ensure NC user exists and password is synced before every WebDAV call
      await provisionUser(email, password).catch(() => {});
      files = await listFiles(email, password, path);
    }

    res.json(files);
  } catch (e) { next(e); }
});

// POST /files/upload
router.post("/upload", async (req, res, next) => {
  try {
    const path = (req.query.path as string) || "/";
    const contentType = (req.headers["content-type"] as string) || "application/octet-stream";
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", async () => {
      try {
        const content = Buffer.concat(chunks);
        if (config.FILE_STORAGE_DRIVER === "local") {
          await uploadLocalFile(req.user!.sub, path, content);
        } else {
          await uploadFile(req.user!.sub, req.userPassword!, path, content, contentType);
        }
        res.json({ ok: true });
      } catch (e) { next(e); }
    });
  } catch (e) { next(e); }
});

// POST /files/nc-login  (requires auth — called via axios with JWT)
// Provisions NC user if needed, does server-side NC login, returns a one-time redirect token
router.post("/nc-login", async (req, res, next) => {
  try {
    const email    = req.user!.sub;
    const password = req.userPassword!;
    if (!password) { res.status(400).json({ error: "No password in session" }); return; }

    const redirect   = (req.body?.redirect as string) || "/index.php/apps/files/";
    const ncBase     = config.NEXTCLOUD_URL;
    const ncAdmin    = config.NEXTCLOUD_ADMIN_USER;
    const ncAdminPw  = config.NEXTCLOUD_ADMIN_PASSWORD;
    const ocsHeaders = { "OCS-APIRequest": "true", "Content-Type": "application/x-www-form-urlencoded" };

    // 1. Ensure user exists in Nextcloud (create if missing, sync password if exists)
    // OCS always returns HTTP 200; the actual result is in ocs.meta.statuscode (100 = ok, 404 = not found)
    const checkResp = await axios.get(`${ncBase}/ocs/v1.php/cloud/users/${encodeURIComponent(email)}?format=json`, {
      auth: { username: ncAdmin, password: ncAdminPw },
      headers: { "OCS-APIRequest": "true" },
      validateStatus: () => true,
    });
    const userExists = checkResp.data?.ocs?.meta?.statuscode === 100;

    if (!userExists) {
      const createResp = await axios.post(`${ncBase}/ocs/v1.php/cloud/users?format=json`,
        `userid=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&email=${encodeURIComponent(email)}`,
        { auth: { username: ncAdmin, password: ncAdminPw }, headers: ocsHeaders, validateStatus: () => true }
      );
      if (createResp.data?.ocs?.meta?.statuscode !== 100) {
        console.error("[nc-login] User creation failed:", email, createResp.data?.ocs?.meta);
        res.status(502).json({ error: "Failed to provision Nextcloud user" });
        return;
      }
    } else {
      // Sync password so NC stays in step with mail password
      await axios.put(`${ncBase}/ocs/v1.php/cloud/users/${encodeURIComponent(email)}?format=json`,
        `key=password&value=${encodeURIComponent(password)}`,
        { auth: { username: ncAdmin, password: ncAdminPw }, headers: ocsHeaders, validateStatus: () => true }
      );
    }

    // Build the public-facing Nextcloud URL for Origin/Referer headers
    const serverUrl  = (process.env.SERVER_URL ?? "https://localhost").replace(/\/$/, "");
    const ncPublicLogin = `${serverUrl}/nextcloud/index.php/login`;
    const proxyHeaders = {
      "X-Forwarded-Proto": "https",
      "X-Forwarded-Host":  serverUrl.replace(/^https?:\/\//, ""),
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    };

    // 2. Fetch NC login page → extract CSRF requesttoken
    const loginPageResp = await axios.get(`${ncBase}/index.php/login`, {
      headers: proxyHeaders,
      maxRedirects: 5,
      validateStatus: () => true,
    });
    const html = loginPageResp.data as string;
    const tokenMatch = html.match(/data-requesttoken="([^"]+)"/);
    if (!tokenMatch) { res.status(502).json({ error: "Could not get NC requesttoken" }); return; }
    const requesttoken = tokenMatch[1];

    // Deduplicate: keep the LAST value for each cookie name (Nextcloud regenerates session ID on each redirect)
    const cookieMap = new Map<string, string>();
    for (const c of (loginPageResp.headers["set-cookie"] ?? []) as string[]) {
      const pair = c.split(";")[0];
      const eq = pair.indexOf("=");
      if (eq > 0) cookieMap.set(pair.slice(0, eq).trim(), pair.slice(eq + 1));
    }
    const initCookies = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join("; ");

    // 3. POST credentials to NC login form with proper Origin/Referer (CSRF validation)
    const body = `user=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&requesttoken=${encodeURIComponent(requesttoken)}`;
    const loginResp = await axios.post(`${ncBase}/index.php/login`, body, {
      headers: {
        ...proxyHeaders,
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": initCookies,
        "Origin":  serverUrl,
        "Referer": ncPublicLogin,
      },
      maxRedirects: 0,
      validateStatus: (s: number) => s < 400,
    });

    const sessionCookies = ((loginResp.headers["set-cookie"] ?? []) as string[])
      .filter(c => !c.includes("deleted") && !c.includes("Max-Age=0"));
    if (!sessionCookies.length) {
      res.status(502).json({ error: "NC login failed — credentials rejected" });
      return;
    }

    // 4. Store cookies under a one-time token (60 s TTL)
    pruneTokens();
    const token = makeToken();
    ncTokenStore.set(token, { cookies: sessionCookies, redirect, expires: Date.now() + 60_000 });

    res.json({ token });
  } catch (e) { next(e); }
});

export default router;
