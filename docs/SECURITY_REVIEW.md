# Security Review — Reel Prompt Studio

## Authentication & Authorization

### Clerk Auth
- All routes requiring auth use `requireAuth` middleware → validates Clerk JWT
- Admin routes use `requireAdmin` → checks `publicMetadata.role === 'admin'`
- Admin role is set server-side via Clerk API — cannot be self-elevated
- User impersonation uses Clerk's impersonation ticket API (server-validated)

### Session
- Sessions managed by Clerk (JWT, not server-side sessions)
- `SESSION_SECRET` env var is available for future cookie signing
- No plain-text credentials stored on frontend

## Secret Management

| Secret | Storage | Risk |
|---|---|---|
| `CLERK_SECRET_KEY` | Environment variable | Low — never in code |
| `DATABASE_URL` | Environment variable | Low — never in code |
| AI provider API keys | Encrypted in DB (`ai_providers.api_key`) | Medium — encrypted at rest |
| User API keys (Fal.ai etc.) | Encrypted in DB (`user_api_keys` table) | Medium — encrypted at rest |
| `SESSION_SECRET` | Environment variable | Low |

## Security-Sensitive Files

| File | Sensitivity | Notes |
|---|---|---|
| `.env` | CRITICAL | Never commit — add to `.gitignore` |
| `db_backup_*.sql` | HIGH | Contains all data — remove from git |
| `artifacts/api-server/src/middlewares/auth.ts` | Medium | Auth gate — review before changes |
| `artifacts/api-server/src/routes/admin.ts` | High | Clerk API calls with secret key |
| `lib/db/src/schema/reel-prompt.ts` | Low | Schema only, no secrets |

## Risks & Recommendations

### 🔴 Critical
| Risk | Recommendation |
|---|---|
| DB backup files in repo | Add `db_backup_*.sql` to `.gitignore` immediately |
| No rate limiting on AI endpoints | Add `express-rate-limit` to `/api/analyze` — costs per call |
| No file size limit on video upload | Browser-side only; add `multer` size limit on API |

### 🟠 High
| Risk | Recommendation |
|---|---|
| API key encryption uses DB storage | Verify encryption strength; consider environment-level encryption |
| User impersonation has no audit log | Log all impersonation events with timestamps |
| No CSRF protection | Add `csurf` or check `Origin` header on state-mutating routes |

### 🟡 Medium
| Risk | Recommendation |
|---|---|
| `@distube/ytdl-core` — TOS risk | Add disclaimer to users; rate-limit URL-based analysis |
| Error messages may expose internals | Ensure production error handler strips stack traces |
| No input sanitization on prompts | AI input is user-controlled — add length limits |

### 🟢 Low
| Risk | Recommendation |
|---|---|
| CORS is open (`cors()`) | Restrict to known origins in production |
| Pino logs request body | Mask sensitive fields (API keys, passwords) in log config |

## Headers & Hardening Checklist

```bash
# Add to Express app.ts for production:
# - helmet() for security headers
# - express-rate-limit for API endpoints
# - Origin validation for CORS
```

Recommended additions to `app.ts`:
```typescript
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

app.use(helmet());
app.use('/api/analyze', rateLimit({ windowMs: 60_000, max: 10 }));
```
