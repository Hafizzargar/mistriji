# MistriJi — Supabase Setup Guide

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Name: `mistriji`
3. Database password: Choose a strong password and **save it**
4. Region: `Southeast Asia (Singapore)` — closest to Jammu
5. Click **Create new project** and wait ~2 minutes

---

## Step 2: Get Your Keys

Go to **Project Settings → API**:

- Copy `Project URL` → save as `VITE_SUPABASE_URL`
- Copy `anon public` key → save as `VITE_SUPABASE_ANON_KEY`
- Copy `service_role` key → save as `SUPABASE_SERVICE_ROLE_KEY`

> ⚠️ **NEVER put `service_role` key in any frontend React code.**  
> It goes only in Edge Functions / server-side environment variables.

---

## Step 3: Run Migrations

In Supabase Dashboard → **SQL Editor**, run each file in order:

```
001_create_enums.sql      ← Run first
002_create_tables.sql     ← Run second
003_rls_policies.sql      ← Run third
004_seed_skills.sql       ← Run last (seeds 10 services)
```

Copy each file's content → paste into SQL Editor → click **Run**.

---

## Step 4: Enable Phone Auth

1. Go to **Authentication → Providers**
2. Enable **Phone** provider
3. Choose SMS provider: **Twilio** (or use Supabase's built-in for testing)
4. For testing locally, enable **"Confirm email"** = OFF, **"Phone confirmation"** = ON

---

## Step 5: Create Super Admin User

After running migrations, create your Super Admin manually:

```sql
-- Run in SQL Editor after migrations

-- 1. First create auth user via Supabase Dashboard → Authentication → Add user
-- Use phone: your phone number

-- 2. Then run this to set role in your users table:
INSERT INTO public.users (auth_id, phone, role, status)
VALUES (
  '<paste-auth-uid-from-auth-users-table>',
  '<your-phone-number>',   -- e.g. '9876543210'
  'super_admin',
  'active'
);

INSERT INTO public.profiles (user_id, name, area)
VALUES (
  (SELECT id FROM public.users WHERE phone = '<your-phone-number>'),
  'Super Admin',
  'Jammu'
);
```

---

## Step 6: Environment Variables

Create a `.env` file in `apps/admin/` and `apps/web/`:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

Create a `.env` file in `packages/supabase/` (for Edge Functions):

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # ← NEVER in frontend
```

---

## Step 7: Generate TypeScript Types

After running migrations, generate types automatically:

```bash
npx supabase gen types typescript \
  --project-id <your-project-id> \
  --schema public \
  > packages/supabase/src/database.types.ts
```

---

## Storage Buckets

Create these storage buckets in **Supabase Dashboard → Storage**:

| Bucket Name | Public? | Purpose |
|---|---|---|
| `avatars` | ✅ Public | Worker + customer photos |
| `id-proofs` | ❌ Private | Worker Aadhaar / ID scans |

---

## Important Notes

- All `.env` files are in `.gitignore` — **never commit them**
- `service_role` key = full database access — treat like a password
- Run migrations in order — each depends on the previous
