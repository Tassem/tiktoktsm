# Roadmap & Recommendations

## 🔴 Critical (Fix Now)

| Item | Action |
|---|---|
| DB backups in git | Add `db_backup_*.sql` to `.gitignore` — they contain real data |
| No rate limiting on `/api/analyze` | AI calls cost money — add per-user rate limiting (10 req/hour) |
| CORS open to all origins | Restrict to your production domain in `app.ts` |

## 🟠 High Priority

| Item | Action |
|---|---|
| No E2E tests | Add Playwright tests for: login, video upload flow, admin panel |
| Video upload size limit | Add file size validation (max 100MB) on both frontend + backend |
| Error monitoring | Integrate Sentry or similar for production error tracking |
| Audit log for impersonation | Log admin impersonation events to DB with timestamps |
| Google login removal | Disable via Auth pane → Social Connections |

## 🟡 Medium Priority

| Item | Action |
|---|---|
| Gemini video input support | Add Gemini as a native video provider option |
| Public pack gallery | Allow creators to share prompt packs publicly |
| Pack version history | Track edits to prompt packs over time |
| Prompt quality scoring | Let users rate AI output quality per scene |
| Batch analysis | Queue multiple videos for background processing |

## 🟢 Low Priority / Nice-to-Have

| Item | Action |
|---|---|
| Mobile-responsive UI | Current layout is desktop-optimized |
| PDF export | Export prompt packs as formatted PDFs |
| Webhook notifications | Notify users when analysis completes |
| Team workspaces | Multiple admins per workspace |
| Analytics dashboard | Track which niches/prompts perform best |

## Quick Wins (< 1 hour each)

- [ ] Add `helmet()` to Express for security headers
- [ ] Add `.gitignore` entry for `db_backup_*.sql`
- [ ] Add `max-file-size` validation on video upload form
- [ ] Add `loading` state to all submit buttons (most already have it)
- [ ] Add `<meta>` description tags to HTML pages for SEO

## Long-Term Architecture

```
Current:           Target (Scale):
─────────          ──────────────────
Single server   →  API + Worker separation
Sync analysis   →  Queue-based (BullMQ/Redis)
Single DB       →  Read replicas for dashboard queries
Manual prompts  →  A/B tested prompt variants
```
