# Complete Deployment Guide — Baby Steps (Windows)

Every single click. No experience required. You will end up with a live, multi-tenant email server accessible from anywhere in the world.

**Total time:** ~60 minutes (mostly waiting for downloads and DNS propagation).

**What you will have at the end:**
- Private email server for one or more companies (e.g. `you@yourcompany.com`)
- Webmail at `https://mail.yourdomain.com`
- Calendar, contacts, file storage
- LibreOffice Online (edit Word/Excel/PowerPoint in the browser)
- Outlook / Thunderbird / Gmail POP3 import works
- Accessible from anywhere — no router port-forwarding needed

---

## Prerequisites

| Requirement | Minimum |
|---|---|
| Windows 10 (version 1903 or later) or Windows 11 | x86_64 — ARM not tested |
| RAM | 8 GB (16 GB recommended) |
| Free disk space | 50 GB |
| Internet connection | Required throughout |
| A domain name | Any registrar (Namecheap, GoDaddy, etc.) |

---

## Part 1 — Install the Required Software

You need three things: **WSL2**, **Docker Desktop**, and **Git**.

---

### Step 1.1 — Enable WSL2

WSL2 (Windows Subsystem for Linux) is a built-in Windows feature. Docker Desktop requires it.

1. Click the **Start** button (Windows logo in the bottom-left of your screen)
2. Type `PowerShell` into the search bar
3. You will see **Windows PowerShell** appear in the results
4. **Right-click** it — a small menu appears
5. Click **Run as administrator**
6. A dialog box says "Do you want to allow this app to make changes to your device?" — click **Yes**
7. A blue window opens with a flashing cursor
8. Click inside the blue window so it is focused, then type or paste this command and press **Enter**:

```powershell
wsl --install
```

9. You will see output like:

```
Installing: Windows Subsystem for Linux
Windows Subsystem for Linux has been installed.
Installing: Ubuntu
Ubuntu has been installed.
The requested operation is successful.
```

10. When it asks you to restart — type `Y` and press **Enter**, or close PowerShell and restart manually from the Start menu

**After your PC restarts:**

11. A black window titled **Ubuntu** opens automatically and says "Installing, this may take a few minutes..."
12. Wait for it to finish (1–3 minutes)
13. It asks: **"Enter new UNIX username:"** — type any short username like `admin` and press **Enter**
14. It asks: **"New password:"** — type a password and press **Enter**. Nothing appears as you type — that is normal.
15. It asks: **"Retype new password:"** — type the same password again and press **Enter**
16. You will see `Installation successful!`
17. Close the Ubuntu window

WSL2 is now installed.

---

### Step 1.2 — Install Docker Desktop

Docker Desktop runs all the mail server components in isolated containers.

1. Open your web browser (Chrome, Edge, Firefox — any)
2. Go to: **https://www.docker.com/products/docker-desktop/**
3. Click the button that says **"Download for Windows"** (or "Download Docker Desktop for Windows — AMD64" if there are multiple options)
4. Wait for the file to download — it is about 500 MB, so this may take a few minutes
5. Open your **Downloads** folder and double-click the file named `Docker Desktop Installer.exe`
6. A dialog asks "Do you want to allow this app to make changes?" — click **Yes**
7. A setup window opens. Leave both checkboxes checked (Use WSL2, Add desktop shortcut) and click **Ok**
8. The installer runs — wait 2–4 minutes
9. When it says "Installation succeeded", click **Close**
10. Docker Desktop opens automatically. If it does not, find **Docker Desktop** on your desktop and double-click it.
11. The first launch shows a tutorial — you can click **Skip tutorial** or just close it
12. Look at the **taskbar** in the bottom-right of your screen, near the clock (you may need to click the small arrow ^ to see hidden icons)
13. You will see a **whale icon** with small dots moving — this means Docker is starting up
14. Wait until the whale icon is **still** (no moving dots) — this means Docker is ready. It takes about 1 minute.

> **If you see a message about WSL2 kernel update:** Click the link, download the small update file, run it (click Yes to permissions), then open Docker Desktop again.

Docker Desktop is now running.

---

### Step 1.3 — Install Git

Git is used to download the MailServer source code.

1. Open your browser and go to: **https://git-scm.com/download/win**
2. The download starts automatically. If it does not, click the link for **"64-bit Git for Windows Setup"**
3. Open the downloaded file (e.g. `Git-2.x.x-64-bit.exe`) from your Downloads folder
4. Click **Yes** on the permission dialog
5. Click **Next** on the first screen (license agreement)
6. Click **Next** on the "Select Destination Location" screen (keep default path)
7. Click **Next** on the "Select Components" screen (keep defaults)
8. Click **Next** on every remaining screen — all defaults are fine
9. Click **Install**
10. When done, uncheck "View Release Notes" and click **Finish**

Git is now installed.

---

## Part 2 — Get a Domain Name and Set Up Cloudflare

You need a domain name (e.g. `yourcompany.com`) and it must use Cloudflare as its DNS provider. Cloudflare is free.

---

### Step 2.1 — Buy a domain name

Skip this step if you already own a domain.

1. Open your browser and go to: **https://www.namecheap.com**
   (You can also use GoDaddy, Google Domains, Porkbun, or any other registrar)
2. In the search box at the top, type the domain name you want (e.g. `mycompany.com`) and press **Enter**
3. If it shows as "Available", click **Add to cart**
4. Click the cart icon (top right) and proceed to checkout
5. Complete the purchase. A `.com` domain costs about $10–15 per year.
6. After purchasing, you will receive a confirmation email. Keep it.

---

### Step 2.2 — Create a free Cloudflare account

1. Open your browser and go to: **https://dash.cloudflare.com/sign-up**
2. Enter your email address and choose a password
3. Click **Create Account**
4. Cloudflare sends you a verification email — open it and click the **Verify email** link
5. You are now on the Cloudflare dashboard

---

### Step 2.3 — Add your domain to Cloudflare

1. On the Cloudflare dashboard, click the big **"+ Add a domain"** button (or "Add site" if you see that wording)
2. Type your domain name (e.g. `mycompany.com`) in the box and click **Continue**
3. Select the **Free** plan — click **Continue**
4. Cloudflare scans your existing DNS records and shows them — click **Continue**
5. Cloudflare shows you **two nameserver addresses**, for example:
   ```
   arya.ns.cloudflare.com
   bob.ns.cloudflare.com
   ```
   These are unique to your account. Write them down or leave this tab open.

6. Now you need to point your domain to Cloudflare. Go back to the site where you bought your domain.

**If your domain is at Namecheap:**
   - Log in to Namecheap
   - Click **Domain List** in the left sidebar
   - Find your domain and click **Manage**
   - Scroll down to the **Nameservers** section
   - Click the dropdown that says "Namecheap BasicDNS" and change it to **Custom DNS**
   - Two text fields appear. Enter the two nameserver addresses Cloudflare gave you (one per field)
   - Click the green checkmark (save) button next to the fields

**If your domain is at GoDaddy:**
   - Log in to GoDaddy → My Products → Domains → click your domain
   - Click **DNS** → scroll to **Nameservers** → click **Change**
   - Select **I'll use my own nameservers** → enter Cloudflare's two nameservers → click **Save**

7. Go back to the Cloudflare tab and click **Done, check nameservers**
8. Cloudflare shows "Pending nameserver update" — this takes anywhere from 5 minutes to 2 hours
9. Cloudflare sends you an email when it is done, subject: "Your domain is now active on Cloudflare"
10. Wait for that email before proceeding

Your domain is now on Cloudflare.

---

## Part 3 — Download and Configure MailServer

---

### Step 3.1 — Open a terminal

1. Click the **Start** button
2. Type `cmd` in the search bar
3. Click **Command Prompt** — a black window with a blinking cursor opens

---

### Step 3.2 — Clone the repository

In the Command Prompt window, type these commands one at a time, pressing **Enter** after each:

```cmd
cd C:\
git clone https://github.com/Var6/MailServer.git
cd MailServer
```

You will see lines like `Cloning into 'MailServer'...` and a progress bar. Wait for it to finish.

---

### Step 3.3 — Create your configuration file

Still in Command Prompt, run:

```cmd
copy .env.example .env
notepad .env
```

Notepad opens with the configuration file. You need to fill in the values below. Find each line and replace `changeme` or the placeholder value with your actual value.

**Domain settings — replace with your actual domain:**
```
MAIL_DOMAIN=yourcompany.com
MAIL_HOSTNAME=mail.yourcompany.com
```

**Passwords — make up a strong password for each (write them down):**
```
MONGO_ROOT_PASSWORD=PickAStrongPassword1!
MONGO_APP_PASSWORD=PickAStrongPassword2!
REDIS_PASSWORD=PickAStrongPassword3!
NEXTCLOUD_ADMIN_PASSWORD=PickAStrongPassword4!
DOVECOT_INTERNAL_SECRET=PickAStrongPassword5!
RSPAMD_PASSWORD=PickAStrongPassword6!
```

**JWT secrets — must each be at least 32 random characters:**
```
JWT_SECRET=ThisMustBeAtLeast32CharactersLong1234
JWT_REFRESH_SECRET=ThisAlsoMustBe32CharactersLong5678
```

**Internal token — at least 16 characters:**
```
INTERNAL_AUTH_TOKEN=SixteenCharsMin1
```

**Superadmin account:**
```
SUPERADMIN_EMAIL=superadmin@yourcompany.com
SUPERADMIN_PASS=YourSuperAdminPassword!
```

**CORS — set to your actual domain:**
```
CORS_ORIGIN=https://mail.yourcompany.com
```

**Cloudflare Tunnel token — leave blank for now (filled in later):**
```
CLOUDFLARE_TUNNEL_TOKEN=
```

After making all changes:
1. Press **Ctrl + S** to save
2. Close Notepad

> Keep this `.env` file safe. It contains all your passwords. Never commit it to Git.

---

## Part 4 — Run the Setup Script

This script bootstraps everything — Docker volumes, config files, builds containers, and starts all services.

1. Click the **Start** button
2. Type `PowerShell` in the search bar
3. **Right-click** Windows PowerShell → **Run as administrator**
4. Click **Yes** on the permission dialog
5. In the blue PowerShell window, run:

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

When it asks "Do you want to change the execution policy?" — type `Y` and press **Enter**.

6. Then run:

```powershell
cd C:\MailServer
.\scripts\setup-windows.ps1
```

You will see a lot of text as the script:
- Verifies Docker Desktop is running
- Creates `data\` directories for all persistent storage
- Downloads and builds Docker containers (this takes **5–15 minutes** on first run — Docker is downloading ~2 GB of images)
- Starts all services
- Waits for the API to become healthy
- Seeds the superadmin account using `SUPERADMIN_EMAIL` and `SUPERADMIN_PASS` from your `.env`

When it finishes, you will see a green message with your server's local URL.

> **If the script says Docker is not running:** Look for the whale icon in your taskbar. Double-click it to open Docker Desktop. Wait until the whale stops animating, then run the script again.

---

## Part 5 — Set Up Cloudflare Tunnel

This makes your mail server accessible from anywhere on the internet — no router configuration needed.

Still in the PowerShell Administrator window:

```powershell
.\scripts\setup-cloudflare.ps1
```

The script will:

1. Install `cloudflared` via `winget` (Windows Package Manager) — automatic, no clicks needed
2. Open your browser at a Cloudflare login page — log in with your Cloudflare account credentials
3. After logging in, the browser says "You have successfully logged in" — go back to the PowerShell window
4. The script creates a tunnel named `mailserver`, saves the credentials file, and writes the tunnel token to your `.env`
5. It automatically creates a `CNAME` DNS record in Cloudflare pointing `mail.yourdomain.com` to your tunnel
6. It restarts the `cloudflared` Docker container with the new token

When finished, your server is live at `https://mail.yourdomain.com`.

---

## Part 6 — Get an SSL Certificate

SSL provides the padlock in the browser address bar. Without it, browsers show security warnings.

### Option A — Cloudflare Origin Certificate (recommended)

1. Open your browser and go to: **https://dash.cloudflare.com**
2. Click on your domain name in the list
3. In the left sidebar, click **SSL/TLS**
4. Click **Origin Server** (it appears as a sub-item under SSL/TLS)
5. Click the **Create Certificate** button
6. The form shows:
   - **Private key type**: RSA (2048) — leave as-is
   - **Hostnames**: make sure you see both `yourdomain.com` and `*.yourdomain.com` listed. If not, add them.
   - **Certificate validity**: 15 years — leave as-is
7. Click **Create**
8. A screen appears with two large text boxes: **Origin Certificate** (top) and **Private Key** (bottom)

Now save these two files to your MailServer folder:

**Save the certificate:**
9. Click inside the **Origin Certificate** text box and press **Ctrl+A** to select all, then **Ctrl+C** to copy
10. Click the **Start** button, type `Notepad`, and press **Enter** to open Notepad
11. Press **Ctrl+V** to paste
12. Click **File → Save As**
13. In the left panel of the Save dialog, click **This PC** → **Local Disk (C:)** → **MailServer** → **data** → **certs**
    (If the `certs` folder does not exist yet, right-click in the window and choose **New → Folder**, name it `certs`)
14. In the **File name** box at the bottom, type: `server.crt`
15. In the **Save as type** dropdown, change it from "Text Documents (*.txt)" to **All Files**
16. Click **Save**

**Save the private key:**
17. Back in Cloudflare, click inside the **Private Key** text box, press **Ctrl+A**, then **Ctrl+C**
18. In Notepad, click **File → New**
19. Press **Ctrl+V** to paste
20. Click **File → Save As**
21. Navigate to the same `C:\MailServer\data\certs\` folder
22. In the **File name** box, type: `server.key`
23. Change **Save as type** to **All Files**
24. Click **Save**

**Reload Nginx with the new certificate:**
25. Go back to your PowerShell Administrator window and run:

```powershell
docker compose -f docker-compose.apps.yml restart nginx
```

Your site now has a valid SSL certificate.

> **What about "Full (strict)" SSL mode?** In the Cloudflare dashboard, under SSL/TLS → Overview, set the mode to **Full (strict)**. This ensures end-to-end encryption between Cloudflare and your server.

---

## Part 7 — Add DNS Records for Email

Email requires special DNS records so other mail servers know how to send mail to you, and so your mail does not land in spam folders.

1. Open your browser and go to: **https://dash.cloudflare.com**
2. Click on your domain
3. In the left sidebar, click **DNS**
4. Click **Records**

For each record below, click **+ Add record**, fill in the fields, and click **Save**.

---

**Record 1 — MX record (tells the internet where your mail server is)**

- Type: `MX`
- Name: `@`
- Mail server: `mail.yourdomain.com` ← replace `yourdomain.com` with your actual domain
- Priority: `10`
- Click **Save**
- After saving, look at the record. If you see an orange cloud icon next to it, click it to turn it grey. MX records **must not** be proxied through Cloudflare.

---

**Record 2 — SPF record (tells other servers which IPs are allowed to send from your domain)**

- Type: `TXT`
- Name: `@`
- Content: `v=spf1 mx a:mail.yourdomain.com ~all`
- Click **Save**

---

**Record 3 — DMARC record (tells other servers what to do with failed SPF/DKIM checks)**

- Type: `TXT`
- Name: `_dmarc`
- Content: `v=DMARC1; p=quarantine; rua=mailto:admin@yourdomain.com`
  (replace `admin@yourdomain.com` with your actual admin address)
- Click **Save**

---

**Record 4 — DKIM record (cryptographic signature that proves your domain sent the email)**

First, get your DKIM public key from the running server. Go to your PowerShell window and run:

```powershell
docker exec mailserver-rspamd cat /var/lib/rspamd/dkim/mail.pub
```

You will see a long line that starts with `v=DKIM1; k=rsa; p=...`. Copy everything from `v=DKIM1` to the end.

Back in Cloudflare:
- Type: `TXT`
- Name: `mail._domainkey`
- Content: paste the entire long text you just copied
- Click **Save**

---

All DNS records are now set up.

> DNS changes propagate gradually across the internet. Most records work within 5 minutes via Cloudflare, but allow up to 24 hours for full global propagation.

---

## Part 8 — Log In as Super Admin

1. Open your browser
2. Go to: `https://mail.yourdomain.com/superadmin/login`
   (replace `yourdomain.com` with your actual domain)
3. Enter:
   - Email: the `SUPERADMIN_EMAIL` you set in `.env` (e.g. `superadmin@yourdomain.com`)
   - Password: the `SUPERADMIN_PASS` you set in `.env`
4. Click **Sign in**

You are now in the Super Admin portal, on the **Tenants** page.

---

## Part 9 — Create Your First Company (Tenant)

A tenant is a company with its own email domain. Users within the tenant send and receive email as `user@thatdomain.com`.

1. You are on the **Tenants** page. Click the **New Tenant** button in the top-right corner.
2. A form appears. Fill it in:
   - **Company name**: the display name, e.g. `Citizen Jaivik`
   - **Domain**: the email domain for this company, e.g. `citizenjaivik.com`
     (This is the domain that appears in email addresses for this company's users.)
   - **Admin email**: the login email for the company admin, e.g. `admin@citizenjaivik.com`
     (This does not have to be on the company's domain — it can be any email address.)
   - **Admin password**: a password for the company admin
   - **Max users**: maximum number of email accounts this company can have, e.g. `20`
   - **Storage per user (MB)**: how much mailbox space each user gets, e.g. `2048` (= 2 GB)
3. Click **Create Tenant**

The tenant is created. The Postfix TCP map server immediately begins accepting email for `citizenjaivik.com` — no restart needed.

You can create as many tenants as you like. For example:
- `citizenjaivik.com` — admin: `admin@citizenjaivik.com`, 20 users, 2 GB each
- `citizenhousing.in` — admin: `chadmin@gmail.com`, 10 users, 1 GB each
- `abc.com` — admin: `boss@abc.com`, 5 users, 512 MB each

Each company is completely isolated from the others.

---

## Part 10 — Log In as Company Admin and Create Users

1. Open a new browser tab (or use the Admin login link on the landing page at `https://mail.yourdomain.com`)
2. Go to: `https://mail.yourdomain.com/admin/login`
3. Enter the admin email and password you set when creating the tenant
4. Click **Sign in**
5. You are on the **Users** page, showing all users in your company's domain
6. Click the **New User** button
7. Fill in the form:
   - **Username**: the part before the `@` — e.g. `john` (the email will be `john@citizenjaivik.com`)
   - **Password**: a password for this user
   - **Display name** (optional): e.g. `John Smith`
8. Click **Create User**

The user `john@citizenjaivik.com` is now created and can log in.

Repeat for each user you want to add. You cannot exceed the **Max users** limit set by the Super Admin.

---

## Part 11 — Log In as a Regular User and Send an Email

1. Open a new browser tab
2. Go to: `https://mail.yourdomain.com/login`
3. Enter:
   - Email: `john@citizenjaivik.com`
   - Password: the password you just set
4. Click **Sign in**
5. You are in the inbox (3-pane view: folders on the left, message list in the middle, message content on the right)

**To send an email:**
1. Click the **Compose** button (pencil or edit icon, usually at the top of the left sidebar)
2. A compose window opens
3. In the **To** field, type the recipient's email address, e.g. `someone@gmail.com`
4. Click in the **Subject** field and type a subject
5. Click in the message body and type your message
6. Use the **toolbar** above the body to format text: **B** for bold, *I* for italic, **U** for underline, the list icons for bullet points and numbered lists
7. Click the **Send** button

The email is sent.

---

## Part 12 — Set Up Outlook

1. Open **Microsoft Outlook**
2. If this is the first time opening Outlook, it immediately asks for an email address. Otherwise, click **File** (top-left) → **Add Account**
3. Enter your email address, e.g. `john@citizenjaivik.com`
4. Click **Connect** (or **Advanced options** → check "Let me set up my account manually")
5. Select **IMAP** from the list of account types
6. Fill in the **Incoming mail** section:
   - Server: `mail.yourdomain.com`
   - Port: `993`
   - Encryption: `SSL/TLS`
7. Fill in the **Outgoing mail** section:
   - Server: `mail.yourdomain.com`
   - Port: `587`
   - Encryption: `STARTTLS`
8. Click **Next**
9. Enter your password when Outlook asks
10. Click **Connect**
11. Outlook verifies the settings — if it succeeds, click **Done**

Your email now syncs to Outlook.

> **Note on Cloudflare Tunnel:** Cloudflare Tunnel proxies HTTPS only. For Outlook to connect to IMAP/SMTP from outside your LAN, you need either Cloudflare Zero Trust TCP tunnels or to forward ports 993, 587 on your router. From the same local network as the server, connect directly to the PC's local IP address (e.g. `192.168.1.x`) instead of the domain name.

---

## Part 13 — Set Up Gmail POP3 Import

Gmail can import mail from your server via POP3, so all your mail appears in Gmail's inbox too.

1. Open **Gmail** in your browser
2. Click the **gear icon** in the top-right corner
3. Click **See all settings**
4. Click the **Accounts and Import** tab
5. Find the section **"Check mail from other accounts"** and click **Add a mail account**
6. A small window opens. Enter your email address, e.g. `john@citizenjaivik.com`
7. Click **Next**
8. Select **Import emails from my other account (POP3)** and click **Next**
9. Fill in the POP3 settings:
   - **Username**: `john@citizenjaivik.com`
   - **Password**: the user's password
   - **POP Server**: `mail.yourdomain.com`
   - **Port**: `995`
   - Check **Always use a secure connection (SSL) when retrieving mail**
   - Optionally check **Leave a copy of retrieved message on the server** if you also want mail in your webmail inbox
10. Click **Add Account**
11. Gmail asks: "Would you also like to be able to send mail as john@citizenjaivik.com?" — click **Yes**
12. Fill in:
    - **Name**: your display name
    - SMTP Server: `mail.yourdomain.com`
    - Port: `587`
    - Username: `john@citizenjaivik.com`
    - Password: the user's password
    - Select **Secured connection using TLS**
13. Click **Add Account**
14. Gmail sends a verification email to `john@citizenjaivik.com`. Open your webmail, find that email, and click the verification link.
15. Gmail can now send and receive as `john@citizenjaivik.com`

---

## Part 14 — Use LibreOffice Online

LibreOffice Online lets you open and edit Word, Excel, and PowerPoint files directly in the browser — no Microsoft Office required.

1. Log in as a regular user at `https://mail.yourdomain.com/login`
2. Click **Files** in the left sidebar
3. Click **Upload** and select a `.docx`, `.xlsx`, or `.pptx` file from your computer
4. The file appears in the list. Click it to select it.
5. Click the **Open in Office** button that appears
6. LibreOffice Online opens in your browser — you can edit the file directly, and changes are saved back to Nextcloud

**To disable the LibreOffice button** (if you have not set up Collabora):
1. Open `C:\MailServer\frontend\.env` in Notepad
2. Find the line: `VITE_COLLABORA_ENABLED=true`
3. Change it to: `VITE_COLLABORA_ENABLED=false`
4. Save and rebuild the frontend:
   ```powershell
   cd C:\MailServer
   docker compose -f docker-compose.apps.yml up -d --build
   ```

---

## Part 15 — Create Billing Records for a Tenant

As Super Admin, you can track invoices per company.

1. Log in at `https://mail.yourdomain.com/superadmin/login`
2. Click **Billing** in the left sidebar
3. Click **New Bill**
4. Fill in:
   - **Tenant**: select the company from the dropdown
   - **Amount**: e.g. `49.99`
   - **Currency**: e.g. `USD`
   - **Due date**: pick a date
   - **Notes**: optional — e.g. "Monthly hosting, March 2026"
5. Click **Create Bill**

The bill appears in the list with status **Unpaid**. When payment is received, click the bill and click **Mark as Paid**. Overdue bills can be marked manually or automatically when the due date passes.

---

## Troubleshooting

### Docker is not running

Look at the taskbar in the bottom-right of your screen (near the clock — click the small ^ arrow to see all icons). Find the **whale icon**.
- If the whale icon has moving dots — Docker is still starting up. Wait.
- If you do not see the whale icon at all — go to **Start → Docker Desktop** to launch it. Wait for the whale to stop moving.
- Only run MailServer commands after the whale is still.

### The website is not loading

First check all containers are running:
```powershell
docker compose ps
docker compose -f docker-compose.apps.yml ps
```

Every service should show `Up` or `running`. If any show `Exited`, check logs:
```powershell
docker logs mailserver-api
docker logs mailserver-nginx
```

Then check the Cloudflare tunnel is connected:
```powershell
docker logs mailserver-cloudflared
```

Look for `Connection established` in the output. If you see errors, check that `CLOUDFLARE_TUNNEL_TOKEN` in your `.env` is filled in, then run `docker compose -f docker-compose.apps.yml restart cloudflared`.

### I forgot the superadmin password

Edit your `.env` file, set a new `SUPERADMIN_PASS`, save, and re-run the seed script:

```powershell
cd C:\MailServer
bash scripts/seed-superadmin.sh
```

### Emails I send go to spam

This is common for new servers. Fix it:
1. Verify your SPF, DKIM, and DMARC DNS records are set correctly (Part 7)
2. Wait 24 hours for DNS propagation to complete globally
3. Check whether your ISP is blocking outbound port 25: try sending an email and look at the backend logs with `docker logs mailserver-postfix`. If you see "Connection refused" to port 25 of Gmail/Outlook, your ISP is blocking it.
4. Solution: configure an SMTP relay. Sign up for a free Mailgun or SendGrid account, get SMTP credentials, and add them to your `.env`:
   ```
   SMTP_HOST=smtp.mailgun.org
   SMTP_PORT=587
   SMTP_USER=postmaster@mg.yourdomain.com
   SMTP_PASS=your-mailgun-smtp-password
   ```
   Then restart Postfix: `docker compose restart postfix`

### I cannot receive emails from Gmail or Outlook

Check that your **MX record** has the orange cloud **OFF** (grey = DNS only) in Cloudflare. MX records cannot be proxied. Click the orange cloud next to the MX record to toggle it to grey.

### Nextcloud shows an error about trusted domains

Add your domain to the trusted domains list:
```powershell
docker exec mailserver-nextcloud php occ config:system:set trusted_domains 0 --value="mail.yourdomain.com"
```

### A container keeps restarting

Check its logs: `docker logs mailserver-SERVICENAME` (replace SERVICENAME with the container showing issues). The most common causes are wrong passwords in `.env` or a port already in use on the host.

---

## Quick Reference

### URLs

| URL | What it is |
|---|---|
| `https://mail.yourdomain.com` | Landing page + login cards |
| `https://mail.yourdomain.com/login` | User login |
| `https://mail.yourdomain.com/admin/login` | Company Admin login |
| `https://mail.yourdomain.com/superadmin/login` | Super Admin login |
| `https://mail.yourdomain.com/nextcloud` | Nextcloud (Files, Calendar, Contacts) |

### Default credentials

| Account | Email | Password |
|---|---|---|
| Super Admin | value of `SUPERADMIN_EMAIL` in `.env` | value of `SUPERADMIN_PASS` in `.env` |
| Company Admin | email set when creating the tenant | password set when creating the tenant |
| User | `username@theirdomain.com` | password set when creating the user |

### Email client settings

| Protocol | Server | Port | Security |
|---|---|---|---|
| IMAP | mail.yourdomain.com | 993 | SSL/TLS |
| POP3 | mail.yourdomain.com | 995 | SSL/TLS |
| SMTP | mail.yourdomain.com | 587 | STARTTLS |

---

## Maintenance

### Starting the server after a PC reboot

Docker Desktop is set to start with Windows automatically. All containers use `restart: unless-stopped` so they come back up on their own after Docker Desktop starts.

If something is not running after a reboot:
```powershell
cd C:\MailServer
docker compose up -d
docker compose -f docker-compose.apps.yml up -d
```

### Stopping the server

```powershell
cd C:\MailServer
docker compose down
docker compose -f docker-compose.apps.yml down
```

Your data is stored in named Docker volumes and is not deleted when you run `down`.

### Updating to a new version

```powershell
cd C:\MailServer
git pull origin main
docker compose up -d --build
docker compose -f docker-compose.apps.yml up -d --build
```

### Backing up your data

```bash
# Run in Git Bash or WSL
bash scripts/backup.sh
```

This creates a timestamped archive in `data\backups\` containing all mail, the MongoDB database dump, and configuration files.

### Checking service health

```bash
bash scripts/health-check.sh
```

### Continuous monitoring

```bash
bash scripts/monitor.sh
```

Runs in a loop, checks all services every 60 seconds (configurable via `MONITOR_INTERVAL` in `.env`), and sends alerts to `ALERT_EMAIL` or `SLACK_WEBHOOK_URL` if something goes down.
