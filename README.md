# MailServer — Self-Hosted G Suite / M365 Alternative

A fully self-hosted workspace stack running on 2 Raspberry Pi 4s with automatic failover. Includes webmail, shared calendars, office suite (LibreOffice in the browser), file storage, and a full multi-tenant company/user management system.

---

## Quick Start (Local Development)

```bash
git clone https://github.com/Var6/MailServer.git
cd MailServer

# First time: install npm dependencies
bash dev.sh --install

# Every other time
bash dev.sh
```

Open [http://localhost:5173](http://localhost:5173) — the landing page loads with all three login portals.

> **Note:** In dev mode, `SMTP_HOST` is left empty on purpose. Emails are captured by Ethereal (a fake SMTP) and a preview URL is printed to the backend console — no real mail server needed to test the compose flow.

---

## Login Portals

Three separate portals — each role has its own dedicated URL, UI, and role enforcement:

| Portal | URL | Who it's for |
|---|---|---|
| **Landing page** | `/` | Public — shows features + all 3 login cards |
| **User Portal** | `/login` | Regular email users |
| **Admin Portal** | `/admin/login` | Company Admins |
| **Super Admin Portal** | `/superadmin/login` | Super Admins (system-wide) |

Wrong role at the wrong portal → clear error + link to the correct portal.

---

## What's Included

| Feature | Technology |
|---|---|
| Email (SMTP/IMAP/POP3) | Postfix + Dovecot |
| Webmail UI | React + TypeScript (Gmail-like 3-pane) |
| Spam filtering | Rspamd + Bayesian learning |
| Antivirus | ClamAV |
| DKIM signing | Rspamd |
| Documents / Sheets / Slides | Collabora Online (LibreOffice — free & open source) |
| Calendar | Personal (Nextcloud CalDAV) + Shared Team Calendar |
| Contacts | Nextcloud Contacts (CardDAV) |
| File storage | Nextcloud Files (WebDAV) |
| REST API | Node.js + Express + TypeScript |
| Database | MongoDB |
| SSL | Let's Encrypt via Certbot |
| High Availability | Keepalived (VRRP) + GlusterFS + MongoDB Replica Set |
| Load balancing | HAProxy |
| Multi-tenant | Super Admin → Company Admins → Users, strict data isolation |
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

When Pi-1 fails, Keepalived promotes Pi-2 in **~2 seconds**. GlusterFS keeps mail data, Nextcloud files, and SSL certs in sync. MongoDB Replica Set keeps the database replicated with automatic primary election.

---

## Multi-Tenant Role System

| Role | Can Do |
|---|---|
| **Super Admin** | Create/edit/deactivate companies; set max users and storage per company; manage billing |
| **Admin** (Company Admin) | Create/edit/deactivate users within their own company only |
| **User** | Send/receive email, calendar, contacts, files, LibreOffice online |

**Data isolation:** Admin A can never see or modify Admin B's users. `tenantDomain` is always set server-side from the JWT, never from client input.

---

## Email Client Setup (Outlook, Thunderbird, Apple Mail, Gmail)

| Protocol | Server | Port | Security |
|---|---|---|---|
| IMAP (incoming) | mail.yourdomain.com | 993 | SSL/TLS |
| POP3 (incoming) | mail.yourdomain.com | 995 | SSL/TLS |
| SMTP (outgoing) | mail.yourdomain.com | 587 | STARTTLS |
| CalDAV (calendar) | cloud.yourdomain.com | 443 | SSL |
| CardDAV (contacts) | cloud.yourdomain.com | 443 | SSL |

Username = full email address. Both IMAP and POP3 are enabled on Dovecot.

**To add your mail account in Gmail** (Settings → Accounts → "Add a mail account"):
- Use POP3 host `mail.yourdomain.com` port `995`, SSL enabled
- For sending via Gmail, add SMTP host `mail.yourdomain.com` port `587`, STARTTLS

---

## LibreOffice Online (Collabora)

Toggle the "Open in Office" button per deployment via environment variable:

```bash
# frontend/.env
VITE_COLLABORA_ENABLED=true    # default — show button
VITE_COLLABORA_ENABLED=false   # hide button entirely
```

Requires Collabora Online running at `office.yourdomain.com` (see Step 11 below).

---

## Production Deployment

### Prerequisites

- 2× Raspberry Pi 4 (4 GB+ RAM recommended) with Raspberry Pi OS Bookworm 64-bit
- A domain name with DNS control
- Static LAN IPs for both Pis + one free LAN IP for the Virtual IP
- Router port forwarding: 25, 80, 110, 143, 443, 465, 587, 993, 995 → Virtual IP
- Docker and Docker Compose installed on both Pis

### Step 1 — Clone

```bash
git clone https://github.com/Var6/MailServer.git
cd MailServer
```

### Step 2 — Configure Environment

```bash
cp .env.example .env
nano .env
```

Key values:

```env
MAIL_DOMAIN=yourdomain.com
MAIL_HOSTNAME=mail.yourdomain.com
VIRTUAL_IP=192.168.1.100
PI_PRIMARY_IP=192.168.1.10
PI_SECONDARY_IP=192.168.1.11
MONGO_ROOT_PASSWORD=changeme
MONGO_APP_PASSWORD=changeme
REDIS_PASSWORD=changeme
JWT_SECRET=changeme-at-least-32-chars
JWT_REFRESH_SECRET=changeme-at-least-32-chars
NEXTCLOUD_ADMIN_PASSWORD=changeme
DOVECOT_INTERNAL_SECRET=changeme
INTERNAL_AUTH_TOKEN=changeme-16-chars
```

### Step 3 — DNS Records

```
MX    yourdomain.com               mail.yourdomain.com    priority 10
A     mail.yourdomain.com          YOUR_PUBLIC_IP
A     cloud.yourdomain.com         YOUR_PUBLIC_IP
A     office.yourdomain.com        YOUR_PUBLIC_IP
TXT   yourdomain.com               "v=spf1 mx a:mail.yourdomain.com -all"
TXT   _dmarc.yourdomain.com        "v=DMARC1; p=quarantine; rua=mailto:admin@yourdomain.com"
TXT   mail._domainkey.yourdomain.com   "v=DKIM1; k=rsa; p=<YOUR_PUBLIC_KEY>"
```

> DKIM key is printed at the end of `setup-primary.sh`.

### Step 4 — Bootstrap Pi-1 (Primary)

```bash
sudo bash scripts/setup-primary.sh
```

### Step 5 — Bootstrap Pi-2 (Secondary)

```bash
sudo bash scripts/setup-secondary.sh
```

### Step 6 — Shared Storage (GlusterFS)

On Pi-1:

```bash
gluster peer probe 192.168.1.11
sudo bash scripts/setup-glusterfs.sh
```

### Step 7 — MongoDB Replica Set

On Pi-1:

```bash
sudo bash scripts/setup-mongodb-rs.sh
```

### Step 8 — SSL Certificates

```bash
sudo bash scripts/setup-certificates.sh
```

### Step 9 — Start All Services

On **both Pis**:

```bash
docker compose up -d
docker compose -f docker-compose.apps.yml up -d
```

Wait ~2 minutes for ClamAV to load its signatures on first start.

```bash
bash scripts/health-check.sh
```

### Step 10 — Create the Super Admin Account

Run **once** after the stack is up:

```bash
SUPERADMIN_EMAIL=superadmin@yourdomain.com \
SUPERADMIN_PASS=YourSecurePassword123! \
bash scripts/seed-superadmin.sh
```

### Step 11 — Enable LibreOffice Online (Collabora)

```bash
docker exec mailserver-nextcloud php occ app:install richdocuments
docker exec mailserver-nextcloud php occ config:app:set richdocuments wopi_url \
  --value="https://office.yourdomain.com"
```

---

## Using the System

### Super Admin (`/superadmin/login`)

1. Log in with your superadmin credentials
2. **Tenants** page: create companies, set max users + storage limits, activate/deactivate
3. **Billing** page: create bills per tenant, mark paid/overdue, view totals
4. Click the receipt icon on any tenant row to open their billing modal

### Company Admin (`/admin/login`)

1. Log in with your admin credentials
2. **Users** page: create/edit/deactivate users within your company only
3. Quota bar shows current users vs. your company's limit

### Regular User (`/login`)

| Section | What you can do |
|---|---|
| **Mail** | Read, compose (bold/italic/underline/lists/links), reply, forward. Folders in the sidebar. |
| **Calendar** | Personal calendar + shared Team Calendar. |
| **Contacts** | CardDAV contacts synced with Nextcloud. |
| **Files** | Upload, download, organize. Open docs/sheets/slides in LibreOffice Online. |

---

## Running Tests

```bash
# Backend (27 tests)
cd backend && npm test

# Frontend (19 tests)
cd frontend && npm test
```

---

## Monitoring & Maintenance

```bash
# Check all services
bash scripts/health-check.sh

# Continuous monitoring with alerts
nohup bash scripts/monitor.sh &

# Backup mail + database
bash scripts/backup.sh

# View logs
docker logs mailserver-postfix
docker logs mailserver-dovecot
docker logs mailserver-api

# MongoDB replica set status
docker exec mailserver-mongodb mongosh --eval "rs.status()"

# Spam filter stats
docker exec mailserver-rspamd rspamc stat
```

---

## Accessing Services

| Service | URL |
|---|---|
| Landing page + Webmail | `https://mail.yourdomain.com` |
| Nextcloud (Files / Calendar / Contacts) | `https://cloud.yourdomain.com` |
| Collabora Online | Embedded inside Nextcloud |
| HAProxy Stats | `http://PI_IP:8404/stats` |

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
├── dev.sh                          # Run frontend + backend in dev mode
├── docker-compose.yml              # Core mail stack (Postfix, Dovecot, MongoDB, Redis, Rspamd, ClamAV)
├── docker-compose.apps.yml         # App layer (API, webmail, Nextcloud, Collabora, Nginx, HAProxy)
├── .env.example                    # Config template
├── config/
│   ├── postfix/                    # SMTP config + pcre/hash virtual domain maps
│   ├── dovecot/                    # IMAP/POP3 config, Sieve, auth
│   ├── rspamd/                     # Spam filter + DKIM signing
│   ├── nginx/                      # Reverse proxy with SSL
│   ├── haproxy/                    # TCP proxy for SMTP/IMAP/POP3 ports
│   ├── keepalived/                 # VRRP HA config (master + backup)
│   └── mongodb/                    # Replica set init script
├── docker/
│   ├── postfix/                    # ARM64 Postfix Dockerfile + entrypoint (fetches domains from API)
│   └── dovecot/                    # ARM64 Dovecot Dockerfile + checkpassword.sh
├── backend/                        # Node.js / Express / TypeScript REST API
│   └── src/
│       ├── models/                 # User, Domain, Tenant, SharedEvent, Bill
│       ├── routes/                 # auth, mail, calendar, contacts, files, admin, tenants, billing, internal
│       ├── middleware/             # requireAuth, requireRole, requireSameTenant
│       └── services/              # authService, imapService, smtpService (Ethereal fallback in dev)
├── frontend/                       # React + TypeScript + Tailwind webmail UI
│   └── src/
│       ├── pages/
│       │   ├── LandingPage.tsx     # Public landing page (features + 3 login portal cards)
│       │   ├── Login.tsx           # User portal login
│       │   ├── AdminLogin.tsx      # Admin portal login
│       │   ├── SuperAdminLogin.tsx # Super Admin portal login
│       │   ├── Inbox.tsx           # 3-pane mail view + rich compose editor
│       │   ├── Calendar.tsx        # Personal + Team calendar tabs
│       │   ├── Contacts.tsx
│       │   ├── Files.tsx           # Files + LibreOffice Online toggle
│       │   ├── superadmin/         # Tenants, Billing pages + Create/Edit modals
│       │   └── admin/              # Users page + Create/Edit modals
│       ├── components/
│       │   ├── Layout/             # Sidebar (role-conditional nav), Header, Layout
│       │   └── Mail/               # InboxList, MessageView, ComposeModal (rich text), FolderTree
│       └── api/                    # authApi, mailApi, adminApi, superadminApi, billingApi
└── scripts/
    ├── setup-primary.sh            # Bootstrap Pi-1
    ├── setup-secondary.sh          # Bootstrap Pi-2
    ├── setup-glusterfs.sh          # Replicated GlusterFS volumes
    ├── setup-mongodb-rs.sh         # MongoDB Replica Set init
    ├── setup-certificates.sh       # Let's Encrypt SSL
    ├── seed-superadmin.sh          # Create the first superadmin (run once)
    ├── health-check.sh             # Check all services
    ├── monitor.sh                  # Continuous monitoring + alerts
    └── backup.sh                   # Backup mail data + DB
```
