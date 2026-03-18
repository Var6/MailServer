import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getContacts } from "../services/nextcloudService.js";

const router = Router();
router.use(requireAuth);

router.use((_req, res, next) => {
  if (!process.env.NEXTCLOUD_URL) {
    res.status(503).json({ error: "Nextcloud not configured in this deployment." });
    return;
  }
  next();
});

// GET /contacts
router.get("/", async (req, res, next) => {
  try {
    const contacts = await getContacts(req.user!.sub, req.userPassword!);
    res.json(contacts);
  } catch (e) { next(e); }
});

export default router;
