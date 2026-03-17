import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getEvents } from "../services/nextcloudService.js";

const router = Router();
router.use(requireAuth);

// GET /calendar/events?start=20240101T000000Z&end=20240201T000000Z
router.get("/events", async (req, res, next) => {
  try {
    const start = (req.query.start as string) || new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const end   = (req.query.end   as string) || new Date(Date.now() + 30 * 86400000).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const events = await getEvents(req.user!.sub, req.userPassword!, start, end);
    res.json(events);
  } catch (e) { next(e); }
});

export default router;
