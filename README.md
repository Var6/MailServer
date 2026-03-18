# MailServer — Cloud Deployment (No Pi / No SSL Required)

> **This is the `vercel-deploy` branch** — for deploying without Raspberry Pi hardware or manual SSL setup.
> - Frontend → **Vercel** (free, automatic SSL)
> - Backend → **Render.com** (free tier Node.js web service)
> - Database → **MongoDB Atlas** (free M0 cluster)
>
> For the full self-hosted Pi deployment, see the [`main` branch](https://github.com/Var6/MailServer).

---

## What Works in Cloud Mode

| Feature | Status |
|---|---|
| Login / JWT auth | ✅ Works |
| Super Admin → Manage companies (tenants) | ✅ Works |
| Company Admin → Manage users | ✅ Works |
| Shared Team Calendar | ✅ Works |
| Webmail inbox / send email | ❌ Needs Postfix + Dovecot |
| Contacts | ❌ Needs Nextcloud |
| Files / Office suite | ❌ Needs Nextcloud + Collabora |
| Personal calendar | ❌ Needs Nextcloud CalDAV |

The admin panels, role system, and team calendar are fully functional. Mail features gracefully return a "not configured" error instead of crashing.

---

## Step 1 — MongoDB Atlas (Free Database)

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) → **Create a free account**
2. Create a **free M0 cluster** (any region)
3. Under **Database Access** → Add a database user with a password
4. Under **Network Access** → Add IP `0.0.0.0/0` (allow all — Render's IPs change)
5. Click **Connect** → **Drivers** → copy the connection string:
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/mailserver?retryWrites=true&w=majority
   ```
   Save this — you'll need it for Render.

---

## Step 2 — Backend on Render.com (Free)

1. Go to [dashboard.render.com](https://dashboard.render.com) → **New → Web Service**
2. Connect your GitHub account and select the `MailServer` repo
3. Set these options:
   | Field | Value |
   |---|---|
   | Branch | `vercel-deploy` |
   | Root Directory | `backend` |
   | Runtime | `Node` |
   | Build Command | `npm install && npm run build` |
   | Start Command | `npm start` |
4. Under **Environment Variables**, add:

   | Key | Value |
   |---|---|
   | `MONGO_URI` | Your Atlas connection string from Step 1 |
   | `JWT_SECRET` | Click **Generate** — Render creates a secure value |
   | `JWT_REFRESH_SECRET` | Click **Generate** |
   | `CORS_ORIGIN` | Leave blank for now — fill in after Step 3 |
   | `NODE_ENV` | `production` |
   | `MAIL_DOMAIN` | `yourdomain.com` (or anything — not used in cloud mode) |

5. Click **Create Web Service** → wait for the build to finish (~2 min)
6. Copy your Render URL — it looks like `https://mailserver-api-xxxx.onrender.com`

> **Note:** Render free tier spins down after 15 min of inactivity. The first request after that takes ~30s to wake up. Upgrade to Starter ($7/mo) to avoid this.

---

## Step 3 — Frontend on Vercel (Free)

1. Go to [vercel.com](https://vercel.com) → **Add New → Project**
2. Import your GitHub `MailServer` repo
3. Configure the project:
   | Field | Value |
   |---|---|
   | Branch | `vercel-deploy` |
   | Root Directory | `frontend` |
   | Framework | Vite (auto-detected) |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |
4. Under **Environment Variables**, add:
   | Key | Value |
   |---|---|
   | `VITE_API_URL` | Your Render backend URL from Step 2 (e.g. `https://mailserver-api-xxxx.onrender.com`) |
5. Click **Deploy** → wait ~1 min

Copy your Vercel URL — it looks like `https://mailserver-xxxx.vercel.app`

---

## Step 4 — Connect Frontend ↔ Backend (CORS)

Go back to **Render → Your Service → Environment** and update:

| Key | Value |
|---|---|
| `CORS_ORIGIN` | Your Vercel URL (e.g. `https://mailserver-xxxx.vercel.app`) |

Click **Save Changes** — Render redeploys automatically.

---

## Step 5 — Create the Super Admin Account

After both services are running, seed the superadmin via the Render shell or a local `mongosh` connected to Atlas:

**Option A — Render Shell** (easiest):
1. In the Render dashboard → your service → **Shell**
2. Run:
   ```bash
   node -e "
   const mongoose = require('mongoose');
   const argon2 = require('argon2');
   mongoose.connect(process.env.MONGO_URI).then(async () => {
     const hash = await argon2.hash('YourPassword123!');
     await mongoose.connection.db.collection('users').updateOne(
       { email: 'superadmin@example.com' },
       { \$set: { email: 'superadmin@example.com', password: hash, role: 'superadmin',
                  domain: 'example.com', quotaMb: 1024, active: true, createdAt: new Date() } },
       { upsert: true }
     );
     console.log('Done');
     process.exit(0);
   });
   "
   ```

**Option B — Atlas Data Explorer**:
1. In Atlas → your cluster → **Browse Collections → mailserver → users**
2. Insert document:
   ```json
   {
     "email": "superadmin@example.com",
     "password": "<bcrypt hash of your password>",
     "role": "superadmin",
     "domain": "example.com",
     "quotaMb": 1024,
     "active": true,
     "createdAt": { "$date": "2025-01-01T00:00:00Z" }
   }
   ```
   > For the password hash, use [bcrypt-generator.com](https://bcrypt-generator.com) with cost 12.

---

## Using the App

Open your Vercel URL → log in with the superadmin credentials.

### Super Admin

- Land on **Tenants** page automatically
- **New Tenant** → create a company with domain, admin email, max users, storage limit
- The company admin can then log in and create users

### Company Admin

- Land on **Users** page automatically
- **New User** → enter username (email becomes `username@companydomain.com`), password, optional display name
- Edit or deactivate users from the table

### Regular User

- Land on **Mail** (inbox will show "mail server not configured" — expected in cloud mode)
- **Calendar → Team Calendar** tab — fully works, shows and creates shared company events
- Contacts and Files show "not configured" — expected

---

## Local Development (No Docker)

```bash
# 1. Start just MongoDB
docker compose -f docker-compose.dev.yml up -d mongodb

# 2. Start the backend
cd backend
cp ../.env.cloud.example .env   # edit MONGO_URI, JWT_SECRET etc.
npm install
npm run dev                     # starts on :3000

# 3. Start the frontend (new terminal)
cd frontend
VITE_API_URL=http://localhost:3000 npm run dev   # starts on :5173
```

Or use the full dev compose (MongoDB + API together):

```bash
docker compose -f docker-compose.dev.yml up -d
cd frontend && npm install && npm run dev
```

Then seed the superadmin:
```bash
SUPERADMIN_EMAIL=superadmin@localhost \
SUPERADMIN_PASS=ChangeMe123! \
bash scripts/seed-superadmin.sh
```

---

## Environment Variables Reference

### Backend (Render)

| Variable | Required | Description |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB Atlas connection string |
| `JWT_SECRET` | Yes | Min 32 chars — signs access tokens |
| `JWT_REFRESH_SECRET` | Yes | Min 32 chars — signs refresh tokens |
| `CORS_ORIGIN` | Yes | Your Vercel frontend URL |
| `NODE_ENV` | Yes | Set to `production` |
| `MAIL_DOMAIN` | No | Default domain label (cosmetic) |
| `IMAP_HOST` | No | Leave blank — disables mail routes gracefully |
| `SMTP_HOST` | No | Leave blank |
| `NEXTCLOUD_URL` | No | Leave blank — disables files/contacts/personal calendar |

### Frontend (Vercel)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | Your Render backend URL (no trailing slash) |

---

## Deploying Updates

Push to the `vercel-deploy` branch → both Vercel and Render auto-redeploy:

```bash
git checkout vercel-deploy
# make changes
git add . && git commit -m "your message"
git push origin vercel-deploy
```

---

## Switching to Full Self-Hosted (Pi) Later

When you have hardware:
1. Switch to the `main` branch
2. Follow the full setup guide in `main`'s README
3. All your MongoDB data (tenants, users) migrates by exporting from Atlas and importing to your self-hosted MongoDB

---

## Project Structure

```
MailServer/
├── vercel-deploy branch
│   ├── frontend/vercel.json        # Vercel build config
│   ├── render.yaml                 # Render.com backend config
│   ├── docker-compose.dev.yml      # Local dev (MongoDB only, no mail stack)
│   └── .env.cloud.example          # Cloud env var template
├── backend/                        # Node.js API — deployed to Render
│   └── src/
│       ├── routes/                 # mail/contacts/files return 503 if not configured
│       ├── models/                 # User, Tenant, SharedEvent (all work with Atlas)
│       └── config/index.ts         # IMAP/SMTP/Nextcloud default to blank (optional)
└── frontend/                       # React/Vite — deployed to Vercel
    └── src/
        ├── pages/superadmin/       # Tenant management (fully works)
        ├── pages/admin/            # User management (fully works)
        └── pages/Calendar.tsx      # Team Calendar tab (fully works)
```
