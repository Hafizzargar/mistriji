# MistriJi 

MistriJi is a home services marketplace platform connecting customers with trusted local professionals. 

## Project Structure
This is a monorepo powered by `pnpm` workspaces.
- `apps/web`: The main Customer and Worker application (React/Vite + Capacitor Android app).
- `apps/admin`: The secure administrative portal (React/Vite).
- `apps/api`: The Node.js/Express backend handling OTP authentication and secure dispatching.

## Prerequisites
- Node.js v18+
- pnpm 8+
- Supabase project
- Render (or similar) for Node API hosting

## Getting Started

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Configure Environment Variables:**
   - Copy `.env.example` to `.env` in `apps/api`, `apps/web`, and `apps/admin`.
   - Fill in your Supabase URL, Anon Key, Service Role Key (backend only), and API keys for Brevo/Fast2SMS.

3. **Run the Development Servers:**
   ```bash
   pnpm dev
   ```
   This will start the Web app, Admin portal, and Node API concurrently.

## Security Notice
- **Never commit `.env` files** containing Supabase Service Role keys or SMTP credentials.
- **Admin Accounts:** Use strict RLS and the dedicated admin portal for administrative actions. Do not rely solely on frontend role masking.
