# Security Requirements & Implementation

## Implemented controls (MVP)

| Requirement | Status | Where |
|---|---|---|
| HTTPS | ✅ | Lovable Cloud forces HTTPS on all `*.lovable.app` and custom domains |
| Admin protection | ✅ | RBAC via `useUserRole` + RLS `has_role()` |
| 2FA for admins | ✅ | `/admin/security` → TOTP enrollment, backup codes |
| Fine-grained permissions | ✅ | `role_permissions` table + `has_permission()` |
| No card storage | ✅ | All payments tokenized via gateways (no PAN ever stored) |
| CSRF protection | ✅ | Supabase JWT + same-origin server functions |
| XSS protection | ✅ | React escapes by default; no `dangerouslySetInnerHTML` on user data |
| SQL injection | ✅ | Parameterized queries via Supabase client + RLS |
| Rate limiting | ⚠️ | Configured per-route in security_settings (`api_rate_limit_per_minute`) — enforce at gateway/edge |
| API protection | ✅ | All `/api/public/*` endpoints verify HMAC signatures |
| Encryption at rest | ✅ | Lovable Cloud encrypts DB, storage, secrets |
| Suspicious-activity logs | ✅ | `failed_login_attempts`, `audit_logs` |
| Session management | ✅ | `active_sessions` table + revocation UI |
| Password policy | ✅ | `security_settings.password_*` enforced via `validatePassword()` |
| Backups | ✅ | Lovable Cloud automatic daily; manual log via `/admin/security` |
| Disaster recovery | ✅ | PITR via Lovable Cloud support |
| Failed-login monitoring | ✅ | `/admin/audit-logins` |
| Account lockout | ✅ | `account_lockouts` + auto-trigger after N failures |

## Architecture

- **Auth**: Supabase Auth (JWT, bcrypt password hashes, email verification)
- **RBAC**: 13 roles × granular permissions (`role_permissions`)
- **2FA**: TOTP (RFC 6238) with backup codes (SHA-256 hashed)
- **Lockout**: After `lockout_max_attempts` failures within window → account locked for `lockout_duration_minutes`
- **Audit trail**: Immutable `audit_logs` table; trigger blocks UPDATE/DELETE

## Operational checklist

- [ ] Enable HIBP password check in Lovable Cloud → Auth Settings
- [ ] Enforce 2FA for super_admin/admin (toggle in Security Center)
- [ ] Review `/admin/audit-logins` weekly for brute-force patterns
- [ ] Confirm backups in `/admin/security` → Backup tab
- [ ] Rotate API keys quarterly
