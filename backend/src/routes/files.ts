import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { listFiles, uploadFile } from "../services/nextcloudService.js";

const router = Router();
router.use(requireAuth);

router.use((_req, res, next) => {
  if (!process.env.NEXTCLOUD_URL) {
    res.status(503).json({ error: "Nextcloud not configured in this deployment." });
    return;
  }
  next();
});

// GET /files?path=/
router.get("/", async (req, res, next) => {
  try {
    const path = (req.query.path as string) || "/";
    const files = await listFiles(req.user!.sub, req.userPassword!, path);
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
        await uploadFile(req.user!.sub, req.userPassword!, path, content, contentType);
        res.json({ ok: true });
      } catch (e) { next(e); }
    });
  } catch (e) { next(e); }
});

export default router;
