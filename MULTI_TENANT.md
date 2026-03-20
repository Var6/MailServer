# Multi-Tenant Architecture

This document explains how MailServer runs email for multiple companies simultaneously, how data isolation is enforced, and how the billing system works.

---

## Overview

One MailServer installation can serve many companies (tenants) at the same time. Each company has its own email domain, its own admin, and its own users. Users in `citizenjaivik.com` can never see, access, or interact with users or mail in `citizenhousing.in` — even though both run on the same server.

This is the same model used by Google Workspace (G Suite) and Microsoft 365 — except you own and control the infrastructure.

---

## The Three Roles

### Super Admin

There is one Super Admin for the entire system. The Super Admin:

- Logs in at `/superadmin/login`
- Creates, edits, and deactivates tenants (companies)
- Sets per-tenant limits: maximum number of users, storage quota per user
- Views and manages billing for all tenants
- Cannot be created through the UI — only via `scripts/seed-superadmin.sh`
- Has no `tenantDomain` restriction in the JWT — can access any resource

### Company Admin (Admin)

Each tenant has at least one admin. The company admin:

- Logs in at `/admin/login`
- Sees only users within their own company's domain
- Creates, edits, and deactivates users within their domain
- Cannot exceed the maximum user count set by the Super Admin
- Cannot modify tenant-level settings (quotas, domain, max users)
- Cannot see any other company's data

### User

Regular users:

- Log in at `/login`
- Can send and receive email
- Can use calendar (personal + shared team events), contacts, and files
- Can open files in LibreOffice Online (if enabled)
- Cannot access any admin functionality

---

## Data Isolation

Isolation is enforced at two independent levels — both must pass for any request to succeed.

### Level 1 — JWT token contents

When a user logs in, the API issues a JWT access token. The token payload contains:

```json
{
  "sub": "john@citizenjaivik.com",
  "domain": "citizenjaivik.com",
  "role": "user"
}
```

The `domain` and `role` fields are set **server-side** at login, derived from the user record in MongoDB. The client receives the token and sends it with every request — but the client cannot modify the token contents. Any tampering invalidates the signature.

Access tokens expire after **15 minutes**. A refresh token (7-day expiry, stored in an httpOnly cookie) is used to get new access tokens without requiring the user to log in again.

### Level 2 — Middleware enforcement

Every route that touches user or tenant data applies one or more of these middleware functions:

**`requireAuth`** — verifies the JWT signature and expiry. Extracts `sub`, `domain`, and `role` into `req.user`. Rejects with 401 if the token is missing, malformed, or expired.

**`requireRole(...roles)`** — checks that `req.user.role` is in the allowed list. For example, the tenants CRUD routes apply `requireRole("superadmin")` — any other role gets a 403.

**`requireSameTenant()`** — used on admin routes. It reads the target user's `domain` from MongoDB and compares it to `req.user.domain`. If they do not match, the request is rejected with 403 "Access denied: user belongs to a different domain". Super Admins bypass this check.

Example: if Admin A (domain: `citizenjaivik.com`) tries to edit a user in `citizenhousing.in`, the middleware fetches that user from MongoDB, sees `domain: citizenhousing.in`, compares it to `req.user.domain` (`citizenjaivik.com`), and returns 403 — regardless of what the client sent.

### Database-level separation

Every user document in MongoDB has a `domain` field. Every query for users in admin routes filters by `domain: req.user.domain`. There is no way for an admin to query or mutate another domain's users through the API.

---

## How to Create a New Company

1. Log in at `/superadmin/login`
2. Click **Tenants** in the sidebar
3. Click **New Tenant**
4. Fill in:
   - **Company name**: display name (e.g. `Citizen Jaivik`)
   - **Domain**: the email domain (e.g. `citizenjaivik.com`)
   - **Admin email**: the admin's login email (does not have to be on the new domain)
   - **Admin password**: minimum 8 characters
   - **Max users**: ceiling for how many user accounts this tenant can have
   - **Storage per user (MB)**: per-user mailbox quota (default: 1024 MB = 1 GB)
5. Click **Create Tenant**

The API does the following atomically:
1. Checks that the domain is not already registered
2. Creates a `Tenant` document in MongoDB
3. Creates a `Domain` document (used by the Postfix TCP map server for domain lookup)
4. Creates the admin `User` account with `role: "admin"` and `domain: thatdomain.com`

From this moment, Postfix accepts inbound mail for the new domain without any restart.

---

## How Postfix Knows About New Domains (TCP Map Server)

Traditional self-hosted mail servers require editing flat text files and running `postmap` to rebuild lookup tables, then reloading Postfix. MailServer eliminates all of that.

Postfix's `virtual_mailbox_domains` configuration uses a `tcp:` map type that points to the Node.js API on port 10023:

```
virtual_mailbox_domains = tcp:api:10023
virtual_mailbox_maps    = tcp:api:10023
```

When Postfix receives an incoming email, it queries the TCP map server:
- **Domain check**: `GET /internal/virtual-domain?name=citizenjaivik.com` — the API queries the `domains` collection in MongoDB and responds with `exists: true` or 404
- **Mailbox check**: `GET /internal/virtual-user?email=john@citizenjaivik.com` — the API queries the `users` collection

The TCP map server is a dedicated Node.js server running on port 10023. It speaks the Postfix TCP table protocol and translates the queries to MongoDB lookups.

Because the lookup happens live on every incoming email, a new domain created via the API is immediately available to Postfix. No `postmap`, no `postfix reload`, no container restart.

The same pattern is used for Dovecot authentication — Dovecot's `checkpassword` script calls `POST /internal/auth` with the user's email and password. The API verifies credentials using argon2id and returns the user's home directory path if valid.

All internal routes are:
- Only accessible on the Docker internal network (never exposed through Nginx)
- Protected by a shared `INTERNAL_AUTH_TOKEN` header that must match the value in `.env`

---

## Mail Routing Per Domain

When an email arrives at Postfix destined for `john@citizenjaivik.com`:

1. Postfix queries the TCP map: is `citizenjaivik.com` a local virtual domain? → Yes
2. Postfix queries the TCP map: does user `john@citizenjaivik.com` exist? → Yes
3. Postfix delivers to the local mailbox at `/var/mail/vhosts/citizenjaivik.com/john/`
4. Rspamd scans for spam and runs DKIM signing/verification
5. ClamAV scans for viruses
6. Dovecot serves the message to the user via IMAP (port 993) or POP3 (port 995)

Mail for `jane@citizenhousing.in` goes to `/var/mail/vhosts/citizenhousing.in/jane/` — a completely separate directory.

---

## Storage Limits Per Tenant

When the Super Admin creates a tenant, they set **storagePerUserMb** (e.g. 1024 MB). This value is stored in the `Tenant` document and copied to each `User` document as `quotaMb` when users are created.

Dovecot enforces the quota at the mailbox level using the `quota` plugin. If a user's mailbox exceeds their quota:
- Dovecot rejects incoming messages to that user with a "mailbox full" SMTP error
- The sender receives a bounce notification

The `quotaMb` value on the `User` document is the authoritative limit. When an admin creates a user, the API reads `storagePerUserMb` from the tenant and sets it as the user's quota.

---

## Billing System

Super Admin can create and track invoices for each tenant.

### Bill data model

| Field | Type | Description |
|---|---|---|
| `tenantDomain` | String | Identifies which company the bill is for |
| `tenantName` | String | Company display name (snapshot at bill creation) |
| `amount` | Number | Invoice amount |
| `currency` | String | Default: `USD` |
| `dueDate` | Date | When payment is due |
| `status` | String | `unpaid` / `paid` / `overdue` |
| `notes` | String | Free-text notes |
| `paidAt` | Date | Set when status changes to `paid` |

### Workflow

1. Super Admin creates a bill via **Billing → New Bill**
2. Bill starts with status `unpaid`
3. Super Admin can filter the billing list by tenant or status
4. When payment is received, Super Admin clicks the bill and selects **Mark as Paid** — the API sets `status: "paid"` and records `paidAt: now`
5. Bills not paid by `dueDate` can be manually marked `overdue` or flagged automatically

Bills are scoped to the Super Admin only — company admins and users cannot see billing data.

---

## Example: Two Tenants Coexisting

```
Super Admin creates:
  Tenant 1: Citizen Jaivik
    domain:           citizenjaivik.com
    adminEmail:       cj-admin@gmail.com
    maxUsers:         20
    storagePerUser:   2048 MB

  Tenant 2: Citizen Housing
    domain:           citizenhousing.in
    adminEmail:       ch-admin@gmail.com
    maxUsers:         10
    storagePerUser:   1024 MB
```

Citizen Jaivik admin logs in at `/admin/login` as `cj-admin@gmail.com`.
- Creates users: `alice@citizenjaivik.com`, `bob@citizenjaivik.com`, etc.
- Cannot see any users in `citizenhousing.in`

Citizen Housing admin logs in at `/admin/login` as `ch-admin@gmail.com`.
- Creates users: `priya@citizenhousing.in`, `raj@citizenhousing.in`, etc.
- Cannot see any users in `citizenjaivik.com`

`alice@citizenjaivik.com` sends an email to `priya@citizenhousing.in`:
1. Alice's SMTP client submits the message to Postfix on port 587
2. Postfix looks up `citizenhousing.in` in the TCP map → it is a local domain
3. Postfix delivers to `/var/mail/vhosts/citizenhousing.in/priya/`
4. Priya sees it in her inbox

Mail between different tenant domains on the same server is delivered locally — it never leaves the machine.

Alice's webmail can see only her own mail. Priya's webmail can see only her own mail. Neither admin can see the other company's data. The Super Admin can see both tenants in the Tenants page and both billing records, but does not have direct access to read individual emails.

---

## Adding a New Tenant Checklist

When you onboard a new company:

1. Create the tenant in the Super Admin portal (sets up domain + admin account)
2. Log in as the company admin and create user accounts
3. In Cloudflare (or your DNS provider), add an **MX record** for the new domain pointing to `mail.yourmailserver.com`
4. Add **SPF**, **DKIM**, and **DMARC** records for the new domain
5. Optionally: create a bill for the first month of service
6. Send the admin their login URL (`https://mail.yourmailserver.com/admin/login`) and credentials

Postfix will accept and route mail for the new domain the moment the tenant is created — the DNS records are only needed for external mail delivery.
