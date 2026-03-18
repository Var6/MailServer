import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { getEvents } from "../services/nextcloudService.js";
import { SharedEvent } from "../models/SharedEvent.js";

const router = Router();
router.use(requireAuth);

// ── Personal calendar (Nextcloud CalDAV proxy) ────────────
router.get("/events", async (req, res, next) => {
  try {
    const start = (req.query.start as string) || new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const end   = (req.query.end   as string) || new Date(Date.now() + 30 * 86400000).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const events = await getEvents(req.user!.sub, req.userPassword!, start, end);
    res.json(events);
  } catch (e) { next(e); }
});

// ── Shared (company) calendar ─────────────────────────────
// tenantDomain is ALWAYS set server-side from JWT — clients never supply it

// GET /calendar/shared?start=ISO&end=ISO
router.get("/shared", async (req, res, next) => {
  try {
    const { start, end } = req.query as { start?: string; end?: string };
    const filter: Record<string, unknown> = { tenantDomain: req.user!.domain };
    if (start) filter.start = { $gte: new Date(start) };
    if (end)   filter.end   = { $lte: new Date(end) };
    const events = await SharedEvent.find(filter).sort({ start: 1 });
    res.json(events);
  } catch (e) { next(e); }
});

// POST /calendar/shared — create shared event
const eventSchema = z.object({
  title:       z.string().min(1),
  start:       z.string(),
  end:         z.string(),
  allDay:      z.boolean().default(false),
  description: z.string().optional(),
  color:       z.string().optional(),
});

router.post("/shared", async (req, res, next) => {
  try {
    const data = eventSchema.parse(req.body);
    const event = await SharedEvent.create({
      ...data,
      start: new Date(data.start),
      end:   new Date(data.end),
      tenantDomain: req.user!.domain,   // always from JWT
      createdBy: req.user!.sub,
    });
    res.status(201).json(event);
  } catch (e) { next(e); }
});

// PATCH /calendar/shared/:id
router.patch("/shared/:id", async (req, res, next) => {
  try {
    const event = await SharedEvent.findById(req.params.id);
    if (!event) { res.status(404).json({ error: "Event not found" }); return; }

    // Only creator or admin can edit
    if (event.tenantDomain !== req.user!.domain) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    if (event.createdBy !== req.user!.sub && !["admin","superadmin"].includes(req.user!.role)) {
      res.status(403).json({ error: "Only the creator or admin can edit this event" }); return;
    }

    const patch = z.object({
      title:       z.string().optional(),
      start:       z.string().optional(),
      end:         z.string().optional(),
      allDay:      z.boolean().optional(),
      description: z.string().optional(),
      color:       z.string().optional(),
    }).parse(req.body);

    Object.assign(event, patch);
    if (patch.start) event.start = new Date(patch.start);
    if (patch.end)   event.end   = new Date(patch.end);
    await event.save();
    res.json(event);
  } catch (e) { next(e); }
});

// DELETE /calendar/shared/:id
router.delete("/shared/:id", async (req, res, next) => {
  try {
    const event = await SharedEvent.findById(req.params.id);
    if (!event) { res.status(404).json({ error: "Event not found" }); return; }
    if (event.tenantDomain !== req.user!.domain) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    if (event.createdBy !== req.user!.sub && !["admin","superadmin"].includes(req.user!.role)) {
      res.status(403).json({ error: "Only the creator or admin can delete this event" }); return;
    }
    await event.deleteOne();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
