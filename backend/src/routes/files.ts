import { Router } from "express";
import path from "path";
import { requireAuth } from "../middleware/auth.js";
import {
  listLocalFiles, uploadLocalFile, streamLocalFile,
  statLocalFile, deleteLocalFile, mkdirLocal, renameLocal,
  userRootPath,
} from "../services/localFileService.js";
import { config } from "../config/index.js";
import { Share } from "../models/Share.js";

const router = Router();
router.use(requireAuth);

// GET /files/storage-info
router.get("/storage-info", (req, res) => {
  const hostBase = config.LOCAL_FILES_HOST_PATH ?? config.LOCAL_FILES_ROOT;
  const email = req.user!.sub.replace(/[^a-zA-Z0-9._-]/g, "_");
  res.json({
    driver: "local",
    location: `${hostBase.replace(/[\/]+$/, "")}\${email}`,
  });
});

// GET /files?path=/some/dir
router.get("/", async (req, res, next) => {
  try {
    const files = await listLocalFiles(req.user!.sub, (req.query.path as string) || "/");
    res.json(files);
  } catch (e) { next(e); }
});

// POST /files/upload?path=/some/dir/file.txt   (raw body)
router.post("/upload", async (req, res, next) => {
  try {
    const filePath = (req.query.path as string) || "/untitled";
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", async () => {
      try {
        await uploadLocalFile(req.user!.sub, filePath, Buffer.concat(chunks));
        res.json({ ok: true });
      } catch (e) { next(e); }
    });
  } catch (e) { next(e); }
});

// GET /files/download?path=/some/file.txt
router.get("/download", async (req, res, next) => {
  try {
    const filePath = (req.query.path as string) || "/";
    const stat = await statLocalFile(req.user!.sub, filePath);
    if (stat.isDirectory()) { res.status(400).json({ error: "Cannot download a directory" }); return; }
    const name = path.basename(filePath);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(name)}"`);
    res.setHeader("Content-Length", stat.size);
    streamLocalFile(req.user!.sub, filePath).pipe(res);
  } catch (e) { next(e); }
});

// POST /files/mkdir   body: { path: "/new/folder" }
router.post("/mkdir", async (req, res, next) => {
  try {
    await mkdirLocal(req.user!.sub, req.body?.path || "/untitled");
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// POST /files/create-folder   body: { path: "/new/folder/" }  (legacy compat)
router.post("/create-folder", async (req, res, next) => {
  try {
    await mkdirLocal(req.user!.sub, req.body?.path || "/untitled");
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// POST /files/create   body: { path: "/file.txt" }  — create blank/template file
router.post("/create", async (req, res, next) => {
  try {
    const filePath = (req.body?.path as string) || "/untitled.txt";
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
    const templates: Record<string, string> = {
      md: "# Untitled\n\n",
      csv: "Column A,Column B,Column C\n",
      html: "<!DOCTYPE html>\n<html>\n<head><title>Untitled</title></head>\n<body>\n\n</body>\n</html>\n",
    };
    await uploadLocalFile(req.user!.sub, filePath, Buffer.from(templates[ext] ?? ""));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// DELETE /files?path=/some/file.txt
router.delete("/", async (req, res, next) => {
  try {
    await deleteLocalFile(req.user!.sub, (req.query.path as string) || "/");
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// POST /files/rename   body: { from: "/old.txt", to: "/new.txt" }
router.post("/rename", async (req, res, next) => {
  try {
    await renameLocal(req.user!.sub, req.body?.from, req.body?.to);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── Share helpers ─────────────────────────────────────────────────────────────

async function verifySharedAccess(ownerEmail: string, filePath: string, userEmail: string): Promise<"view"|"edit"|null> {
  // Check exact path share
  const exact = await Share.findOne({ ownerEmail, path: filePath, sharedWith: userEmail });
  if (exact) return exact.permission as "view"|"edit";
  // Check parent directory shares
  const parts = filePath.split("/").filter(Boolean);
  for (let i = parts.length - 1; i > 0; i--) {
    const parentPath = "/" + parts.slice(0, i).join("/") + "/";
    const parentShare = await Share.findOne({ ownerEmail, path: parentPath, isDirectory: true, sharedWith: userEmail });
    if (parentShare) return parentShare.permission as "view"|"edit";
  }
  return null;
}

// POST /files/share   body: { path, sharedWith: string[], permission: "view"|"edit", isDirectory? }
router.post("/share", async (req, res, next) => {
  try {
    const email = req.user!.sub;
    const { path: filePath, sharedWith, permission = "view", isDirectory = false } = req.body;
    if (!filePath || !Array.isArray(sharedWith)) {
      res.status(400).json({ error: "path and sharedWith required" }); return;
    }
    const share = await Share.findOneAndUpdate(
      { ownerEmail: email, path: filePath },
      { ownerEmail: email, path: filePath, sharedWith, permission, isDirectory },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ ok: true, share });
  } catch (e) { next(e); }
});

// GET /files/shares  — list all shares this user created
router.get("/shares", async (req, res, next) => {
  try {
    const shares = await Share.find({ ownerEmail: req.user!.sub });
    res.json(shares);
  } catch (e) { next(e); }
});

// DELETE /files/share?path=...
router.delete("/share", async (req, res, next) => {
  try {
    await Share.deleteOne({ ownerEmail: req.user!.sub, path: req.query.path as string });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// GET /files/shared-with-me
router.get("/shared-with-me", async (req, res, next) => {
  try {
    const email = req.user!.sub;
    const shares = await Share.find({ sharedWith: email });
    const result = shares.map(s => ({
      ownerEmail: s.ownerEmail,
      path: s.path,
      isDirectory: s.isDirectory,
      permission: s.permission,
      name: path.basename(s.path.replace(/\/$/, "")) || s.path,
    }));
    res.json(result);
  } catch (e) { next(e); }
});

// GET /files/shared-browse?owner=...&path=...
router.get("/shared-browse", async (req, res, next) => {
  try {
    const ownerEmail = req.query.owner as string;
    const filePath   = (req.query.path as string) || "/";
    const userEmail  = req.user!.sub;
    if (!ownerEmail) { res.status(400).json({ error: "owner required" }); return; }
    const perm = await verifySharedAccess(ownerEmail, filePath, userEmail);
    if (!perm) { res.status(403).json({ error: "Access denied" }); return; }
    const files = await listLocalFiles(ownerEmail, filePath);
    res.json(files);
  } catch (e) { next(e); }
});

// GET /files/shared-download?owner=...&path=...
router.get("/shared-download", async (req, res, next) => {
  try {
    const ownerEmail = req.query.owner as string;
    const filePath   = req.query.path as string;
    const userEmail  = req.user!.sub;
    if (!ownerEmail || !filePath) { res.status(400).json({ error: "owner and path required" }); return; }
    const perm = await verifySharedAccess(ownerEmail, filePath, userEmail);
    if (!perm) { res.status(403).json({ error: "Access denied" }); return; }
    const stat = await statLocalFile(ownerEmail, filePath);
    if (stat.isDirectory()) { res.status(400).json({ error: "Cannot download a directory" }); return; }
    const name = path.basename(filePath);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(name)}"`);
    res.setHeader("Content-Length", stat.size);
    streamLocalFile(ownerEmail, filePath).pipe(res);
  } catch (e) { next(e); }
});

export default router;
export { verifySharedAccess };
