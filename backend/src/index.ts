import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { config } from "./config/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import authRouter     from "./routes/auth.js";
import mailRouter     from "./routes/mail.js";
import calendarRouter from "./routes/calendar.js";
import contactsRouter from "./routes/contacts.js";
import filesRouter    from "./routes/files.js";

const app = express();

// Security
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN ?? "*",
  credentials: true,
}));
app.set("trust proxy", 1);

// Parsing
app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());

// Rate limiting
const limiter = rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 60_000, max: 20,  standardHeaders: true, legacyHeaders: false });
app.use(limiter);

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

// Routes
app.use("/auth",      authLimiter, authRouter);
app.use("/mail",      mailRouter);
app.use("/calendar",  calendarRouter);
app.use("/contacts",  contactsRouter);
app.use("/files",     filesRouter);

// Error handler (must be last)
app.use(errorHandler);

app.listen(config.PORT, () => {
  console.log(`[api] Listening on :${config.PORT} (${config.NODE_ENV})`);
});

export default app;
