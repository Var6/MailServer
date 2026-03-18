# MailServer — Self-Hosted G Suite / M365 Alternative

A fully self-hosted workspace stack running on 2 Raspberry Pi 4s with automatic failover. Includes webmail, shared calendars, office suite (LibreOffice in the browser), file storage, and a full multi-tenant company/user management system.

---

## Login Portals

Three separate login portals — each role has its own dedicated URL and UI:

| Portal | URL | Who it's for | Theme |
|---|---|---|---|
| **User Portal** | `/login` | Regular email users | Blue (Gmail-like) |
| **Admin Portal** | `/admin/login` | Company Admins | Indigo |
| **Super Admin Portal** | `/superadmin/login` | Super Admins (system-wide) | Dark Purple |

Each portal enforces role checks — if the wrong role tries to log in, they see a clear error with a link to the correct portal.

---

## What's Included

| Feature | Technology |
|---|---|
| Email (SMTP/IMAP) | Postfix + Dovecot |
| Spam filtering | Rspamd + Bayesian learning |
| Antivirus | ClamAV |
| DKIM signing | Rspamd |
| Webmail UI | React + TypeScript (Gmail-like) |
| Rich text email compose | Tiptap editor (bold, italic, underline, lists, alignment, links, undo/redo) |
| REST API | Node.js + Express + TypeScript |
| Documents / Sheets / Slides | Nextcloud + Collabora Online (LibreOffice — free & open source) |
| Calendar | Personal (Nextcloud CalDAV) + Shared Team Calendar |
| Contacts | Nextcloud Contacts (CardDAV) |
| File storage | Nextcloud Files (WebDAV) |
| Database | MongoDB (Replica Set for HA) |
| SSL | Let's Encrypt via Certbot |
| High Availability | Keepalived (VRRP) + GlusterFS + MongoDB Replica Set |
| Load balancing | HAProxy |
| Containerization | Docker Compose |
| Multi-tenant | Super Admin → Company Admins → Users with strict data isolation |
| Billing | Per-tenant billing with outstanding/paid/overdue tracking |

---

## Architecture

```
                    Internet
                       |
              [DNS A → Virtual IP]
                       |
            [Keepalived VRRP VIP]
                /             \
         [Pi-1 MASTER]    [Pi-2 BACKUP]
              |                 |
         HAProxy            HAProxy
         Nginx              Nginx
         Postfix            Postfix
         Dovecot            Dovecot
         Rspamd             Rspamd
         Node API           Node API
         Nextcloud          Nextcloud
         MongoDB ←──RS──→  MongoDB
         Redis              Redis
         GlusterFS ←──────→ GlusterFS
```

When Pi-1 fails, Keepalived promotes Pi-2 in **~2 seconds**. GlusterFS keeps mail data, Nextcloud files, and SSL certs in sync between both Pis. MongoDB Replica Set keeps the database replicated with automatic primary election.

---

## Multi-Tenant Role System

Three roles with strict data isolation:

| Role | Can Do |
|---|---|
| **Super Admin** | Create/edit/deactivate companies (tenants); set max users and storage limits per company; manage billing and send invoices to tenants |
| **Admin** (Company Admin) | Create/edit/deactivate users within their own company only; cannot see other companies |
| **User** | Send/receive email with rich text compose, personal calendar, shared team calendar, contacts, files |

**Data isolation rules:**
- Admin A can never see, list, or modify Admin B's users — enforced at both middleware and DB query level
- `tenantDomain` on shared calendar events is always set server-side from the JWT, never from client input
- Admin can log in with any email address (not required to match the company domain) — the `tenantDomain` is explicitly set server-side at account creation

---

## Prerequisites

- 2× Raspberry Pi 4 (4 GB+ RAM recommended) with Raspberry Pi OS Bookworm 64-bit
- A domain name with DNS control
- Static LAN IPs for both Pis + one free LAN IP for the Virtual IP
- Router port forwarding: 25, 80, 443, 587, 993 → Virtual IP
- Docker and Docker Compose installed on both Pis

---

## Step 1 — Clone the Repository

```bash
git clone https://github.com/Var6/MailServer.git
cd MailServer
```

---

## Step 2 — Configure Your Environment

```bash
cp .env.example .env
nano .env
```

Fill in every value. The key ones:

```env
# Your domain
MAIL_DOMAIN=yourdomain.com
MAIL_HOSTNAME=mail.yourdomain.com

# Network (use your actual IPs)
VIRTUAL_IP=192.168.1.100        # A free LAN IP — this is what DNS points to
PI_PRIMARY_IP=192.168.1.10      # Pi-1 LAN IP
PI_SECONDARY_IP=192.168.1.11    # Pi-2 LAN IP

# Passwords — change ALL of these
MONGO_ROOT_PASSWORD=changeme
MONGO_APP_PASSWORD=changeme
REDIS_PASSWORD=changeme
JWT_SECRET=changeme-at-least-32-chars
JWT_REFRESH_SECRET=changeme-at-least-32-chars
NEXTCLOUD_ADMIN_PASSWORD=changeme
DOVECOT_INTERNAL_SECRET=changeme
```

---

## Step 3 — DNS Records

Add these records at your DNS provider. All A records point to your **public IP** (the one your router NATs from).

```
# Mail
MX    yourdomain.com               mail.yourdomain.com    priority 10
A     mail.yourdomain.com          YOUR_PUBLIC_IP
A     cloud.yourdomain.com         YOUR_PUBLIC_IP
A     office.yourdomain.com        YOUR_PUBLIC_IP

# SPF — allow only your mail server to send
TXT   yourdomain.com               "v=spf1 mx a:mail.yourdomain.com -all"

# DMARC
TXT   _dmarc.yourdomain.com        "v=DMARC1; p=quarantine; rua=mailto:admin@yourdomain.com"

# DKIM — key is printed at the end of setup-primary.sh
TXT   mail._domainkey.yourdomain.com   "v=DKIM1; k=rsa; p=<YOUR_PUBLIC_KEY>"
```

> DKIM: run `setup-primary.sh` first — it prints the exact TXT record value at the end.

---

## Step 4 — Bootstrap Pi-1 (Primary)

SSH into Pi-1 and run:

```bash
sudo bash scripts/setup-primary.sh
```

This installs Docker, GlusterFS, Keepalived (as MASTER), generates a DKIM key, and starts all services.

At the end it prints your **DKIM public key** — add that to DNS now.

---

## Step 5 — Bootstrap Pi-2 (Secondary)

SSH into Pi-2 and run:

```bash
sudo bash scripts/setup-secondary.sh
```

This installs the same stack but configures Keepalived as BACKUP (it takes over only when Pi-1 is down).

---

## Step 6 — Set Up Shared Storage (GlusterFS)

On Pi-1:

```bash
gluster peer probe 192.168.1.11   # Use Pi-2's actual IP
sudo bash scripts/setup-glusterfs.sh
```

This creates replicated volumes for `/gluster/mail`, `/gluster/nextcloud`, and `/gluster/ssl` — everything stays in sync between both Pis automatically.

---

## Step 7 — Initialize MongoDB Replica Set

On Pi-1:

```bash
sudo bash scripts/setup-mongodb-rs.sh
```

Connects to both MongoDB instances and initializes the replica set so the database is replicated.

---

## Step 8 — Get SSL Certificates

```bash
sudo bash scripts/setup-certificates.sh
```

Uses Certbot to get Let's Encrypt certs for `mail.yourdomain.com`, `cloud.yourdomain.com`, and `office.yourdomain.com`. Certs are stored in the shared GlusterFS volume so both Pis use the same cert.

---

## Step 9 — Start All Services

Run on **both Pis**:

```bash
docker compose up -d
docker compose -f docker-compose.apps.yml up -d
```

Wait ~2 minutes for ClamAV to load its signatures on first start.

Check everything is running:

```bash
bash scripts/health-check.sh
```

---

## Step 10 — Create the Super Admin Account

Run **once** after the stack is up:

```bash
SUPERADMIN_EMAIL=superadmin@yourdomain.com \
SUPERADMIN_PASS=YourSecurePassword123! \
bash scripts/seed-superadmin.sh
```

This creates the first superadmin account in MongoDB. Keep these credentials safe — this account can manage all companies.

The superadmin logs in at **`/superadmin/login`** — not the regular user login.

---

## Step 11 — Enable Office Suite (Collabora)

```bash
docker exec mailserver-nextcloud php occ app:install richdocuments
docker exec mailserver-nextcloud php occ config:app:set richdocuments wopi_url \
  --value="https://office.yourdomain.com"
```

After this, users can open `.docx`, `.xlsx`, `.pptx` files directly in the browser from Nextcloud Files.

---

## Using the System

### As Super Admin — `/superadmin/login`

The Super Admin portal has a distinctive dark purple theme so it's immediately obvious which portal you're in.

1. Log in at `https://mail.yourdomain.com/superadmin/login`
2. You land on **Tenants** — a list of all companies on the system
3. **Create a new company** (New Tenant):
   - Company name and mail domain (e.g. `acme.com`)
   - Admin login email (can be any email — gmail, personal, etc.)
   - Admin password
   - Max user accounts and storage per mailbox
4. **Edit a tenant** — adjust user limits, storage, activate/deactivate
5. **Billing** — create invoices per tenant, track outstanding/paid/overdue amounts, mark bills as paid

---

### As Company Admin — `/admin/login`

1. Log in at `https://mail.yourdomain.com/admin/login`
2. You land on **Users** — all accounts in your company
3. **Create users** — set username, password, display name, and mailbox quota
4. **Edit users** — change quota, activate/deactivate accounts
5. The stats bar shows total users, active users, and remaining slots from your quota

---

### As a Regular User — `/login`

1. Log in at `https://mail.yourdomain.com/login`
2. You get the full Gmail-like webmail interface:

| Section | What you can do |
|---|---|
| **Mail** | Read, compose (with rich text formatting), reply, forward. Folders in the sidebar: Inbox, Sent, Drafts, Spam, Trash, Archive. |
| **Calendar** | Personal calendar (Nextcloud CalDAV). Switch to **Team Calendar** to see and add company-wide events. |
| **Contacts** | CardDAV contacts synced with Nextcloud. |
| **Files** | Upload, download, organize files. Open documents, spreadsheets, and presentations in-browser with Collabora (LibreOffice). |

#### Rich Text Compose

The compose window has a full formatting toolbar:

| Button | Action |
|---|---|
| **B** | Bold |
| *I* | Italic |
| U | Underline |
| S | Strikethrough |
| H2 | Heading |
| — | Bullet list |
| 1. | Numbered list |
| Align | Left / Center / Right |
| Link | Insert / edit hyperlink |
| Undo / Redo | History navigation |
| Clear | Remove all formatting |

Emails are sent as real HTML so recipients see the formatting in any mail client.

---

## Email Client Setup (Outlook, Thunderbird, Apple Mail)

| Protocol | Server | Port | Security |
|---|---|---|---|
| IMAP (incoming) | mail.yourdomain.com | 993 | SSL/TLS |
| SMTP (outgoing) | mail.yourdomain.com | 587 | STARTTLS |
| CalDAV (calendar) | cloud.yourdomain.com | 443 | SSL |
| CardDAV (contacts) | cloud.yourdomain.com | 443 | SSL |

Username is the full email address. Password is the account password.

---

## Accessing Your Services

| Service | URL |
|---|---|
| **User login** (webmail) | `https://mail.yourdomain.com/login` |
| **Admin login** | `https://mail.yourdomain.com/admin/login` |
| **Super Admin login** | `https://mail.yourdomain.com/superadmin/login` |
| Nextcloud (Files / Calendar / Contacts / Office) | `https://cloud.yourdomain.com` |
| Collabora Online | Embedded inside Nextcloud |
| HAProxy Stats | `http://PI_IP:8404/stats` |

---

## Monitoring & Maintenance

```bash
# Check all services are healthy
bash scripts/health-check.sh

# Continuous monitoring with email/Slack alerts
nohup bash scripts/monitor.sh &

# Backup mail data and database
bash scripts/backup.sh

# View mail server logs
docker logs mailserver-postfix
docker logs mailserver-dovecot
docker logs mailserver-api

# Check MongoDB replica set status
docker exec mailserver-mongodb mongosh --eval "rs.status()"

# Check spam filter stats
docker exec mailserver-rspamd rspamc stat
```

---

## Failover Testing

```bash
# Simulate Pi-1 failure
sudo systemctl stop keepalived docker

# On Pi-2 — verify it grabbed the Virtual IP
ip addr show | grep 192.168.1.100    # Should appear here

# Restore Pi-1
sudo systemctl start docker keepalived
# Pi-1 automatically reclaims MASTER role (~2 seconds)
```

---

## Raspberry Pi 4 Resource Usage (Approximate)

| Service | RAM |
|---|---|
| Postfix + Dovecot | 80 MB |
| Rspamd | 150 MB |
| ClamAV | 400 MB |
| Redis | 30 MB |
| MongoDB | 200 MB |
| Node API | 100 MB |
| Nextcloud | 200 MB |
| Collabora Online | ~1.5 GB |
| Nginx + HAProxy | 30 MB |
| **Total** | **~2.7 GB** |

Pi 4 4 GB works. Pi 4 8 GB recommended if multiple users edit documents simultaneously.

---

## Project Structure

```
MailServer/
├── docker-compose.yml              # Core mail stack (Postfix, Dovecot, MongoDB, Redis, Rspamd, ClamAV)
├── docker-compose.apps.yml         # App layer (API, webmail, Nextcloud, Collabora, Nginx, HAProxy)
├── .env.example                    # Config template — copy to .env and fill in
├── config/
│   ├── postfix/                    # SMTP config, virtual domains/users/aliases
│   ├── dovecot/                    # IMAP config, checkpassword auth
│   ├── rspamd/                     # Spam filter + DKIM signing
│   ├── nginx/                      # Reverse proxy with SSL
│   ├── haproxy/                    # TCP proxy for SMTP/IMAP ports
│   ├── keepalived/                 # VRRP HA config (master + backup)
│   └── mongodb/                    # Replica set init script
├── docker/
│   ├── postfix/                    # ARM64 Postfix Dockerfile
│   └── dovecot/                    # ARM64 Dovecot Dockerfile + checkpassword.sh
├── backend/                        # Node.js / Express / TypeScript REST API
│   └── src/
│       ├── models/                 # Mongoose models: User, Domain, Tenant, SharedEvent, Bill
│       ├── routes/                 # auth, mail, calendar, contacts, files, admin, tenants, billing, internal
│       ├── middleware/             # requireAuth, requireRole, requireSameTenant
│       └── services/              # authService, imapService, smtpService, nextcloudService
├── frontend/                       # React + TypeScript + Tailwind webmail UI
│   └── src/
│       ├── pages/
│       │   ├── Login.tsx           # User portal — blue theme
│       │   ├── AdminLogin.tsx      # Company admin portal — indigo theme
│       │   ├── SuperAdminLogin.tsx # Super admin portal — dark purple theme
│       │   ├── Inbox.tsx           # 3-pane mail view
│       │   ├── Calendar.tsx        # Personal + Team calendar tabs
│       │   ├── Contacts.tsx
│       │   ├── Files.tsx
│       │   ├── superadmin/         # Tenants, Billing pages + modals
│       │   └── admin/              # Users page + Create/Edit modals
│       ├── components/
│       │   ├── Layout/             # Sidebar (role-conditional nav), Header, Layout
│       │   └── Mail/               # InboxList, MessageView, ComposeModal (Tiptap), FolderTree
│       └── api/                    # authApi, mailApi, adminApi, superadminApi, billingApi, sharedCalendarApi
└── scripts/
    ├── setup-primary.sh            # Bootstrap Pi-1
    ├── setup-secondary.sh          # Bootstrap Pi-2
    ├── setup-glusterfs.sh          # Create replicated GlusterFS volumes
    ├── setup-mongodb-rs.sh         # Initialize MongoDB Replica Set
    ├── setup-certificates.sh       # Get Let's Encrypt SSL certs
    ├── seed-superadmin.sh          # Create the first superadmin account (run once)
    ├── add-mail-user.sh            # CLI: add a mail user
    ├── health-check.sh             # Check all services
    ├── monitor.sh                  # Continuous monitoring + alerts
    └── backup.sh                   # Backup mail data + DB
```

---

## What Was Built

### Mail Stack (`docker-compose.yml`)
- **Postfix** — SMTP server with virtual mailboxes, SASL auth via Dovecot, Rspamd milter
- **Dovecot** — IMAP/POP3 + LMTP delivery + Sieve filtering, auth via checkpassword → API → MongoDB
- **Rspamd** — Spam filter with Bayesian learning (Redis-backed) + DKIM signing
- **ClamAV** — Antivirus scanning integrated with Postfix milter
- **MongoDB** — Primary database (users, tenants, shared events, bills) with Replica Set
- **Redis** — Rspamd cache

### Application Layer (`docker-compose.apps.yml`)
- **Node.js API** — JWT auth (access + refresh tokens), IMAP proxy, SMTP proxy, CalDAV/CardDAV/WebDAV proxy to Nextcloud, internal Dovecot auth endpoint, billing CRUD
- **React Webmail** — Gmail-like 3-pane inbox; Tiptap rich text compose; folder tree; calendar; contacts; files; three separate role-specific login portals
- **Nextcloud + Collabora Online** — Office suite (LibreOffice Docs/Sheets/Slides in the browser), Calendar, Contacts, Files
- **Nginx** — SSL reverse proxy for all web services
- **HAProxy** — TCP proxy for SMTP/IMAP across both Pis

### High Availability
- **Keepalived** — VRRP Virtual IP: Pi-1 is MASTER (priority 200), Pi-2 is BACKUP (priority 100). Failover in ~2 seconds
- **GlusterFS** — 2-way replicated filesystem for mail data, Nextcloud files, SSL certs
- **MongoDB Replica Set** — Synchronous replication with automatic primary election

### Multi-Tenant System
- **Three roles**: superadmin, admin (company admin), user — each with a dedicated login portal
- **Tenants page** (superadmin): create companies, set max users + storage limits, activate/deactivate
- **Billing page** (superadmin): per-tenant invoices with outstanding/paid/overdue status; global stats
- **Users page** (admin): create/edit/deactivate users within own company only
- **Strict isolation**: `requireSameTenant()` middleware + domain-filtered DB queries (double enforcement)
- **Admin email flexibility**: admins can log in with any email address — `tenantDomain` is set server-side at creation

### Rich Text Email Compose
- **Tiptap editor** — ProseMirror-based open source rich text editor
- **Formatting**: bold, italic, underline, strikethrough, heading, bullet list, ordered list, left/center/right align, hyperlink insertion
- **History**: undo, redo, clear all formatting
- **Output**: real HTML email sent to recipients; plain text fallback auto-generated
