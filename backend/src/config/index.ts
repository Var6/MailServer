import { z } from "zod";

const envSchema = z.object({
  NODE_ENV:              z.enum(["development", "production", "test"]).default("production"),
  PORT:                  z.coerce.number().default(3000),

  // Database
  DB_HOST:               z.string().default("mariadb"),
  DB_PORT:               z.coerce.number().default(3306),
  DB_NAME:               z.string().default("mailserver"),
  DB_USER:               z.string(),
  DB_PASS:               z.string(),

  // Redis
  REDIS_HOST:            z.string().default("redis"),
  REDIS_PORT:            z.coerce.number().default(6379),
  REDIS_PASS:            z.string().optional(),

  // IMAP
  IMAP_HOST:             z.string().default("dovecot"),
  IMAP_PORT:             z.coerce.number().default(993),

  // SMTP
  SMTP_HOST:             z.string().default("postfix"),
  SMTP_PORT:             z.coerce.number().default(587),

  // JWT
  JWT_SECRET:            z.string().min(32),
  JWT_REFRESH_SECRET:    z.string().min(32),
  SESSION_TTL_SECONDS:   z.coerce.number().default(900),
  IMAP_POOL_IDLE_TTL_MS: z.coerce.number().default(600_000),

  // Nextcloud
  NEXTCLOUD_URL:              z.string().default("http://nextcloud"),
  NEXTCLOUD_ADMIN_USER:       z.string().default("admin"),
  NEXTCLOUD_ADMIN_PASSWORD:   z.string().default("changeme"),

  // Domain
  MAIL_DOMAIN:           z.string().default("yourdomain.com"),
});

export type Config = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌  Invalid environment variables:", parsed.error.flatten());
  process.exit(1);
}

export const config: Config = parsed.data;
