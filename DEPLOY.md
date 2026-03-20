# Complete Deployment Guide — Baby Steps

This guide walks you through **every single step** to get MailServer running on your Windows PC and accessible from the internet. No experience required.

---

## What you will have at the end

- Your own private email server (e.g. `you@yourcompany.com`)
- A webmail interface at `https://mail.yourdomain.com`
- Calendar, contacts, and file storage
- LibreOffice Online (edit Word/Excel/PowerPoint files in the browser)
- Accessible from anywhere in the world

**Total time:** ~45 minutes (mostly waiting for downloads)

---

## Part 1 — Install the Required Software

You need three things installed before anything else: **WSL2**, **Docker Desktop**, and **Git**.

---

### 1.1 — Enable WSL2 (Windows Subsystem for Linux)

WSL2 is a feature built into Windows. Docker Desktop requires it.

1. Click the **Start** button (Windows logo, bottom left of your screen)
2. Type `PowerShell` in the search bar
3. You will see **Windows PowerShell** appear in the results
4. Right-click it → click **Run as administrator**
5. A blue window opens. Click **Yes** on the permission dialog
6. Copy and paste this command into the blue window, then press **Enter**:

```powershell
wsl --install
```

7. Wait for it to finish — it will say "The requested operation is successful"
8. **Restart your computer** when it asks you to

After restarting:

9. A black window titled "Ubuntu" will open automatically and say "Installing, this may take a few minutes..."
10. Wait for it to finish
11. It will ask you to **enter a username** — type any username (e.g. `admin`) and press **Enter**
12. It will ask for a **password** — type a password and press **Enter** (nothing will appear as you type — that is normal)
13. Close that window

WSL2 is now installed. ✅

---

### 1.2 — Install Docker Desktop

Docker Desktop runs all the mail server components in isolated containers.

1. Open your web browser (Chrome, Edge, Firefox — any)
2. Go to: **https://www.docker.com/products/docker-desktop/**
3. Click the button that says **"Download Docker Desktop for Windows"**
4. Wait for the file to download (it is about 500 MB)
5. Once downloaded, click the file in your downloads bar (or go to your Downloads folder and double-click `Docker Desktop Installer.exe`)
6. A setup window opens — click **OK** on any permission dialogs
7. Leave all options at their defaults and click **Install**
8. Wait for installation to complete (2–3 minutes)
9. Click **Close** when done
10. Docker Desktop will launch automatically — look for the **whale icon** 🐳 in your taskbar (bottom right, near the clock)
11. The whale icon will animate (moving dots) while Docker starts up
12. Wait until the whale icon **stops animating** — this means Docker is ready (takes about 1 minute)

> **If you see a message about WSL2 kernel update:**
> Click the link it shows, download the update, run it, then restart Docker Desktop.

Docker Desktop is now running. ✅

---

### 1.3 — Install Git

Git is used to download the MailServer code.

1. Go to: **https://git-scm.com/download/win**
2. The download will start automatically — wait for it
3. Open the downloaded file (e.g. `Git-2.x.x-64-bit.exe`)
4. Click **Next** on every screen — the defaults are all fine
5. Click **Install**
6. Click **Finish** when done

Git is now installed. ✅

---

## Part 2 — Get a Domain Name

You need a domain name (e.g. `yourcompany.com`) and it must use **Cloudflare** as its DNS provider. Cloudflare is free.

---

### 2.1 — Buy a domain name (skip if you already have one)

1. Go to: **https://www.namecheap.com** (or any registrar — Namecheap, GoDaddy, Google Domains, etc.)
2. In the search box, type the domain name you want (e.g. `mycompany.com`)
3. If it is available, click **Add to cart**
4. Complete the purchase (usually $10–15/year for a `.com`)
5. After purchase, go to your account and find your domain in the domain list

---

### 2.2 — Create a free Cloudflare account

1. Go to: **https://dash.cloudflare.com/sign-up**
2. Enter your email address and a password
3. Click **Create Account**
4. Cloudflare will send you a verification email — open it and click the verification link

---

### 2.3 — Add your domain to Cloudflare

1. After logging in to Cloudflare, click the big **"+ Add a domain"** button
2. Type your domain name (e.g. `mycompany.com`) and click **Continue**
3. Select the **Free** plan and click **Continue**
4. Cloudflare will scan your existing DNS records — click **Continue**
5. Cloudflare will show you **two nameserver addresses**, for example:
   ```
   arya.ns.cloudflare.com
   bob.ns.cloudflare.com
   ```
   These will be different for your account — write them down.
6. Now go back to where you bought your domain (Namecheap, GoDaddy, etc.)

**If your domain is at Namecheap:**
   - Log in to Namecheap
   - Click **Domain List** in the left sidebar
   - Click **Manage** next to your domain
   - Find the **Nameservers** section
   - Change the dropdown from "Namecheap BasicDNS" to **"Custom DNS"**
   - Enter the two nameserver addresses Cloudflare gave you
   - Click the green checkmark to save

7. Go back to Cloudflare and click **Done, check nameservers**
8. Cloudflare will say "Pending nameserver update" — this takes 5–30 minutes
9. You will get an email from Cloudflare when it is done saying "Your domain is now active"

Your domain is now on Cloudflare. ✅

---

## Part 3 — Download and Configure MailServer

---

### 3.1 — Open a terminal

1. Click the **Start** button
2. Type `cmd` in the search bar
3. Click **Command Prompt** to open it
4. A black window with a blinking cursor appears

---

### 3.2 — Download the MailServer code

In the Command Prompt window, type these commands one at a time, pressing **Enter** after each:

```cmd
cd C:\
git clone https://github.com/Var6/MailServer.git
cd MailServer
```

You will see text scrolling as Git downloads the files. Wait for it to finish.

---

### 3.3 — Create your configuration file

Still in Command Prompt:

```cmd
copy .env.example .env
notepad .env
```

Notepad will open with the configuration file. You need to fill in these values:

Find each line and replace it:

```
MAIL_DOMAIN=yourcompany.com          ← replace with your actual domain
MAIL_HOSTNAME=mail.yourcompany.com   ← replace with mail. + your domain
```

For the passwords — make up strong passwords for each one:

```
MONGO_ROOT_PASSWORD=PickAStrongPassword1!
MONGO_APP_PASSWORD=PickAStrongPassword2!
REDIS_PASSWORD=PickAStrongPassword3!
JWT_SECRET=ThisMustBeAtLeast32CharactersLong1234
JWT_REFRESH_SECRET=ThisAlsoMustBe32CharactersLong5678
NEXTCLOUD_ADMIN_PASSWORD=PickAStrongPassword4!
DOVECOT_INTERNAL_SECRET=PickAStrongPassword5!
INTERNAL_AUTH_TOKEN=SixteenCharsMin1
```

> **Important:** Write these passwords down somewhere safe. You will need them later.

When done editing:
1. Press **Ctrl + S** to save
2. Close Notepad

---

## Part 4 — Run the Setup Script

1. Click the **Start** button
2. Type `PowerShell` in the search bar
3. Right-click **Windows PowerShell** → click **Run as administrator**
4. Click **Yes** on the permission dialog
5. Type these commands one at a time, pressing **Enter** after each:

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

When it asks "Do you want to change the execution policy?", type `Y` and press **Enter**.

```powershell
cd C:\MailServer
.\scripts\setup-windows.ps1
```

You will see a lot of text appear as the script:
- Checks that Docker is running
- Creates folders for your data
- Downloads and builds all the Docker containers (this takes **5–15 minutes** — go make a coffee ☕)
- Starts all services
- Creates your superadmin account

When it finishes you will see a green message with your server's URLs.

> **If the script says Docker is not running:** Go to your taskbar (bottom right), find the whale icon 🐳, double-click it to open Docker Desktop, wait for it to start, then run the script again.

---

## Part 5 — Set Up Cloudflare Tunnel (Public Access)

This makes your mail server accessible from anywhere on the internet — no router configuration needed.

Still in the PowerShell Administrator window:

```powershell
.\scripts\setup-cloudflare.ps1
```

The script will:

1. **Install cloudflared** (the Cloudflare Tunnel program) — it does this automatically via `winget`
2. **Open your browser** at a Cloudflare login page — log in with your Cloudflare account
3. After logging in, your browser will say "You have successfully logged in" — go back to PowerShell
4. The script creates a tunnel called `mailserver` and saves the credentials
5. It updates your DNS records in Cloudflare automatically
6. It starts the tunnel

When finished, your server is live at `https://mail.yourdomain.com`.

---

## Part 6 — Get an SSL Certificate

SSL is the padlock 🔒 in the browser address bar. You need this for your webmail to work properly.

### Option A — Cloudflare Origin Certificate (easiest)

1. Open your browser and go to: **https://dash.cloudflare.com**
2. Click on your domain name in the list
3. In the left sidebar, click **SSL/TLS**
4. Click **Origin Server**
5. Click the **Create Certificate** button
6. Leave everything at defaults — make sure your domain and `*.yourdomain.com` are in the list
7. Click **Create**
8. You will see two text boxes: **Origin Certificate** and **Private Key**

Now save these to your MailServer folder:

9. Click the **Start** button, type `Notepad`, open it
10. Copy the entire text from the **Origin Certificate** box
11. Paste it into Notepad
12. Click **File → Save As**
13. Navigate to `C:\MailServer\data\certs\`
14. In the **File name** box, type `server.crt`
15. In the **Save as type** dropdown, select **All Files**
16. Click **Save**
17. Back in Cloudflare, copy the entire **Private Key** text
18. Open a new Notepad window (File → New)
19. Paste the private key
20. Save it as `C:\MailServer\data\certs\server.key` (same as above — All Files)

Restart Nginx to load the certificate:

21. Go back to your PowerShell Administrator window and run:

```powershell
docker compose -f docker-compose.apps.yml restart nginx
```

Your site now has HTTPS. ✅

---

## Part 7 — Set Up DNS Records for Email

Email needs special DNS records so other mail servers know how to send mail to you, and so your mail doesn't land in spam.

1. Go to: **https://dash.cloudflare.com**
2. Click your domain
3. Click **DNS** in the left sidebar
4. Click **Records**

You need to add these records. For each one, click **+ Add record**:

**Record 1 — MX record (tells the internet your mail server)**
- Type: `MX`
- Name: `@`
- Mail server: `mail.yourdomain.com` (replace with your actual domain)
- Priority: `10`
- Click **Save**
- ⚠️ Make sure the orange cloud (proxy) is **OFF** — click it to turn it grey

**Record 2 — SPF record (prevents spam spoofing)**
- Type: `TXT`
- Name: `@`
- Content: `v=spf1 mx a:mail.yourdomain.com ~all`
- Click **Save**

**Record 3 — DMARC record (email policy)**
- Type: `TXT`
- Name: `_dmarc`
- Content: `v=DMARC1; p=quarantine; rua=mailto:admin@yourdomain.com`
- Click **Save**

**Record 4 — DKIM record (email signature — prevents forgery)**

First, get your DKIM key. Go back to PowerShell and run:

```powershell
docker exec mailserver-rspamd cat /var/lib/rspamd/dkim/mail.pub
```

Copy the long text that appears (starts with `v=DKIM1;`).

Back in Cloudflare:
- Type: `TXT`
- Name: `mail._domainkey`
- Content: paste the long text you copied
- Click **Save**

All DNS records are now set up. ✅

---

## Part 8 — Log In as Super Admin

1. Open your browser
2. Go to: `https://mail.yourdomain.com/superadmin/login`
3. Enter the super admin email and password that the setup script created
   - Default email: `superadmin@yourdomain.com`
   - Password: the `SUPERADMIN_PASS` you set (check your `.env` file if you forget)
4. Click **Next**, then enter your password and click **Sign in**

You are now in the Super Admin portal. ✅

---

## Part 9 — Create Your First Company (Tenant)

As Super Admin you create "tenants" — each tenant is a company with its own email domain and users.

1. You are on the **Tenants** page (if not, click **Tenants** in the left sidebar)
2. Click the **New Tenant** button (top right)
3. Fill in the form:
   - **Company name**: e.g. `Acme Corp`
   - **Domain**: e.g. `acme.com` (the email domain for this company's users)
   - **Admin email**: the email address the company admin will use to log in (can be any email, e.g. `boss@gmail.com`)
   - **Admin password**: a password for the admin
   - **Max users**: how many email accounts this company can have (e.g. `10`)
   - **Storage per user**: how much mailbox space each user gets (e.g. `1024` MB = 1 GB)
4. Click **Create Tenant**

The company is created. The admin can now log in. ✅

---

## Part 10 — Log In as Company Admin and Create Users

1. Open a new browser tab
2. Go to: `https://mail.yourdomain.com/admin/login`
3. Enter the admin email and password you just set up
4. Click **Next** → enter password → **Sign in**
5. You are on the **Users** page
6. Click **New User**
7. Fill in:
   - **Username** (the part before the `@`, e.g. `john`)
   - **Password** for this user
   - **Display name** (optional, e.g. `John Smith`)
8. Click **Create User**

The user `john@acme.com` is now created. ✅

---

## Part 11 — Log In as a Regular User and Send an Email

1. Open a new browser tab
2. Go to: `https://mail.yourdomain.com/login`
3. Enter `john@acme.com` and the password you just created
4. Click **Next** → enter password → **Sign in**
5. You are in the inbox

**To send an email:**
1. Click the **Compose** button (pencil icon, top of left sidebar)
2. In the **To** field, type the recipient's email address (e.g. `someone@gmail.com`)
3. Type a **Subject**
4. Type your message in the body
   - Use the toolbar to make text **bold**, *italic*, underlined, add bullet points, etc.
5. Click the **Send** button

The email is sent. ✅

---

## Part 12 — Set Up Email on Your Phone or Desktop Client

You can use Outlook, Thunderbird, Apple Mail, or any email app to access your new mail server.

**Settings to use:**

| Setting | Value |
|---|---|
| Your email address | `john@yourdomain.com` |
| Incoming server (IMAP) | `mail.yourdomain.com` |
| IMAP port | `993` |
| IMAP security | `SSL/TLS` |
| Outgoing server (SMTP) | `mail.yourdomain.com` |
| SMTP port | `587` |
| SMTP security | `STARTTLS` |
| Username | `john@yourdomain.com` (full email) |
| Password | the user's password |

### Setting up in Outlook (Windows)

1. Open **Outlook**
2. Click **File** in the top left
3. Click **Add Account**
4. Enter your email address and click **Connect**
5. Select **IMAP** (not Exchange)
6. Enter the incoming server settings above
7. Enter the outgoing server settings above
8. Click **Connect**
9. Enter your password when asked

### Setting up in Gmail (to fetch your mail)

1. Open **Gmail** in your browser
2. Click the **gear icon** ⚙️ (top right) → **See all settings**
3. Click the **Accounts and Import** tab
4. Under "Check mail from other accounts", click **Add a mail account**
5. Enter your email address (e.g. `john@yourdomain.com`) → click **Next**
6. Select **Import emails from my other account (POP3)** → click **Next**
7. Fill in:
   - Username: `john@yourdomain.com`
   - Password: user's password
   - POP server: `mail.yourdomain.com`
   - Port: `995`
   - Check **Always use a secure connection (SSL)**
8. Click **Add Account**
9. Gmail asks if you want to send mail as this address — click **Yes**
10. Fill in the SMTP settings and click **Next Step**, then **Add Account**

---

## Part 13 — Use Files and LibreOffice

1. Log in as a regular user
2. Click **Files** in the left sidebar
3. Click **Upload** to upload a file from your computer
4. To open a Word/Excel/PowerPoint file in the browser, click the file to select it, then click **Open in Office**
5. LibreOffice Online opens in the browser — you can edit the file directly

To **disable LibreOffice Online** (if you don't have Nextcloud + Collabora set up):
1. Open `C:\MailServer\frontend\.env` in Notepad
2. Find the line `VITE_COLLABORA_ENABLED=true`
3. Change it to `VITE_COLLABORA_ENABLED=false`
4. Save and rebuild the frontend

---

## Troubleshooting

### Docker is not running
- Look for the whale icon 🐳 in your taskbar (bottom right, near the clock)
- If you don't see it, go to **Start → Docker Desktop** to open it
- Wait until the whale stops animating before running any commands

### The website isn't loading
1. Check that all containers are running:
   ```powershell
   docker compose ps
   docker compose -f docker-compose.apps.yml ps
   ```
   All services should show `Up` or `running`
2. Check the Cloudflare tunnel is connected:
   ```powershell
   docker logs mailserver-cloudflared
   ```
   Look for "Connection established" in the output

### I forgot the superadmin password
Run this in PowerShell:
```powershell
docker exec -it mailserver-mongodb mongosh `
  -u admin -p YOUR_MONGO_ROOT_PASSWORD `
  --authenticationDatabase admin `
  --eval "db = db.getSiblingDB('mailserver'); db.users.updateOne({role:'superadmin'}, {\$set:{password: require('crypto').randomBytes(16).toString('hex')}})"
```
Then run the seed script again with a new password:
```powershell
$env:SUPERADMIN_EMAIL = "superadmin@yourdomain.com"
$env:SUPERADMIN_PASS  = "NewPassword123!"
bash scripts/seed-superadmin.sh
```

### Emails I send end up in spam
This is normal at first. Make sure:
1. Your SPF, DKIM, and DMARC DNS records are set (Part 7)
2. Wait 24 hours for DNS to fully propagate
3. Your ISP hasn't blocked outbound port 25 (very common on home internet — call them to unblock it, or use a relay like Mailgun)

### I can't receive emails from Gmail or Outlook
Check that your **MX record** has the orange cloud **OFF** (grey = DNS only) in Cloudflare. MX records cannot be proxied.

---

## Keeping Everything Running

### Starting the server after a reboot

If your PC restarts, Docker Desktop will restart automatically (it is set to start with Windows by default). The containers are set to `restart: unless-stopped` so they come back up on their own.

To manually start everything if needed:

```powershell
docker compose up -d
docker compose -f docker-compose.apps.yml up -d
```

### Stopping the server

```powershell
docker compose down
docker compose -f docker-compose.apps.yml down
```

### Updating to a new version

```powershell
cd C:\MailServer
git pull origin main
docker compose up -d --build
docker compose -f docker-compose.apps.yml up -d --build
```

### Backing up your data

```bash
# In Git Bash or WSL
bash scripts/backup.sh
```

This saves all mail, database, and configuration to a timestamped zip file.

---

## Quick Reference

| URL | What it is |
|---|---|
| `https://mail.yourdomain.com` | Landing page |
| `https://mail.yourdomain.com/login` | User login |
| `https://mail.yourdomain.com/admin/login` | Company Admin login |
| `https://mail.yourdomain.com/superadmin/login` | Super Admin login |

| Login | Default credentials |
|---|---|
| Super Admin | `superadmin@yourdomain.com` + password you set in `.env` |
| Company Admin | email + password set when creating the tenant |
| User | `username@yourdomain.com` + password set when creating the user |
