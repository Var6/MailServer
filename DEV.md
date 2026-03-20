# Developer Guide

Everything you need to run, test, and extend MailServer locally.

---

## Prerequisites

| Tool | Minimum version | Notes |
|---|---|---|
| Node.js | 18.x | LTS recommended |
| npm | 9.x | Ships with Node 18 |
| Git | Any recent version | For cloning and branching |
| Docker Desktop | 4.x | Only needed if you want to run MongoDB locally in Docker rather than MongoDB Atlas |

You do NOT need Postfix, Dovecot, Rspamd, ClamAV, or Nextcloud installed on your machine for development. The dev mode bypasses all of that.

---

## Clone and Install

```bash
git clone https://github.com/Var6/MailServer.git
cd MailServer

# Install all dependencies (both backend and frontend)
bash dev.sh --install
```

`--install` runs `npm install` in both `backend/` and `frontend/`. After the first time you only need to run it again when `package.json` changes.

If you prefer to install manually:

```bash
cd backend  && npm install
cd ../frontend && npm install
```

---

## Configure Environment Variables

`dev.sh` auto-creates `.env` files from the `.env.example` templates if they do not exist. You can also do it manually:

```bash
cp backend/.env.example  backend/.env
cp frontend/.env.example frontend/.env   # or manually create it (see below)
```

**Minimal `backend/.env` for development:**

```env
NODE_ENV=development
PORT=3000
MONGO_URI=mongodb://localhost:27017/mailserver   # or a MongoDB Atlas URI
JWT_SECRET=dev-secret-at-least-32-chars-long-1234
JWT_REFRESH_SECRET=dev-refresh-secret-32-chars-5678
INTERNAL_AUTH_TOKEN=dev-internal-token
CORS_ORIGIN=http://localhost:5173

# Leave these empty in dev — Ethereal fake SMTP is used instead
SMTP_HOST=
SMTP_PORT=587
IMAP_HOST=
IMAP_PORT=993
```

**Minimal `frontend/.env` for development:**

```env
VITE_API_URL=http://localhost:3000
VITE_COLLABORA_ENABLED=true
```

---

## Run in Development Mode

```bash
bash dev.sh
```

This starts both servers concurrently with colour-coded log output:

- **[backend]** (cyan) — Node.js + Express on `http://localhost:3000`
- **[frontend]** (magenta) — Vite dev server on `http://localhost:5173`

Both servers have hot-reload: save a file and the change is reflected immediately without restarting.

Press **Ctrl+C** to stop both servers cleanly.

### What happens in dev mode

| Feature | Dev behaviour |
|---|---|
| Outbound email | Captured by Ethereal (fake SMTP). A preview URL is printed to the backend console after each send. No real email is delivered. |
| Inbound email (IMAP) | Requires a real IMAP server. Either run Dovecot in Docker or use a test account on a real server. |
| MongoDB | Connect to a local MongoDB instance or MongoDB Atlas. No Docker required. |
| Postfix / Dovecot / Rspamd / ClamAV | Not needed for development |
| Nextcloud / Collabora | Not needed for development. The Files page works but file opening requires Nextcloud. |

To run MongoDB locally in Docker without the full stack:

```bash
docker run -d --name mongo-dev \
  -p 27017:27017 \
  -e MONGO_INITDB_DATABASE=mailserver \
  mongo:7
```

Then set `MONGO_URI=mongodb://localhost:27017/mailserver` in `backend/.env`.

---

## Running Tests

### Backend tests

```bash
cd backend
npm test
```

Uses Vitest. Tests live in `src/__tests__/`. There are currently tests for:
- `auth.test.ts` — login, token issue/verify, argon2id hashing
- `smtp.test.ts` — SMTP send (Ethereal)
- `utils.test.ts` — utility functions

To run in watch mode:

```bash
npm run test:watch
```

### Frontend tests

```bash
cd frontend
npm test
```

Uses Vitest + React Testing Library. Tests live in `src/test/`.

---

## Project Structure Explained

### Backend (`backend/src/`)

```
index.ts                   Entry point — creates Express app, mounts all routers, starts server
config/                    Loads and validates env vars (throws on startup if required vars missing)
models/
  User.ts                  User schema + Domain schema (domain field is used by Postfix/Dovecot)
  Tenant.ts                Tenant (company) schema
  Bill.ts                  Billing invoice schema
  SharedEvent.ts           Shared team calendar event schema
routes/
  auth.ts                  POST /auth/login, POST /auth/refresh, POST /auth/logout
  mail.ts                  GET/POST /mail/... — IMAP proxy + SMTP send
  calendar.ts              CRUD /calendar/events — personal calendar
  contacts.ts              CRUD /contacts
  files.ts                 GET/POST /files — Nextcloud WebDAV bridge
  adminPanel.ts            CRUD /admin/users — company admin manages own domain's users
  tenants.ts               CRUD /tenants — superadmin manages companies
  billing.ts               CRUD /billing/bills — superadmin manages invoices
  internal.ts              POST /internal/auth (Dovecot), GET /internal/virtual-* (Postfix TCP map)
middleware/
  auth.ts                  requireAuth, requireRole, requireSameTenant
  errorHandler.ts          Global Express error handler — formats errors as JSON
services/
  authService.ts           argon2id hash/verify, JWT issue/verify, user creation with quota enforcement
  imapService.ts           IMAP connection pool using node-imap
  smtpService.ts           Nodemailer wrapper — uses Ethereal in dev, real SMTP in production
types/
  index.ts                 TypeScript types: AuthTokenPayload, UserRole, etc.
```

### Frontend (`frontend/src/`)

```
main.tsx                   Vite entry — renders <App /> into #root
App.tsx                    React Router setup — all routes defined here
store/
  index.ts                 Zustand store — holds accessToken, email, role, domain, displayName
api/
  client.ts                Axios instance — attaches Bearer token, auto-refreshes on 401
  authApi.ts               login(), logout(), refresh()
  mailApi.ts               getFolders(), getMessages(), getMessage(), sendMail(), deleteMessage()
  adminApi.ts              getUsers(), createUser(), updateUser(), deleteUser()
  superadminApi.ts         getTenants(), createTenant(), updateTenant(), deleteTenant()
  billingApi.ts            getBills(), createBill(), updateBill()
  sharedCalendarApi.ts     getSharedEvents(), createSharedEvent(), updateSharedEvent(), deleteSharedEvent()
pages/
  LandingPage.tsx          Public landing page — features list + 3 login cards
  Login.tsx                User login form — posts to /auth/login, redirects to /inbox
  AdminLogin.tsx           Company Admin login — same flow, redirects to /admin/users
  SuperAdminLogin.tsx      Super Admin login — same flow, redirects to /superadmin/tenants
  Inbox.tsx                3-pane mail view — folder tree, message list, message viewer + compose
  Calendar.tsx             Personal calendar tab + shared team calendar tab
  Contacts.tsx             Contact list + add/edit modal
  Files.tsx                File list, upload, download + "Open in Office" button
  superadmin/
    Tenants.tsx            Tenant list with create/edit/delete
    CreateTenantModal.tsx
    EditTenantModal.tsx
    Billing.tsx            Invoice list with create/update + status filters
    BillModal.tsx
  admin/
    Users.tsx              User list with create/edit/delete
    CreateUserModal.tsx
    EditUserModal.tsx
components/
  Layout/                  Sidebar navigation, Header with user menu, Layout wrapper
  Mail/                    InboxList, MessageView, ComposeModal, FolderTree
  Calendar/                CalendarGrid, EventModal
  Contacts/                ContactCard, ContactForm
  Files/                   FileList, UploadButton
  ui/                      Reusable UI primitives (Button, Modal, Input, Badge, etc.)
```

---

## Adding a New Backend Route

1. Create a new file in `backend/src/routes/yourroute.ts`
2. Define a Router and add your route handlers:

```typescript
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// All routes in this file require authentication
router.use(requireAuth);

// GET /yourroute/example
router.get("/example", async (req, res, next) => {
  try {
    // req.user is set by requireAuth — contains sub, domain, role
    res.json({ message: "Hello", user: req.user!.sub });
  } catch (e) {
    next(e); // always pass errors to next() — the errorHandler formats them
  }
});

export default router;
```

3. Mount it in `backend/src/index.ts`:

```typescript
import yourRoute from "./routes/yourroute.js";
// ...
app.use("/yourroute", yourRoute);
```

4. If the route is admin-only, add `requireRole("admin")` or `requireRole("superadmin")` inside the router.

---

## Adding a New Frontend Page

1. Create a new file in `frontend/src/pages/YourPage.tsx`:

```tsx
import React from "react";
import { useAuthStore } from "../store/index.ts";

export default function YourPage() {
  const { email, domain } = useAuthStore();

  return (
    <div>
      <h1>Your Page</h1>
      <p>Logged in as {email} ({domain})</p>
    </div>
  );
}
```

2. Add a route in `frontend/src/App.tsx`:

```tsx
import YourPage from "./pages/YourPage.tsx";
// Inside the Routes block:
<Route path="/yourpage" element={<PrivateRoute><YourPage /></PrivateRoute>} />
```

3. Add an API function in `frontend/src/api/yourApi.ts`:

```typescript
import { apiClient } from "./client.ts";

export async function getExample() {
  const { data } = await apiClient.get("/yourroute/example");
  return data;
}
```

The `apiClient` automatically attaches the Bearer token and handles 401 auto-refresh.

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | Yes | `development` or `production` |
| `PORT` | No | API port (default: 3000) |
| `MONGO_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret for signing access tokens (32+ chars) |
| `JWT_REFRESH_SECRET` | Yes | Secret for signing refresh tokens (32+ chars) |
| `INTERNAL_AUTH_TOKEN` | Yes | Shared secret for Dovecot + Postfix internal routes (16+ chars) |
| `CORS_ORIGIN` | Yes | Allowed CORS origin (e.g. `http://localhost:5173` in dev) |
| `SMTP_HOST` | No | Outbound SMTP host. Leave empty to use Ethereal in dev. |
| `SMTP_PORT` | No | Outbound SMTP port (default: 587) |
| `IMAP_HOST` | No | IMAP host for reading mail (Dovecot in production) |
| `IMAP_PORT` | No | IMAP port (default: 993) |
| `MAIL_DOMAIN` | Yes | Primary mail domain (e.g. `yourdomain.com`) |
| `MAIL_HOSTNAME` | Yes | Mail server hostname (e.g. `mail.yourdomain.com`) |
| `MONGO_ROOT_PASSWORD` | Prod only | MongoDB root password |
| `MONGO_APP_PASSWORD` | Prod only | MongoDB app user password |
| `REDIS_PASSWORD` | Prod only | Redis password |
| `NEXTCLOUD_ADMIN_PASSWORD` | Prod only | Nextcloud admin password |
| `DOVECOT_INTERNAL_SECRET` | Prod only | Shared between API and Dovecot |
| `CLOUDFLARE_TUNNEL_TOKEN` | Prod only | Filled in by setup-cloudflare.ps1 |
| `SUPERADMIN_EMAIL` | Seed only | Used by seed-superadmin.sh |
| `SUPERADMIN_PASS` | Seed only | Used by seed-superadmin.sh |

### Frontend (`frontend/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | Backend API base URL (e.g. `http://localhost:3000` in dev, `/api` in production) |
| `VITE_COLLABORA_ENABLED` | No | `true` or `false` — controls "Open in Office" button visibility |

---

## Auth Flow (for reference when debugging)

```
1. User submits email + password to POST /auth/login
2. API calls argon2.verify(storedHash, password)
3. If valid, API issues:
   - Access token (JWT, 15-min expiry) — contains { sub, domain, role }
   - Refresh token (JWT, 7-day expiry) — set as httpOnly cookie on /auth/refresh path
4. Frontend stores access token in Zustand (in-memory, not localStorage)
5. Every API request: Axios interceptor attaches Authorization: Bearer <accessToken>
6. On 401: Axios interceptor calls POST /auth/refresh (sends the httpOnly cookie)
7. API verifies the refresh token, issues new access token, returns it
8. Interceptor retries the original request with the new token
9. On logout: POST /auth/logout clears the refresh token cookie
```

The user's IMAP password is stored in `sessionStorage` as `mp` (cleared when the tab closes) and sent as the `X-Mail-Pass` header so the backend can open IMAP connections on behalf of the user.

---

## Building for Production

```bash
# Build the frontend static bundle
cd frontend && npm run build
# Output: frontend/dist/

# Compile the backend TypeScript
cd backend && npm run build
# Output: backend/dist/

# Run the compiled backend
node backend/dist/index.js
```

In production, Nginx serves the frontend static files from `frontend/dist/` and proxies `/api` requests to the Node.js backend.

The Docker setup handles all of this automatically — the frontend build happens inside the Docker container, and Nginx is pre-configured to serve it correctly.

---

## Branches

| Branch | Purpose |
|---|---|
| `main` | Primary — Windows + Cloudflare Tunnel |
| `windows-deploy` | Windows-specific deployment scripts |
| `vercel-deploy` | Vercel (frontend) + Render (backend) + MongoDB Atlas |

When making changes:
1. Work on `main`
2. Merge to `windows-deploy` and `vercel-deploy` as appropriate
3. Push all three

```bash
git checkout main
# make changes, commit
git push origin main

git checkout windows-deploy && git merge main --no-edit && git push origin windows-deploy
git checkout vercel-deploy  && git merge main --no-edit && git push origin vercel-deploy
git checkout main
```
