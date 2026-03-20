import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { Bill } from "../models/Bill.js";
import { Tenant } from "../models/Tenant.js";

const router = Router();
router.use(requireAuth, requireRole("superadmin"));

const billSchema = z.object({
  tenantDomain:  z.string(),
  amount:        z.coerce.number().positive(),
  currency:      z.string().default("USD"),
  dueDate:       z.string(),
  notes:         z.string().default(""),
});

// GET /billing — all bills, optionally filter by domain
router.get("/", async (req, res, next) => {
  try {
    const filter = req.query.domain ? { tenantDomain: req.query.domain } : {};
    const bills = await Bill.find(filter).sort({ createdAt: -1 });
    res.json(bills);
  } catch (e) { next(e); }
});

// POST /billing — create a bill for a tenant
router.post("/", async (req, res, next) => {
  try {
    const data = billSchema.parse(req.body);
    const tenant = await Tenant.findOne({ domain: data.tenantDomain });
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }

    // auto-mark overdue bills as overdue first
    await Bill.updateMany(
      { tenantDomain: data.tenantDomain, status: "unpaid", dueDate: { $lt: new Date() } },
      { status: "overdue" }
    );

    const bill = await Bill.create({
      tenantDomain: data.tenantDomain,
      tenantName: tenant.name,
      amount: data.amount,
      currency: data.currency,
      dueDate: new Date(data.dueDate),
      notes: data.notes,
    });
    res.status(201).json(bill);
  } catch (e) { next(e); }
});

// PATCH /billing/:id/status — mark paid / unpaid / overdue
router.patch("/:id/status", async (req, res, next) => {
  try {
    const { status } = z.object({ status: z.enum(["unpaid", "paid", "overdue"]) }).parse(req.body);
    const bill = await Bill.findByIdAndUpdate(
      req.params.id,
      { status, ...(status === "paid" ? { paidAt: new Date() } : { paidAt: undefined }) },
      { new: true }
    );
    if (!bill) { res.status(404).json({ error: "Bill not found" }); return; }
    res.json(bill);
  } catch (e) { next(e); }
});

// DELETE /billing/:id
router.delete("/:id", async (req, res, next) => {
  try {
    await Bill.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// GET /billing/summary — per-tenant bill summary for superadmin dashboard
router.get("/summary", async (req, res, next) => {
  try {
    const summary = await Bill.aggregate([
      { $group: {
        _id: "$tenantDomain",
        tenantName: { $first: "$tenantName" },
        totalBilled: { $sum: "$amount" },
        totalPaid: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0] } },
        unpaidCount: { $sum: { $cond: [{ $ne: ["$status", "paid"] }, 1, 0] } },
        lastBillDate: { $max: "$createdAt" },
      }},
      { $sort: { unpaidCount: -1 } }
    ]);
    res.json(summary);
  } catch (e) { next(e); }
});

export default router;
