# Technical Report — Reel Prompt Studio

**Date:** April 2026
**Status:** Active Development — Core Features Complete

---

## Executive Summary

Reel Prompt Studio is a full-stack monorepo web application targeting Moroccan content creators. It provides an AI-powered pipeline to convert short-form videos into complete, copy-ready prompt packs for AI video generators. The project is in an advanced functional state with all core features implemented and the platform actively in use.

---

## Project Objective

Enable Arabic/Darija-speaking creators to:
1. Upload a video reel (TikTok/Reels/YouTube)
2. Receive a full scene-by-scene prompt pack in under 2 minutes
3. Manage, remix, and export those prompts for AI video generation tools

---

## Current Completion Status

| Area | Completion |
|---|---|
| Core video analysis pipeline | 95% |
| Admin panel + site management | 90% |
| AI provider management | 85% |
| Multilingual support | 90% |
| Dev Agent | 80% |
| Image generation | 75% |
| Docker / deployment | 70% |
| Testing | 5% |
| Rate limiting / security hardening | 30% |

**Overall: ~80% complete for a production-ready v1**

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | React | 19 (catalog) |
| Build | Vite | 7.3.2 |
| Styling | Tailwind CSS | catalog |
| UI Components | shadcn/ui + Radix | various |
| State | TanStack Query | catalog |
| Router | Wouter | ^3.3.5 |
| Backend | Express | 5.x |
| Language | TypeScript | 5.9.3 |
| ORM | Drizzle ORM | catalog |
| Database | PostgreSQL | 15+ |
| Auth | Clerk | Express ^2 / React ^6 |
| AI | GPT-5.4 (OpenAI-compat) | via Replit AI |
| Package Manager | pnpm | 9+ |
| Monorepo | pnpm workspaces | – |

---

## Architecture Overview

**Pattern:** Monorepo with path-based routing. Three artifacts (API, SPA, Sandbox) + three shared libs.

**AI Resolution Chain:**
1. DB-configured provider for the specific service
2. Replit AI env vars (gpt-5.4) as fallback
3. Error: "No AI provider configured"

**Analysis Pipeline:**
```
Browser → Extract 48 frames (1/3s, 400px) → POST /api/analyze
API → Transcribe audio (60s timeout) → Load system prompt from DB
API → Send 24 frames + transcript to AI → Parse JSON response
API → Save to DB (prompt_packs + scene_prompts)
Browser ← Receive scenes with thumbnails
```

---

## Project Structure Analysis

Clean monorepo separation. Shared types via `@workspace/api-zod` prevent drift between frontend and backend. Database schema is the single source of truth in `lib/db/src/schema/reel-prompt.ts`.

**Strengths:**
- Strong TypeScript usage throughout
- Zod validation on all API boundaries
- Drizzle ORM with push-based migrations (safe for active development)
- Structured logging (Pino)
- System prompt versioning via OUTDATED_MARKERS

**Weaknesses:**
- No test suite
- No middleware for rate limiting or request size limits
- Large bundle size (5MB API dist — normal for esbuild single bundle)

---

## Feature-by-Feature Analysis

### Video Analysis
- Frame extraction: 48 frames max, 400px, JPEG 0.65 quality ✅
- Audio transcription: Whisper-compatible, 60s timeout, graceful fallback ✅
- Language detection: Darija/Arabic/French/English/Mixed ✅
- Scene extraction: Rules for all 8 video types (tutorial, comedy, drama, etc.) ✅
- Scene count: 1 scene per 3-5 seconds minimum ✅

### System Prompts
- 5 distinct system prompts (video-analysis, dev-agent, story-remix, story-summary + others)
- Admin-editable via UI in real-time
- OUTDATED_MARKERS auto-sync outdated DB prompts on restart

### Admin Panel
- Full Clerk user management (list, role change, impersonate, delete) ✅
- Site settings: lock, registration mode (open/closed/invite), demo mode toggle ✅
- Announcements: CRUD with variants, placement, visibility rules ✅

### AI Provider System
- Multi-provider: OpenRouter + Custom OpenAI-compatible ✅
- Per-service model assignment ✅
- Per-user encrypted API keys ✅
- Status indicators in sidebar ✅

---

## Implemented vs Missing Features

**Implemented:** See [docs/FEATURES.md](docs/FEATURES.md)

**Key Missing:**
- E2E test suite (critical)
- Rate limiting on AI endpoints (critical)
- Google Gemini native video input (high)
- Public pack sharing (medium)

---

## Code Quality Review

| Aspect | Grade | Notes |
|---|---|---|
| TypeScript strictness | B+ | Good coverage, some `any` casts in AI response parsing |
| Error handling | B | Try/catch everywhere, graceful AI failures |
| Code organization | A- | Clean separation of concerns |
| DRY | B | Some repeated fetch patterns; `useQuery` hooks could be extracted to lib |
| Comments | C+ | Sparse; key logic in `prompt-generator.ts` could use more |
| Dead code | B+ | Minimal — `play-dl` at workspace root is unused |

---

## Security Review

**Strong:**
- Clerk JWT validation on all protected routes
- Admin role server-side in Clerk metadata (cannot self-elevate)
- API keys encrypted in DB

**Needs Attention:**
- No rate limiting on expensive AI endpoints
- No CORS restriction in production
- No `helmet()` for security headers
- DB backup files should not be in git

See [docs/SECURITY_REVIEW.md](docs/SECURITY_REVIEW.md) for full details.

---

## Performance Review

| Item | Status |
|---|---|
| Frame extraction | Browser-side (offloads server) ✅ |
| AI timeout | 5 minutes hard timeout ✅ |
| Transcription timeout | 60 seconds with graceful skip ✅ |
| API bundle | 5MB (single esbuild bundle — acceptable) |
| Frontend bundle | Not analyzed — likely < 2MB with tree-shaking |
| DB queries | Simple ORM queries, no N+1 detected |
| Caching | TanStack Query client-side; no server-side cache |

---

## Testing Review

| Type | Status |
|---|---|
| Unit tests | ❌ None |
| Integration tests | ❌ None |
| E2E tests | ❌ None |
| Manual testing | ✅ Active |

**Recommendation:** Add Playwright E2E tests for: login flow, video analysis flow, admin panel, pack editing.

---

## Deployment / DevOps Review

| Item | Status |
|---|---|
| Replit deployment | ✅ Ready — 3 workflows configured |
| Docker support | ✅ Added (Dockerfile.api, Dockerfile.frontend, docker-compose.yml) |
| Environment variables | ✅ .env.example created |
| Database migrations | ✅ Drizzle push-based |
| CI/CD | ❌ No pipeline configured |
| Health check | ✅ GET /api/healthz endpoint |

---

## Risks and Weaknesses

| Risk | Impact | Likelihood |
|---|---|---|
| No rate limiting on AI calls | High cost if abused | Medium |
| No E2E tests | Regressions go undetected | High |
| YouTube download (ytdl-core) | TOS risk, API breakage | High |
| CORS open to all origins | XSS/CSRF risk in production | Low |
| DB backups in repo | Data leak risk | Medium |

---

## Recommendations

**Immediate:**
1. Add `db_backup_*.sql` to `.gitignore`
2. Add `express-rate-limit` to `/api/analyze`
3. Add `helmet()` to Express

**Short-term (< 1 month):**
4. Add Playwright E2E tests for core flows
5. Disable Google login via Auth pane
6. Add video file size limit (100MB max)

**Medium-term (1-3 months):**
7. Add Gemini as native video provider
8. Add CI/CD pipeline (GitHub Actions)
9. Add Sentry for production error monitoring

---

## Final Conclusion

Reel Prompt Studio is a well-structured, functionally complete platform for its target use case. The monorepo architecture is clean, TypeScript coverage is strong, and the AI pipeline is sophisticated with proper error handling, timeouts, and fallbacks. The main gaps are in testing (none), security hardening (rate limiting, CORS), and production deployment tooling (CI/CD). With the Docker support now added and documentation complete, the project is ready for a structured production deployment.

**Recommended next focus:** E2E tests + rate limiting + Gemini video support.
