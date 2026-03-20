# MailServer — Self-Hosted Multi-Tenant Mail Platform

Run your own private G Suite / Microsoft 365 on a single Windows PC. Host email, calendar, contacts, files, and LibreOffice Online for multiple companies at once, each with its own domain and strict data isolation.

---

## What's Included

| Feature | Technology |
|---|---|
| Email (SMTP / IMAP / POP3) | Postfix + Dovecot |
| Webmail UI | React + TypeScript + Tailwind (3-pane, Gmail-like) |
| Rich compose editor | Quill.js / Tiptap — bold, italic, underline, lists |
| Spam filtering | Rspamd + Bayesian learning |
| Antivirus | ClamAV |
| DKIM signing | Rspamd |
| Documents / Sheets / Slides | Collabora Online (LibreOffice — free & open source) |
| Calendar | Personal calendar + shared team calendar (CalDAV) |
| Contacts | Nextcloud CardDAV |
| File storage | Nextcloud Files (WebDAV) |
| REST API | Node.js + Express + TypeScript |
| Database | MongoDB (standalone) |
| Auth | JWT (15-min access token + 7-day refresh in httpOnly cookie), argon2id hashing |
| SSL | Cloudflare Origin Certificate or Let's Encrypt |
| Public access | Cloudflare Tunnel (zero port-forwarding) or router forwarding |
| Reverse proxy | Nginx |
| Multi-tenant | Super Admin → Company Admins → Users, strict domain isolation |
| Billing | Per-tenant invoices with unpaid / paid / overdue status |
| Postfix TCP map | Node.js server (port 10023) — live MongoDB lookup, no restart needed for new domains |

---

## How Multi-Tenant Works

This is the core selling point. One installation serves multiple companies simultaneously.

```
Super Admin creates → citizenjaivik.com   (admin: cj-boss@gmail.com, 20 users, 2 GB each)
Super Admin creates → citizenhousing.in   (admin: ch-boss@gmail.com, 10 users, 1 GB each)
Super Admin creates → abc.com             (admin: boss@abc.com,      5  users, 512 MB each)
```

Each company (tenant) gets:
- Its own email domain (`@citizenjaivik.com`, `@citizenhousing.in`, etc.)
- Its own admin who can only see and manage users within that domain
- Per-user storage quota enforced at the Dovecot level
- A user ceiling enforced at the API level before any new user is created

**Instant domain activation — no restart needed.**
When a new tenant is created, the API writes the new domain into MongoDB. Postfix's `virtual_mailbox_domains` map is backed by a Node.js TCP map server (port 10023) that queries MongoDB live on every lookup. Postfix sees the new domain the moment the next email arrives — zero container restarts required.

**Data isolation is enforced at two levels:**
1. The JWT access token contains `domain` and `role` fields set server-side at login. The client cannot forge these.
2. Every admin-scoped route applies `requireSameTenant()` middleware, which fetches the target resource from MongoDB and checks that its `domain` matches `req.user.domain`. A mismatch returns 403.

---

## Multi-Tenant Role System

| Role | Scope | Can Do |
|---|---|---|
| **Super Admin** | System-wide | Create / edit / deactivate tenants; set max users and storage per tenant; view and manage billing for all tenants; create company admin accounts |
| **Admin** (Company Admin) | Own tenant only | Create / edit / deactivate users within their domain; cannot see other tenants or their users |
| **User** | Own account only | Send / receive email; use calendar, contacts, files, LibreOffice Online; cannot access admin panels |

Wrong-role login → clear error message with a link to the correct portal.

---

## Architecture

```
Internet
   │
   ▼
Cloudflare Edge  (your domain's DNS + DDoS protection)
   │
   │  Encrypted outbound tunnel (cloudflared)
   ▼
┌──────────────────────────── Windows PC ────────────────────────────┐
│                                                                      │
│  cloudflared ──► Nginx (80 / 443)                                   │
│                      ├── /          ──► React Webmail (Vite build)   │
│                      ├── /api       ──► Node.js API (port 3000)      │
│                      ├── /nextcloud ──► Nextcloud (PHP-FPM)          │
│                      └── /office    ──► Collabora Online             │
│                                                                      │
│  Postfix (25 / 587) ◄──► TCP map server (port 10023, Node.js)       │
│       │                         │                                    │
│       │                    MongoDB lookup (live, no restart)         │
│       │                                                              │
│  Postfix ◄──► Dovecot (993 / 995 / 143 / 110)                       │
│       │             │                                                 │
│       └── Rspamd ───┘   (spam filter + DKIM signing)                 │
│               │                                                      │
│            ClamAV        (antivirus scanning)                        │
│                                                                      │
│  MongoDB (standalone)     Redis     [named Docker volumes]           │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Login Portals

| Portal | URL | Who uses it |
|---|---|---|
| Landing page | `/` | Public — shows features + all 3 login cards |
| User portal | `/login` | Regular email users |
| Admin portal | `/admin/login` | Company Admins |
| Super Admin portal | `/superadmin/login` | Super Admins (system-wide) |

---

## Quick Start (Local Development)

```bash
git clone https://github.com/Var6/MailServer.git
cd MailServer

# First time: install npm dependencies
bash dev.sh --install

# Start both servers with colour-coded logs
bash dev.sh
```

`dev.sh` starts:
- Backend at `http://localhost:3000` (Node.js / Express, hot-reload via ts-node-dev)
- Frontend at `http://localhost:5173` (Vite, hot-reload)

In dev mode `SMTP_HOST` is left empty — outbound mail is captured by Ethereal (fake SMTP). A preview URL is printed to the backend console. No Postfix, Dovecot, or Docker required for development.

---

## Production Deployment (Windows)

See [DEPLOY.md](DEPLOY.md) for a complete baby-step guide. Summary:

```powershell
# 1. Clone
git clone https://github.com/Var6/MailServer.git
cd C:\MailServer

# 2. Configure
copy .env.example .env
notepad .env          # fill in domain, passwords, JWT secrets

# 3. Bootstrap (run as Administrator)
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
.\scripts\setup-windows.ps1

# 4. Public access via Cloudflare Tunnel
.\scripts\setup-cloudflare.ps1
```

---

## Email Client Settings

| Protocol | Server | Port | Security |
|---|---|---|---|
| IMAP (incoming) | mail.yourdomain.com | 993 | SSL/TLS |
| POP3 (incoming) | mail.yourdomain.com | 995 | SSL/TLS |
| SMTP (outgoing) | mail.yourdomain.com | 587 | STARTTLS |
| CalDAV (calendar) | mail.yourdomain.com | 443 | HTTPS |
| CardDAV (contacts) | mail.yourdomain.com | 443 | HTTPS |

Username = full email address (e.g. `user@yourdomain.com`).

> **Cloudflare Tunnel proxies HTTP/HTTPS only.** For IMAP/POP3/SMTP access from outside your LAN, either use Cloudflare Zero Trust TCP tunnels or forward ports 993, 995, and 587 on your router. Clients on the same local network connect directly to the PC's LAN IP.

---

## Billing System

Super Admin can create invoices per tenant from the **Billing** page:

- Amount, currency, due date, notes
- Status transitions: `unpaid` → `paid` / `overdue`
- Filter by tenant or status
- Mark paid records with a `paidAt` timestamp

The Bill model stores `tenantDomain`, `tenantName`, `amount`, `currency`, `dueDate`, `status`, `notes`, `paidAt`.

---

## LibreOffice Online Toggle

```bash
# frontend/.env
VITE_COLLABORA_ENABLED=true    # show "Open in Office" button (default)
VITE_COLLABORA_ENABLED=false   # hide button entirely
```

When enabled, users can open Word / Excel / PowerPoint files directly in the browser through Collabora Online (LibreOffice). Collabora requires ~1.5 GB RAM.

---

## ISP Port 25 Note

Many residential ISPs block outbound port 25. Your server can receive mail on port 25 fine, but it may not be able to send directly to Gmail, Outlook, etc.

**Solutions:**
1. **SMTP relay** (recommended) — configure Postfix to route outbound mail through Mailgun, SendGrid, or AWS SES. Set `SMTP_HOST` and `SMTP_PORT` in `.env`.
2. **Contact your ISP** — many will unblock port 25 on request for home server use.

---

## Running Tests

```bash
# Backend unit tests (Vitest)
cd backend && npm test

# Frontend unit tests (Vitest)
cd frontend && npm test
```

---

## Project Structure

```
MailServer/
├── dev.sh                           # Start frontend + backend in dev mode (colour logs)
├── docker-compose.yml               # Core mail stack: Postfix, Dovecot, MongoDB, Redis, Rspamd, ClamAV
├── docker-compose.apps.yml          # App layer: API, webmail, Nextcloud, Collabora, Nginx, cloudflared
├── .env.example                     # Config template — copy to .env and fill in values
│
├── config/
│   ├── postfix/                     # SMTP config, virtual domain/user maps, TCP map client
│   ├── dovecot/                     # IMAP/POP3 config, Sieve rules, checkpassword auth
│   ├── rspamd/                      # Spam filter config, DKIM key generation
│   ├── nginx/                       # Reverse proxy with SSL termination
│   ├── cloudflared/                 # Cloudflare Tunnel config
│   └── mongodb/                     # DB init script (standalone, no replica set)
│
├── docker/
│   ├── postfix/                     # Postfix Dockerfile + entrypoint.sh
│   └── dovecot/                     # Dovecot Dockerfile + checkpassword.sh
│
├── backend/                         # Node.js + Express + TypeScript REST API
│   └── src/
│       ├── models/
│       │   ├── User.ts              # User + Domain schemas (domain field used by Postfix/Dovecot)
│       │   ├── Tenant.ts            # Tenant (company) schema
│       │   ├── Bill.ts              # Billing invoice schema
│       │   └── SharedEvent.ts       # Shared calendar event schema
│       ├── routes/
│       │   ├── auth.ts              # Login, logout, refresh token
│       │   ├── mail.ts              # Send, list, fetch, delete messages (IMAP proxy)
│       │   ├── calendar.ts          # Personal calendar CRUD
│       │   ├── contacts.ts          # Contacts CRUD
│       │   ├── files.ts             # File upload/download (Nextcloud WebDAV)
│       │   ├── adminPanel.ts        # Company admin: list/create/edit/delete users
│       │   ├── tenants.ts           # Super admin: CRUD tenants
│       │   ├── billing.ts           # Super admin: create/update bills
│       │   └── internal.ts          # Dovecot auth + Postfix TCP map (internal network only)
│       ├── middleware/
│       │   ├── auth.ts              # requireAuth, requireRole, requireSameTenant
│       │   └── errorHandler.ts      # Global error handler
│       └── services/
│           ├── authService.ts       # argon2id hashing, JWT issue/verify, user creation with quota
│           ├── imapService.ts       # IMAP connection pool
│           └── smtpService.ts       # Nodemailer SMTP client
│
├── frontend/                        # React + TypeScript + Tailwind + Vite webmail UI
│   └── src/
│       ├── pages/
│       │   ├── LandingPage.tsx      # Public landing page — features + 3 login cards
│       │   ├── Login.tsx            # User login portal
│       │   ├── AdminLogin.tsx       # Company Admin login portal
│       │   ├── SuperAdminLogin.tsx  # Super Admin login portal
│       │   ├── Inbox.tsx            # 3-pane mail view + rich compose editor
│       │   ├── Calendar.tsx         # Personal + team calendar tabs
│       │   ├── Contacts.tsx         # Contacts list + edit
│       │   ├── Files.tsx            # File manager + LibreOffice Online toggle
│       │   ├── superadmin/
│       │   │   ├── Tenants.tsx      # Tenant list + create/edit modals
│       │   │   ├── Billing.tsx      # Invoice list + create/edit modals
│       │   │   ├── CreateTenantModal.tsx
│       │   │   ├── EditTenantModal.tsx
│       │   │   └── BillModal.tsx
│       │   └── admin/
│       │       ├── Users.tsx        # User list + create/edit modals
│       │       ├── CreateUserModal.tsx
│       │       └── EditUserModal.tsx
│       ├── components/
│       │   ├── Layout/              # Sidebar, Header, Layout wrapper
│       │   └── Mail/                # InboxList, MessageView, ComposeModal, FolderTree
│       └── api/
│           ├── client.ts            # Axios instance + token refresh interceptor
│           ├── authApi.ts
│           ├── mailApi.ts
│           ├── adminApi.ts
│           ├── superadminApi.ts
│           ├── billingApi.ts
│           └── sharedCalendarApi.ts
│
└── scripts/
    ├── setup-windows.ps1            # Full Windows bootstrap (run as Administrator)
    ├── setup-cloudflare.ps1         # Cloudflare Tunnel setup
    ├── seed-superadmin.sh           # Create the first superadmin account
    ├── setup-certificates.sh        # Let's Encrypt SSL via Certbot
    ├── health-check.sh              # Check all services
    ├── monitor.sh                   # Continuous monitoring + alerts
    ├── backup.sh                    # Backup mail data + MongoDB
    └── add-mail-user.sh             # Add a mail user at the OS level
```

---

## Monitoring & Maintenance

```powershell
# Check service status
docker compose ps
docker compose -f docker-compose.apps.yml ps

# Tail logs
docker logs -f mailserver-api
docker logs -f mailserver-postfix
docker logs -f mailserver-cloudflared

# Spam filter statistics
docker exec mailserver-rspamd rspamc stat

# MongoDB shell
docker exec -it mailserver-mongodb mongosh -u admin -p --authenticationDatabase admin

# Run health check
bash scripts/health-check.sh

# Continuous monitoring
bash scripts/monitor.sh

# Backup mail + database
bash scripts/backup.sh

# Stop all services
docker compose down && docker compose -f docker-compose.apps.yml down

# Start all services
docker compose up -d && docker compose -f docker-compose.apps.yml up -d

# Update to latest version
git pull origin main
docker compose up -d --build
docker compose -f docker-compose.apps.yml up -d --build
```

---

## Approximate Resource Usage

| Service | RAM |
|---|---|
| Postfix + Dovecot | ~80 MB |
| Rspamd | ~150 MB |
| ClamAV | ~400 MB |
| Redis | ~30 MB |
| MongoDB (standalone) | ~200 MB |
| Node.js API | ~100 MB |
| Nextcloud | ~200 MB |
| Collabora Online | ~1.5 GB |
| Nginx + cloudflared | ~40 MB |
| **Total** | **~2.7 GB** |

Minimum: 8 GB RAM. Recommended: 16 GB if multiple users edit documents simultaneously. Minimum free disk: 50 GB.

---

## Branches

| Branch | Purpose |
|---|---|
| `main` | Windows + Cloudflare Tunnel (primary) |
| `windows-deploy` | Windows-specific deployment scripts |
| `vercel-deploy` | Vercel (frontend) + Render (backend) + MongoDB Atlas |

---

## Accessing Services

| Service | URL |
|---|---|
| Landing page + Webmail | `https://mail.yourdomain.com` |
| Nextcloud (Files / Calendar / Contacts) | `https://mail.yourdomain.com/nextcloud` |
| Collabora Online | Embedded inside Nextcloud Files |
| API | `https://mail.yourdomain.com/api` |
