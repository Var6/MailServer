import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { config } from "./config/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import authRouter     from "./routes/auth.js";
import mailRouter     from "./routes/mail.js";
import calendarRouter from "./routes/calendar.js";
import contactsRouter from "./routes/contacts.js";
import filesRouter    from "./routes/files.js";
import internalRouter from "./routes/internal.js";
import tenantRouter   from "./routes/tenants.js";
import adminRouter    from "./routes/adminPanel.js";

const app = express();

// ── Security ─────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ?? "*", credentials: true }));
app.set("trust proxy", 1);

// ── Parsing ───────────────────────────────────────────────
app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());

// ── Rate limiting ─────────────────────────────────────────
const limiter     = rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 60_000, max: 20,  standardHeaders: true, legacyHeaders: false });
app.use(limiter);

// ── Health check ──────────────────────────────────────────
app.get("/health", (_req, res) => res.json({
  status: "ok",
  ts: new Date().toISOString(),
  db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
}));

// ── Routes ────────────────────────────────────────────────
app.use("/auth",      authLimiter, authRouter);
app.use("/mail",      mailRouter);
app.use("/calendar",  calendarRouter);
app.use("/contacts",  contactsRouter);
app.use("/files",     filesRouter);
app.use("/internal",  internalRouter);   // Not exposed via Nginx
app.use("/tenants",   tenantRouter);     // Superadmin: manage companies
app.use("/admin",     adminRouter);      // Admin: manage own company users

// ── Error handler ─────────────────────────────────────────
app.use(errorHandler);

// ── MongoDB connection ────────────────────────────────────
async function start() {
  try {
    await mongoose.connect(config.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 30000,
    });
    console.log("[db] MongoDB connected");

    app.listen(config.PORT, () => {
      console.log(`[api] Listening on :${config.PORT} (${config.NODE_ENV})`);
    });
  } catch (err) {
    console.error("[db] MongoDB connection failed:", err);
    process.exit(1);
  }
}

start();
export default app;
