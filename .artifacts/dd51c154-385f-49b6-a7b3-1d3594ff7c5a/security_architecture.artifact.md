# MistriJi Security Architecture & Blueprint

This document captures the complete, hardened security architecture established during the MistriJi v1 security audit and test suite verification. This blueprint serves as the standard for all future development and the upcoming MistriJi v2 project.

---

## 1. Authentication & Session Management
- **Tokens**: 15-minute short-lived JWT Access Tokens for API authorization.
- **Refresh Tokens**: 1-hour absolute limit Refresh Tokens stored in **HttpOnly, Secure, SameSite=None** cookies (`admin_refresh_token`).
- **Cross-Portal Protection**: Strict separation between Admin Portal and Customer/Worker Portal. Admin accounts are forbidden from logging into the standard user portal, and vice versa.

## 2. Secure PIN & Credential Verification
- **Hashing**: Cryptographically salted password/PIN hashing using Node.js built-in `crypto.scryptSync` (64-byte key, 16-byte random salt).
- **Comparison**: Timing-safe comparison using `crypto.timingSafeEqual` to prevent timing attacks.
- **No Plaintext Storage**: All PINs and sensitive credentials are strictly hashed before persisting in Supabase.

## 3. Persistent OTP Architecture & CSPRNG
- **Randomness**: Cryptographically secure pseudo-random number generator (`crypto.randomInt(100000, 1000000)`) for 6-digit OTP codes.
- **Persistence**: Database-backed OTP store (`otp_store` table in Supabase) supporting multi-instance horizontal scaling (serverless/containers) with local memory fallback.
- **Rate Limiting**: IP, identifier, and global sliding-window rate limiters with cooldown periods to prevent brute-force and SMS/Email bombing.

## 4. Payment Authorization & Order Validation
- **Authentication Check**: Mandatory Bearer token validation (`jwt.verify`) on `/api/payments/create-order`.
- **Ownership Verification**: Validates that the requesting user ID matches the authenticated token Subject (`sub`), and that `jobId` references a job owned by that customer.
- **Amount Integrity**: Server-side validation against job pricing records.

## 5. Row Level Security (RLS) & Role Isolation
- **Enabled on All Tables**: 100% of tables have `ENABLE ROW LEVEL SECURITY` enforced.
- **Self-Elevation Prevention**: RLS update policies explicitly forbid users from modifying their own role to `admin` or `super_admin` (`role NOT IN ('admin', 'super_admin')`).
- **Row-Ownership Policies**: Users and workers can only select, update, or cancel their own respective records.

## 6. API Hardening & Error Handling
- **CORS**: Explicit whitelist of allowed domains (localhost + Vercel deployment preview/production URLs) rather than wildcard `true`.
- **Error Sanitization**: Global error handlers strip internal stack traces and error messages in production environments, logging them securely to backend error monitoring tables.
