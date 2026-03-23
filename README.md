# MailServer — Self-Hosted Multi-Tenant Mail Platform

Run your own private G Suite / Microsoft 365 on a single Windows PC. Host email, calendar, contacts, files, and LibreOffice Online for multiple companies at once, each with its own domain and strict data isolation.

---

## What's Included

| Feature | Technology |
|---|---|
| Email (SMTP / IMAP / POP3) | Postfix + Dovecot |
| Webmail UI | React + TypeScript + Tailwind (3-pane, Gmail-like) |
| Mail folders | Inbox, Sent, Drafts, Junk, Trash, Archive (auto-created per account) |
| Rich compose editor | Quill.js / Tiptap — bold, italic, underline, lists |
| Spam filtering | Rspamd + Bayesian learning |
| Antivirus | ClamAV |
| DKIM signing | Rspamd |
| External mail delivery | Brevo SMTP relay (bypasses ISP port 25 block) |
| Documents / Sheets / Slides | Collabora Online (LibreOffice — free & open source) |
| Calendar | Personal calendar + shared team calendar (CalDAV) |
| Contacts | Nextcloud CardDAV |
| File storage | Nextcloud Files (WebDAV) |
| REST API | Node.js + Express + TypeScript |
| Database | MongoDB (standalone) |
| Auth | JWT (15-min access token + 7-day refresh in httpOnly cookie), argon2id hashing |
| SSL | Self-signed (local) or Cloudflare Origin Certificate |
| Public access | Tailscale Funnel (zero port-forwarding, works behind CGNAT) |
| Reverse proxy | Nginx |
| Multi-tenant | Company Admins → Users, strict domain isolation |
| Billing | Per-tenant invoices with unpaid / paid / overdue status |
| Postfix TCP map | Node.js server (port 10023) — live MongoDB lookup, no restart needed for new domains |
| Auto-startup | Task Scheduler — starts everything automatically on login |
| Sleep prevention | keep-awake.ps1 — prevents Windows sleep while server is running |

---

## How Multi-Tenant Works

One installation serves multiple companies simultaneously.

```
Admin creates → citizenhousing.in   (admin: sales@citizenhousing.in, 20 users, 1 GB each)
Admin creates → citizenjaivik.com   (admin: cj-boss@citizenjaivik.com, 10 users, 2 GB each)
Admin creates → abc.com             (admin: boss@abc.com, 5 users, 512 MB each)
```

Each company gets:
- Its own email domain (`@citizenhousing.in`, `@citizenjaivik.com`, etc.)
- Its own admin who can only see and manage users within that domain
- Per-user storage quota enforced at the Dovecot level
- A user ceiling enforced at the API level before any new user is created

**Instant domain activation — no restart needed.**
When a new tenant is created, the API writes the new domain into MongoDB. Postfix's `virtual_mailbox_domains` map is backed by a Node.js TCP map server (port 10023) that queries MongoDB live on every lookup — zero container restarts required.

**Data isolation is enforced at two levels:**
1. JWT tokens contain `domain` and `role` set server-side — the client cannot forge these.
2. Every admin route applies `requireSameTenant()` middleware — a domain mismatch returns 403.

---

## Role System

| Role | Scope | Can Do |
|---|---|---|
| **Super Admin** | System-wide | Create / edit / deactivate tenants; manage billing; create company admin accounts |
| **Admin** (Company Admin) | Own tenant only | Create / edit / deactivate users within their domain |
| **User** | Own account only | Send / receive email; calendar, contacts, files, LibreOffice Online |

---

## Architecture

```
Internet
   │
   ▼
Tailscale Network  (zero-config, works behind CGNAT/residential ISP)
   │
   │  Tailscale Funnel → port 8082
   ▼
┌──────────────────────────── Windows PC ────────────────────────────┐
│                                                                      │
│  Nginx (8080 / 8082 / 8443)                                         │
│      ├── /          ──► React Webmail (Vite build)                  │
│      ├── /api       ──► Node.js API (port 3000)                     │
│      ├── /nextcloud ──► Nextcloud (PHP-FPM)                         │
│      └── /office    ──► Collabora Online                            │
│                                                                      │
│  Postfix (25/587) ──► Brevo SMTP relay ──► Internet                 │
│      │    TCP map (port 10023, Node.js) ← MongoDB live lookup       │
│      │                                                              │
│  Postfix ◄──► Dovecot (993/995/143/110)                             │
│      │             │                                                │
│      └── Rspamd ───┘   (spam filter + DKIM signing)                │
│               │                                                      │
│            ClamAV        (antivirus scanning)                        │
│                                                                      │
│  MongoDB     Redis     [named Docker volumes]                        │
│                                                                      │
│  keep-awake.ps1  (background — prevents Windows sleep)              │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Login Portals

| Portal | URL | Who uses it |
|---|---|---|
| Landing page | `/` | Public — features + User & Admin login cards |
| User portal | `/login` | Regular email users |
| Admin portal | `/admin/login` | Company Admins |
| Super Admin portal | `/superadmin/login` | Super Admins (direct URL, not on landing page) |

---

## Quick Start (Windows)

### 1. First-time setup

```bat
REM Clone the repo
git clone https://github.com/Var6/MailServer.git
cd MailServer

REM Copy and fill in your config
copy .env.example .env
notepad .env
```

Key `.env` values to set:
```
MAIL_DOMAIN=yourdomain.com
MAIL_HOSTNAME=mail.yourdomain.com
SMTP_RELAY_HOST=smtp-relay.brevo.com
SMTP_RELAY_USER=your-brevo-login@smtp-brevo.com
SMTP_RELAY_PASSWORD=xsmtpsib-your-key-here
SERVER_URL=https://your-tailscale-url
```

### 2. Start the server

Double-click **`start.bat`** (or run it from a terminal).

It will:
1. Launch `keep-awake.ps1` in background (PC won't sleep)
2. Wait for Docker Desktop to be ready (up to 3 min)
3. Generate a self-signed SSL cert if missing
4. Enable Tailscale Funnel for public access
5. Start all Docker containers
6. Wait for the API to be healthy
7. Create the superadmin account on first run

### 3. Install auto-start on login (run once as Administrator)

```powershell
# In PowerShell as Administrator:
.\scripts\install-startup.ps1
```

This registers a Windows Task Scheduler task called **MailServer-AutoStart** that runs `start.bat` automatically 60 seconds after every login (the delay gives Docker Desktop time to start first).

To remove it:
```powershell
Unregister-ScheduledTask -TaskName "MailServer-AutoStart" -Confirm:$false
```

---

## Sleep Prevention

`scripts/keep-awake.ps1` runs silently in the background whenever `start.bat` is launched. It:
- Calls `SetThreadExecutionState` every 55 seconds to prevent Windows from sleeping
- Sets power plan timeouts to 0 via `powercfg` (no sleep while plugged in)

The PC can still be **manually** shut down or restarted — it just won't auto-sleep.

---

## External Mail Delivery (Brevo)

Outbound mail is relayed through **Brevo** (formerly Sendinblue) to bypass residential ISP blocks on port 25 and ensure reliable delivery.

Setup:
1. Create a free Brevo account at brevo.com
2. Go to **Senders & IPs → Domains** and verify your domain (add DNS records they provide)
3. Go to **SMTP & API** and copy your SMTP login + key
4. Add to `.env`:
   ```
   SMTP_RELAY_HOST=smtp-relay.brevo.com
   SMTP_RELAY_USER=your-login@smtp-brevo.com
   SMTP_RELAY_PASSWORD=xsmtpsib-your-key
   ```

Brevo's free tier allows 300 emails/day.

---

## DNS Records (GoDaddy / any registrar)

For `yourdomain.com` (replace with your actual domain):

| Type | Name | Value | Purpose |
|---|---|---|---|
| A | `mail` | `your-public-ip` | Mail server hostname |
| MX | `@` | `mail.yourdomain.com` (priority 10) | Incoming mail routing |
| TXT | `@` | `v=spf1 include:spf.brevo.com ~all` | SPF (outbound auth) |
| TXT | `mail._domainkey` | *(from Brevo dashboard)* | DKIM signing |
| TXT | `_dmarc` | *(from Brevo dashboard)* | DMARC policy |

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

---

## Mail Folders

Every account automatically gets these folders (created by Dovecot on first login):

| Folder | Purpose |
|---|---|
| **INBOX** | Incoming mail |
| **Sent** | Copies of sent messages (saved automatically after each send) |
| **Drafts** | Draft messages |
| **Junk** | Spam (shown as "Spam" in the webmail sidebar) |
| **Trash** | Deleted messages |
| **Archive** | Archived mail |

---

## Monitoring & Maintenance

```powershell
# Check service status
docker compose -f docker-compose.yml -f docker-compose.apps.yml ps

# Tail logs
docker logs -f mailserver-api
docker logs -f mailserver-postfix
docker logs -f mailserver-dovecot

# Spam filter statistics
docker exec mailserver-rspamd rspamc stat

# MongoDB shell
docker exec -it mailserver-mongodb mongosh -u admin -p --authenticationDatabase admin

# Run health check
bash scripts/health-check.sh

# Stop all services
docker compose -f docker-compose.yml -f docker-compose.apps.yml down

# Start all services
docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d

# Update to latest version
git pull origin main
docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d --build
```

---

## Project Structure

```
MailServer/
├── start.bat                            # Start everything (Docker + Tailscale + keep-awake)
├── docker-compose.yml                   # Core: Postfix, Dovecot, MongoDB, Redis, Rspamd, ClamAV
├── docker-compose.apps.yml              # Apps: API, webmail, Nextcloud, Collabora, Nginx, cloudflared
├── .env.example                         # Config template
│
├── scripts/
│   ├── install-startup.ps1              # Register start.bat as Windows startup task (run as Admin)
│   ├── keep-awake.ps1                   # Prevent Windows sleep (launched by start.bat)
│   ├── setup-windows.ps1                # Full Windows bootstrap
│   ├── ddns-update.ps1                  # Dynamic DNS updater
│   ├── backup.sh                        # Backup mail data + MongoDB
│   ├── health-check.sh                  # Check all services
│   └── monitor.sh                       # Continuous monitoring + alerts
│
├── config/
│   ├── postfix/                         # main.cf, master.cf, virtual maps, TCP map client
│   ├── dovecot/                         # IMAP config, Sieve rules, checkpassword auth
│   ├── rspamd/                          # Spam filter + DKIM signing config
│   ├── nginx/                           # Reverse proxy config
│   └── mongodb/                         # DB init script
│
├── docker/
│   ├── postfix/                         # Dockerfile + entrypoint.sh (resolves API IP at startup)
│   └── dovecot/                         # Dockerfile + checkpassword.sh (auth via Node.js API)
│
├── backend/                             # Node.js + Express + TypeScript REST API
│   └── src/
│       ├── models/                      # User, Tenant, Bill, SharedEvent schemas
│       ├── routes/                      # auth, mail, calendar, contacts, files, admin, billing
│       ├── middleware/                  # requireAuth, requireRole, requireSameTenant
│       └── services/
│           ├── imapService.ts           # IMAP connection pool (ImapFlow)
│           └── smtpService.ts           # Nodemailer → Postfix port 10025 (no auth, internal)
│
└── frontend/                            # React + TypeScript + Tailwind + Vite webmail UI
    └── src/
        ├── pages/
        │   ├── LandingPage.tsx          # Public landing — User & Admin login cards
        │   ├── Login.tsx                # User login
        │   ├── AdminLogin.tsx           # Company Admin login
        │   ├── Inbox.tsx                # 3-pane mail view + compose
        │   ├── Calendar.tsx             # Personal + team calendar
        │   ├── Contacts.tsx             # Contacts list
        │   └── Files.tsx                # File manager + LibreOffice Online
        └── api/
            ├── client.ts                # Axios + token refresh + X-Mail-Pass header
            └── mailApi.ts               # Folders, messages, send, move, flag
```

---

## Approximate Resource Usage

| Service | RAM |
|---|---|
| Postfix + Dovecot | ~80 MB |
| Rspamd | ~150 MB |
| ClamAV | ~400 MB |
| Redis | ~30 MB |
| MongoDB | ~200 MB |
| Node.js API | ~100 MB |
| Nextcloud | ~200 MB |
| Collabora Online | ~1.5 GB |
| Nginx | ~40 MB |
| **Total** | **~2.7 GB** |

Minimum: 8 GB RAM. Recommended: 16 GB. Minimum free disk: 50 GB.

---

## Branches

| Branch | Purpose |
|---|---|
| `main` | Stable production release |
| `windows-deploy` | Windows-specific deployment (Tailscale, start.bat, keep-awake) |
