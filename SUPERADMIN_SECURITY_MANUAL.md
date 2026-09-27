# 🛡️ MistriJi — Super Admin Confidential Security Manual

**CONFIDENTIAL — FOR SUPER ADMIN EYES ONLY**

---

## 1. 🔐 Secret Super Admin Portal Access

To prevent automated scanning, brute-force bots, and public discovery, the Administrative Portal is completely decoupled from the public customer web app:

| Component | Public URL / Port | Secret Gateway Path |
| :--- | :--- | :--- |
| **Customer App** | `http://localhost:3000/` | Public Access (No Admin Links) |
| **Super Admin Portal** | `http://localhost:3001/` | **`http://localhost:3001/portal-hq-sec-9982/login`** |

> **Production Deployment Recommendation:**
> In production, host the admin app on a private, isolated subdomain with IP allowlisting or VPN protection:
> `https://hq-sys-internal-8991.mistriji.com/portal-hq-sec-9982/login`

---

## 2. 🔑 Master Super Admin Credentials

| Parameter | Configuration Value |
| :--- | :--- |
| **Master Phone** | `6005950197` |
| **Master Security PIN** | `123456` |
| **Role Designation** | `super_admin` |
| **Permissions** | Unrestricted Database Access, System Settings, Banner Maintenance, Worker Approvals, Admin Provisioning |

---

## 3. 🛡️ Strict Role-Based Portal Isolation Architecture

### 1. Consumer Web App (`apps/web` on port 3000)
- **Allowed Roles:** `customer` and `worker` only.
- **Strictly Blocked Roles:** `admin` and `super_admin`.
- If an administrative account attempts to login or register through the Customer Modal or Worker Modal, the app performs a real-time database role check and blocks access:
  > `⛔ Administrator account detected. Administrators cannot login or register through the consumer app. Please use the secure Admin portal.`

### 2. Admin & Super Admin Management Portal (`apps/admin` on port 3001)
- **Allowed Roles:** `admin` and `super_admin` only.
- **Strictly Blocked Roles:** `customer` and `worker`.
- If a customer or worker attempts to authenticate on the Admin Portal, their database role is rejected:
  > `⛔ Access denied. This portal is for authorized administrators only.`
- The user is immediately signed out from Supabase auth and redirected away.

### Rule 2: Dynamic Phone Check & Registration If/Else Logic
- When any user enters their 10-digit mobile number:
  1. **If user exists in DB:**
     - The app skips registration forms and executes instant 1-click verification.
  2. **If user is NOT in DB (first-time visitor):**
     - Dynamic conditional fields appear (`Full Name` for customers; `Full Name`, `Trade`, `Area`, `Experience` for workers) to register them directly into the database.

### Rule 3: Public Codebase Sanitization
- All public backlinks, footer links, and navbar buttons pointing to the Admin Portal have been removed from the customer application.
- The Admin app runs with its own isolated authentication context and dedicated Supabase session key.

---

## 4. 🗄️ Database Row Level Security (RLS) Rules

1. `system_settings`:
   - Public: Read-only access for active notices and helpline settings.
   - Mutations (Insert / Update / Delete): Only authenticated `super_admin`.
2. `admin_profiles`:
   - Restricted to `super_admin` role.
3. `users` & `worker_profiles`:
   - Public read for active verified workers (filtered by proximity and category).
   - Write access gated by Row Level Security policies.

---

*Last Updated: 2026-09-05*
*Document ID: SEC-MISTRIJI-SUPERADMIN-001*
