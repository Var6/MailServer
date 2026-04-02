import { z } from "zod";

const envSchema = z.object({
  NODE_ENV:              z.enum(["development", "production", "test"]).default("production"),
  PORT:                  z.coerce.number().default(3000),

  // MongoDB
  MONGO_URI:             z.string().default("mongodb://mailserver:changeme@mongodb:27017/mailserver?authSource=mailserver"),

  // Redis
  REDIS_HOST:            z.string().default("redis"),
  REDIS_PORT:            z.coerce.number().default(6379),
  REDIS_PASS:            z.string().optional(),

  // IMAP — leave blank in cloud/demo deployments without Dovecot
  IMAP_HOST:             z.string().default(""),
  IMAP_PORT:             z.coerce.number().default(993),

  // SMTP — leave blank in cloud/demo deployments without Postfix
  SMTP_HOST:             z.string().default(""),
  SMTP_PORT:             z.coerce.number().default(587),

  // JWT
  JWT_SECRET:            z.string().min(32),
  JWT_REFRESH_SECRET:    z.string().min(32),
  SESSION_TTL_SECONDS:   z.coerce.number().default(900),
  IMAP_POOL_IDLE_TTL_MS: z.coerce.number().default(600_000),

  // Internal auth token (for Dovecot checkpassword → API)
  INTERNAL_AUTH_TOKEN:   z.string().min(16).default("change-me-internal-secret"),

  // Nextcloud — leave blank in cloud/demo deployments
  NEXTCLOUD_URL:              z.string().default(""),
  NEXTCLOUD_ADMIN_USER:       z.string().default("admin"),
  NEXTCLOUD_ADMIN_PASSWORD:   z.string().default("changeme"),

  // File storage
  FILE_STORAGE_DRIVER:        z.enum(["local", "nextcloud"]).default("local"),
  LOCAL_FILES_ROOT:           z.string().default("./data/local-files"),
  LOCAL_FILES_HOST_PATH:      z.string().optional(),

  // Domain
  MAIL_DOMAIN:           z.string().default("yourdomain.com"),

  // Inbound webhook shared secret (Cloudflare Worker → API)
  INBOUND_WEBHOOK_SECRET: z.string().default(""),
});

export type Config = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌  Invalid environment variables:", parsed.error.flatten());
  process.exit(1);
}

export const config: Config = parsed.data;
