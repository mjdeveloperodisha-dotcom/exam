# Competitive Exam Master

Institute-scoped competitive examination platform for the test2 architecture.

## Portal structure

- **Main Admin** — /admin
  - Secure email + OTP login
  - Create institutes
  - Set institute User ID/password
  - Remove institutes
  - No student, teacher, exam, module, settings or payment management

- **Institute Admin** — /institute
  - Secure institute User ID/password login
  - Approve, block/unblock and delete students
  - Approve, block/unblock and delete teachers
  - Add/remove exam modules
  - Review/delete test series
  - Change test attempt policy
  - Manage institute branding/settings
  - Institute-scoped administration only

- **Student / Teacher** — /student
  - Registration requires selecting an active institute
  - Student and teacher accounts are stored separately
  - Teachers require Institute Admin approval
  - Teachers create test series for their own institute
  - Students see only published tests belonging to their institute

## New Firebase RTDB namespace

The new project uses **cem2/...** and does not delete or overwrite the previous project's Firebase paths.

- cem2/institutes
- cem2/students
- cem2/teachers
- cem2/modules
- cem2/tests
- cem2/examAttempts
- cem2/attemptLocks
- cem2/submissions
- cem2/scoreIndex
- cem2/ratings
- cem2/passwordResets
- cem2/settings
- cem2/security/sessions
- cem2/security/rateLimits
- cem2/security/adminOtp
- cem2/security/passwordResets
- cem2/security/audit

## Server-side security architecture

Authentication state is server-controlled. Production does not trust client-side authentication state.

- Authenticated sessions use random opaque 256-bit cookies; only a SHA-256 hash of each session token is stored in Firebase under `cem2/security/sessions`
- Sessions have a server-enforced absolute expiry and can be revoked immediately on logout
- Password changes and institute credential changes increment a server-side authentication version, invalidating older sessions
- Production rate limiting is stored in Firebase transactions under `cem2/security/rateLimits`, so limits are shared across multiple Node.js instances
- Main Admin OTP state is stored only server-side under `cem2/security/adminOtp`
- Main Admin OTP stores only the HMAC hash, expiry, attempt count, consumed state and server request timestamp; the plaintext OTP is never persisted
- Main Admin OTP verification is atomic and single-use, including concurrent-request protection
- Password-reset OTP state is also server-side, hashed, short-lived, attempt-limited and atomic single-use
- Production refuses to start without Firebase-backed storage, strong separate `AUTH_SESSION_SECRET`/`ADMIN_OTP_SECRET` values, and explicit `TRUST_PROXY=true`
- Firebase Realtime Database rules remain deny-by-default; browser clients do not receive Firebase Admin credentials

## Examination security

- Server-side authentication and database-backed opaque sessions
- CSRF token + same-origin validation
- Rate limiting
- Secure/HttpOnly/SameSite cookies
- Security headers and HSTS in HTTPS production
- Server-generated exam attempt IDs
- Server-side start/expiry timestamps
- Server-side answer validation and scoring
- Server-side result/rank/percentile calculation
- One-attempt transaction locks when enabled
- Institute ID checks on tests, attempts and submissions
- Teachers can modify only their own test series
- Institute Admin can manage only their institute
- No answer key is sent to students before submission

## Payments

Premium subscriptions, Razorpay, UPI payment flows, orders and payment settings have been removed from the new project API and UI.

## Running locally

Default port: **4300**

```bash
npm install
npm start
```

Open:

- http://localhost:4300/student
- http://localhost:4300/admin
- http://localhost:4300/institute

## Environment

Copy .env.example to .env and configure:

- PORT=4300
- TRUST_PROXY=true when deployed behind the trusted TLS reverse proxy
- AUTH_SESSION_SECRET
- ADMIN_OTP_SECRET
- Firebase Realtime Database server credentials
- Gmail API credentials for OTP/password-reset/account emails

Firebase access remains server-side; the frontend does not receive Firebase Admin credentials.
