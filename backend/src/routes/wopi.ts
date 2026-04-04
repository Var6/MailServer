/**
 * WOPI server — lets Collabora Online read/write files from local storage.
 *
 * Auth flow:
 *   1. Frontend calls POST /wopi/token?path=... (with user JWT) → gets { token, tokenTtl, wopiSrc }
 *   2. Frontend opens /cool/cool.html?WOPISrc=<wopiSrc>&access_token=<token>
 *   3. Collabora calls GET /wopi/files/:fileId?access_token=<token>  (CheckFileInfo)
 *   4. Collabora calls GET /wopi/files/:fileId/contents              (GetFile)
 *   5. Collabora calls POST /wopi/files/:fileId/contents             (PutFile / save)
 */

import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import path from "path";
import fs from "fs";
import http from "http";
import { userRootPath } from "../services/localFileService.js";
import { requireAuth } from "../middleware/auth.js";
import { config } from "../config/index.js";

// Fetch the editor URL from Collabora's discovery endpoint
// Returns something like "https://collabora:9980/browser/38f303a437/cool.html?"
let cachedEditorBase: string | null = null;
async function getEditorBase(): Promise<string> {
  if (cachedEditorBase) return cachedEditorBase;
  const discoveryUrl = `${config.COLLABORA_URL}/hosting/discovery`;
  return new Promise((resolve) => {
    const req = http.get(discoveryUrl, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        const m = data.match(/urlsrc="([^"]+)"/);
        if (m) {
          const url = new URL(m[1]);
          cachedEditorBase = url.pathname.replace(/\?$/, "");
        } else {
          cachedEditorBase = "/browser/dist/cool.html";
        }
        resolve(cachedEditorBase!);
      });
    });
    req.on("error", () => {
      cachedEditorBase = "/browser/dist/cool.html";
      resolve(cachedEditorBase);
    });
    req.setTimeout(3000, () => {
      req.destroy();
      cachedEditorBase = "/browser/dist/cool.html";
      resolve(cachedEditorBase);
    });
  });
}

const router = Router();

// ── helpers ──────────────────────────────────────────────────────────────────

function makeFileId(email: string, filePath: string): string {
  return Buffer.from(JSON.stringify({ email, path: filePath })).toString("base64url");
}

function parseFileId(fileId: string): { email: string; path: string } {
  return JSON.parse(Buffer.from(fileId, "base64url").toString("utf8"));
}

function sanitizePath(p: string): string {
  // strip any path-traversal attempts
  return "/" + p.split("/").filter(s => s && s !== ".." && s !== ".").join("/");
}

function wopiAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.query.access_token as string;
  if (!token) { res.status(401).json({ error: "Missing access_token" }); return; }
  try {
    req.user = jwt.verify(token, config.JWT_SECRET) as any;
    next();
  } catch {
    res.status(401).json({ error: "Invalid WOPI token" });
  }
}

// ── POST /wopi/token?path=/dir/file.xlsx ─────────────────────────────────────
// Called by the frontend (with user Bearer JWT) to get a short-lived WOPI token.
router.post("/token", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const filePath = sanitizePath((req.query.path as string) ?? "");
  if (!filePath || filePath === "/") {
    res.status(400).json({ error: "path required" });
    return;
  }

  const email = req.user!.sub;
  const fileId = makeFileId(email, filePath);
  const token = jwt.sign({ sub: email, path: filePath }, config.JWT_SECRET, { expiresIn: "1h" });
  const editorPath = await getEditorBase();

  res.json({
    token,
    tokenTtl: Date.now() + 3600 * 1000,
    // Collabora calls this URL directly — must be reachable from inside Docker
    wopiSrc: `${config.WOPI_HOST}/wopi/files/${fileId}`,
    // editorPath is the browser-relative path, e.g. /browser/38f303a437/cool.html
    editorPath,
    fileId,
  });
});

// ── GET /wopi/files/:fileId  (CheckFileInfo) ─────────────────────────────────
router.get("/files/:fileId", wopiAuth, (req: Request, res: Response): void => {
  try {
    const { email, path: filePath } = parseFileId(req.params.fileId);
    const abs = path.join(userRootPath(email), sanitizePath(filePath));
    const stat = fs.statSync(abs);
    const name = path.basename(abs);

    res.json({
      BaseFileName:          name,
      Size:                  stat.size,
      LastModifiedTime:      stat.mtime.toISOString(),
      OwnerId:               email,
      UserId:                email,
      UserFriendlyName:      email.split("@")[0],
      UserCanWrite:          true,
      UserCanNotWriteRelative: true,
      SupportsUpdate:        true,
      SupportsLocks:         false,
    });
  } catch {
    res.status(404).json({ error: "File not found" });
  }
});

// ── GET /wopi/files/:fileId/contents  (GetFile) ───────────────────────────────
router.get("/files/:fileId/contents", wopiAuth, (req: Request, res: Response): void => {
  try {
    const { email, path: filePath } = parseFileId(req.params.fileId);
    const abs = path.join(userRootPath(email), sanitizePath(filePath));
    const name = path.basename(abs);
    const stat = fs.statSync(abs);

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(name)}"`);
    res.setHeader("Content-Length", stat.size);
    fs.createReadStream(abs).pipe(res);
  } catch {
    res.status(404).json({ error: "File not found" });
  }
});

// ── POST /wopi/files/:fileId/contents  (PutFile — save from Collabora) ───────
// express.raw() runs before this handler and puts the body in req.body as a Buffer
router.post("/files/:fileId/contents", wopiAuth, (req: Request, res: Response): void => {
  try {
    const { email, path: filePath } = parseFileId(req.params.fileId);
    const abs = path.join(userRootPath(email), sanitizePath(filePath));
    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body)) { res.status(400).json({ error: "No body" }); return; }
    fs.writeFileSync(abs, body);
    res.status(200).json({ ok: true });
  } catch {
    res.status(500).json({ error: "Save failed" });
  }
});

export default router;
