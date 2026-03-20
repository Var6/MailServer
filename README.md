# MailServer — Self-Hosted G Suite / M365 Alternative

A fully self-hosted workspace stack deployable on a **single Windows PC**.
Includes webmail, shared calendars, office suite (LibreOffice in the browser),
file storage, and a full multi-tenant company/user management system.

Public access is provided by **Cloudflare Tunnel** — no static IP, no port
forwarding, no firewall changes required.

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
| Database | MongoDB (standalone) |
| SSL | Let's Encrypt via Certbot OR Cloudflare Origin Certificate |
| Public access | Cloudflare Tunnel (zero-config) OR router port forwarding |
| Reverse proxy | Nginx |
| Multi-tenant | Super Admin → Company Admins → Users, strict data isolation |
| Billing | Per-tenant billing with outstanding/paid/overdue tracking |

---

## Prerequisites

| Requirement | Notes |
|---|---|
| **Windows 10 (1903+) or Windows 11** | x86_64 — ARM not tested |
| **Docker Desktop 4.x+** | Must use the WSL2 backend |
| **WSL2** | Enabled in Windows Features |
| **8 GB RAM minimum** | 16 GB recommended (ClamAV alone uses ~400 MB) |
| **50 GB free disk** | MongoDB + mail storage + Docker images |
| **A domain name** | Added to Cloudflare with Cloudflare nameservers active |
| **Cloudflare account** | Free tier is sufficient for the tunnel |

> **Why Cloudflare?** Cloudflare Tunnel creates an outbound-only encrypted
> connection from your PC to Cloudflare's edge — your router never needs
> to open any ports.  Your domain's DNS is managed by Cloudflare, so the
> tunnel is wired up in minutes.

---

## Architecture

```
Internet
   │
   ▼
Cloudflare Edge (your domain's DNS)
   │
   │  Encrypted outbound tunnel (cloudflared)
   ▼
┌─────────────────────────── Windows PC ───────────────────────────┐
│                                                                    │
│  cloudflared ──► Nginx (80/443)                                   │
│                     ├── /api        ──► Node.js API (3000)        │
│                     ├── /           ──► React Webmail              │
│                     ├── /nextcloud  ──► Nextcloud (FPM)           │
│                     └── /office     ──► Collabora Online           │
│                                                                    │
│  Postfix (25/587/465) ◄──► Dovecot (993/995/143/110)             │
│       │                         │                                  │
│       └────── Rspamd ───────────┘                                 │
│                  │                                                  │
│               ClamAV                                               │
│                                                                    │
│  MongoDB (standalone)    Redis     [named Docker volumes]          │
└────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start (Local Development)

```bash
git clone https://github.com/Var6/MailServer.git
cd MailServer
git checkout windows-deploy

# Install npm dependencies (first time only)
bash dev.sh --install

# Start dev servers (hot reload)
bash dev.sh
```

Open [http://localhost:5173](http://localhost:5173).

> In dev mode `SMTP_HOST` is left empty — outbound mail is captured by
> Ethereal (a fake SMTP service) and a preview URL is printed to the
> backend console.  No real mail server needed.

---

## Production Deployment on Windows

### Step 1 — Clone the repository

```powershell
git clone https://github.com/Var6/MailServer.git
cd MailServer
git checkout windows-deploy
```

### Step 2 — Run the setup script (as Administrator)

Open **PowerShell as Administrator**, then:

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser   # allow scripts
cd C:\path\to\MailServer
.\scripts\setup-windows.ps1
```

The script will:
- Verify Docker Desktop is installed and running
- Create `data\` directories for all persistent state
- Copy `.env.example` to `.env` and prompt you to edit it
- Generate a self-signed TLS certificate (for local/dev testing)
- Build and start all Docker services
- Wait for the API to become healthy
- Seed the superadmin account

> **Important:** Edit `.env` when prompted.  At minimum you must set:
> `MAIL_DOMAIN`, `MAIL_HOSTNAME`, all passwords, and the two `JWT_*` secrets.

### Step 3 — Set up Cloudflare Tunnel (public access)

```powershell
.\scripts\setup-cloudflare.ps1
```

The script will:
1. Install `cloudflared` via `winget`
2. Open a browser for Cloudflare authentication
3. Create a tunnel named `mailserver`
4. Write the tunnel token to `.env`
5. Create DNS CNAME records automatically
6. Restart the `cloudflared` Docker container

After this step your server is live at `https://mail.yourdomain.com`.

#### Alternative: Router port forwarding

If you prefer direct port forwarding instead of Cloudflare Tunnel:

1. Assign your PC a static LAN IP (or DHCP reservation)
2. Forward these ports on your router to that IP:

| Port | Protocol | Service |
|------|----------|---------|
| 25   | TCP | SMTP (receiving mail) |
| 80   | TCP | HTTP (Let's Encrypt validation) |
| 443  | TCP | HTTPS |
| 587  | TCP | SMTP submission (client sending) |
| 993  | TCP | IMAPS |
| 995  | TCP | POP3S |

3. Point your domain's A record at your public IP
4. Disable the `cloudflared` service in `docker-compose.apps.yml`

### Step 4 — Get an SSL certificate

**Option A — Cloudflare Origin Certificate (recommended with Tunnel)**

1. In the Cloudflare dashboard go to **SSL/TLS → Origin Server**
2. Create a certificate for `*.yourdomain.com` and `yourdomain.com`
3. Save the certificate as `data\certs\server.crt` and the key as `data\certs\server.key`
4. Restart Nginx: `docker compose -f docker-compose.apps.yml restart nginx`

**Option B — Let's Encrypt (Certbot)**

Certbot requires port 80 to be publicly accessible.  With Cloudflare Tunnel,
temporarily expose port 80 by forwarding it at your router, run certbot, then
remove the forwarding rule.

```bash
# From Git Bash / WSL
bash scripts/setup-certificates.sh
```

Certbot runs inside Docker and stores certs in the `cert_data` volume which is
shared with Nginx and the mail services.

### Step 5 — Configure DNS records

Add these records in the Cloudflare dashboard (or your DNS provider):

```
MX    yourdomain.com               mail.yourdomain.com    priority 10
TXT   yourdomain.com               "v=spf1 mx a:mail.yourdomain.com ~all"
TXT   _dmarc.yourdomain.com        "v=DMARC1; p=quarantine; rua=mailto:admin@yourdomain.com"
TXT   mail._domainkey.yourdomain.com  <DKIM public key>
```

Get your DKIM public key after first start:

```powershell
docker exec mailserver-rspamd cat /var/lib/rspamd/dkim/mail.pub
```

> Set the MX record proxy status to **DNS only** (grey cloud) — MX records
> cannot be proxied through Cloudflare.

### Step 6 — Create the Super Admin account

The setup script does this automatically.  To run it manually:

```powershell
# PowerShell
$env:SUPERADMIN_EMAIL = "superadmin@yourdomain.com"
$env:SUPERADMIN_PASS  = "YourSecurePassword123!"

# Via Git Bash / WSL
bash scripts/seed-superadmin.sh
```

### Step 7 — Enable LibreOffice Online (Collabora)

```powershell
docker exec mailserver-nextcloud php occ app:install richdocuments
docker exec mailserver-nextcloud php occ config:app:set richdocuments wopi_url `
  --value="https://mail.yourdomain.com/office"
```

---

## Login Portals

| Portal | URL | Who it's for |
|---|---|---|
| **Landing page** | `/` | Public — shows features + all 3 login cards |
| **User Portal** | `/login` | Regular email users |
| **Admin Portal** | `/admin/login` | Company Admins |
| **Super Admin Portal** | `/superadmin/login` | Super Admins (system-wide) |

Wrong role at the wrong portal → clear error with a link to the correct portal.

---

## Email Client Setup (Outlook, Thunderbird, Apple Mail, Gmail)

| Protocol | Server | Port | Security |
|---|---|---|---|
| IMAP (incoming) | mail.yourdomain.com | 993 | SSL/TLS |
| POP3 (incoming) | mail.yourdomain.com | 995 | SSL/TLS |
| SMTP (outgoing) | mail.yourdomain.com | 587 | STARTTLS |
| CalDAV (calendar) | mail.yourdomain.com | 443 | SSL |
| CardDAV (contacts) | mail.yourdomain.com | 443 | SSL |

Username = full email address (e.g. `user@yourdomain.com`).

> **IMAP and POP3 with Cloudflare Tunnel:** Cloudflare Tunnel proxies
> HTTP/HTTPS only.  For IMAP/POP3/SMTP access from **outside your LAN**,
> you need either:
> - A Cloudflare Teams (Zero Trust) plan with TCP tunnels enabled, OR
> - Direct router port forwarding for ports 993, 995, and 587.
>
> Mail clients on the **same local network** as the PC always connect
> directly to your PC's LAN IP and need no tunnel.

**Adding your account in Gmail** (Settings → Accounts → "Add a mail account"):
- POP3 host `mail.yourdomain.com` port `995`, SSL enabled
- For sending via Gmail: SMTP host `mail.yourdomain.com` port `587`, STARTTLS

---

## ISP Port 25 Note

Many residential ISPs block **outbound** port 25 to prevent spam.
This means your server can **receive** email on port 25 fine, but it may
not be able to **send** directly to Gmail, Outlook, etc.

**Solutions:**
1. **SMTP relay** (recommended) — configure Postfix to route outbound mail
   through Mailgun, SendGrid, or AWS SES.  Update `SMTP_HOST` and `SMTP_PORT`
   in `.env` with your relay credentials.
2. **Contact your ISP** — many ISPs will unblock port 25 on request for
   home server use.

Inbound email (receiving on port 25) works fine via Cloudflare Tunnel since
the tunnel connection itself is outbound.

---

## How Public Access Works

```
You send email from Thunderbird
         │
         ▼
mail.yourdomain.com  (Cloudflare DNS)
         │
         ▼  Cloudflare routes to your tunnel
         │
   cloudflared (Docker container on your PC)
         │  (persistent outbound connection to Cloudflare edge)
         ▼
       Nginx  →  API / Webmail / Nextcloud
```

The `cloudflared` Docker container maintains a persistent, encrypted
outbound connection to Cloudflare's global network.  Your router never
needs to open any inbound ports for HTTPS traffic.

---

## Multi-Tenant Role System

| Role | Can Do |
|---|---|
| **Super Admin** | Create/edit/deactivate companies; set max users and storage per company; manage billing |
| **Admin** (Company Admin) | Create/edit/deactivate users within their own company only |
| **User** | Send/receive email, calendar, contacts, files, LibreOffice online |

**Data isolation:** Admin A can never see or modify Admin B's users.
`tenantDomain` is always set server-side from the JWT — never from client input.

---

## LibreOffice Online (Collabora)

Toggle the "Open in Office" button per deployment:

```bash
# frontend/.env
VITE_COLLABORA_ENABLED=true    # default — show button
VITE_COLLABORA_ENABLED=false   # hide button entirely
```

---

## Running Tests

```bash
# Backend (Vitest)
cd backend && npm test

# Frontend (Vitest)
cd frontend && npm test
```

---

## Monitoring & Maintenance

```powershell
# Check all service statuses
docker compose ps
docker compose -f docker-compose.apps.yml ps

# Tail logs
docker logs -f mailserver-api
docker logs -f mailserver-postfix
docker logs -f mailserver-cloudflared

# Spam filter stats
docker exec mailserver-rspamd rspamc stat

# MongoDB shell
docker exec -it mailserver-mongodb mongosh -u admin -p --authenticationDatabase admin

# Backup mail data and database (Git Bash / WSL)
bash scripts/backup.sh

# Stop everything
docker compose down
docker compose -f docker-compose.apps.yml down

# Start everything
docker compose up -d
docker compose -f docker-compose.apps.yml up -d
```

---

## Approximate Resource Usage (Windows PC)

| Service | RAM |
|---|---|
| Postfix + Dovecot | 80 MB |
| Rspamd | 150 MB |
| ClamAV | 400 MB |
| Redis | 30 MB |
| MongoDB (standalone) | 200 MB |
| Node API | 100 MB |
| Nextcloud | 200 MB |
| Collabora Online | ~1.5 GB |
| Nginx + cloudflared | 40 MB |
| **Total** | **~2.7 GB** |

Minimum 8 GB RAM recommended.  16 GB if multiple users edit documents
simultaneously.

---

## Accessing Services

| Service | URL |
|---|---|
| Landing page + Webmail | `https://mail.yourdomain.com` |
| Nextcloud (Files / Calendar / Contacts) | `https://mail.yourdomain.com/nextcloud` |
| Collabora Online | Embedded inside Nextcloud |

---

## Project Structure

```
MailServer/
├── dev.sh                           # Run frontend + backend in dev mode
├── docker-compose.yml               # Core mail stack (Postfix, Dovecot, MongoDB, Redis, Rspamd, ClamAV)
├── docker-compose.apps.yml          # App layer (API, webmail, Nextcloud, Collabora, Nginx, cloudflared)
├── .env.example                     # Config template (Windows-friendly)
├── config/
│   ├── postfix/                     # SMTP config + virtual domain maps
│   ├── dovecot/                     # IMAP/POP3 config, Sieve, auth
│   ├── rspamd/                      # Spam filter + DKIM signing
│   ├── nginx/                       # Reverse proxy with SSL
│   ├── cloudflared/                 # Cloudflare Tunnel config (Option B)
│   └── mongodb/                     # DB init script (standalone — no replica set)
├── docker/
│   ├── postfix/                     # Postfix Dockerfile (amd64) + entrypoint
│   └── dovecot/                     # Dovecot Dockerfile + checkpassword.sh
├── backend/                         # Node.js / Express / TypeScript REST API
│   └── src/
│       ├── models/                  # User, Domain, Tenant, SharedEvent, Bill
│       ├── routes/                  # auth, mail, calendar, contacts, files, admin, tenants, billing, internal
│       ├── middleware/              # requireAuth, requireRole, requireSameTenant
│       └── services/               # authService, imapService, smtpService
├── frontend/                        # React + TypeScript + Tailwind webmail UI
│   └── src/
│       ├── pages/
│       │   ├── LandingPage.tsx
│       │   ├── Login.tsx / AdminLogin.tsx / SuperAdminLogin.tsx
│       │   ├── Inbox.tsx            # 3-pane mail view + rich compose editor
│       │   ├── Calendar.tsx         # Personal + Team calendar tabs
│       │   ├── Contacts.tsx
│       │   ├── Files.tsx            # Files + LibreOffice Online toggle
│       │   ├── superadmin/          # Tenants, Billing pages + modals
│       │   └── admin/               # Users page + modals
│       ├── components/
│       │   ├── Layout/              # Sidebar, Header, Layout
│       │   └── Mail/                # InboxList, MessageView, ComposeModal, FolderTree
│       └── api/                     # authApi, mailApi, adminApi, superadminApi, billingApi
└── scripts/
    ├── setup-windows.ps1            # Full Windows bootstrap (run as Administrator)
    ├── setup-cloudflare.ps1         # Cloudflare Tunnel setup
    ├── seed-superadmin.sh           # Create the first superadmin (Bash / WSL)
    ├── setup-certificates.sh        # Let's Encrypt SSL
    ├── health-check.sh              # Check all services
    ├── monitor.sh                   # Continuous monitoring + alerts
    ├── backup.sh                    # Backup mail data + DB
    └── add-mail-user.sh             # Add a new mail user
```
