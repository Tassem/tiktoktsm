# Project Structure — Reel Prompt Studio

## Monorepo Layout

```
workspace/
├── artifacts/                     # Deployable applications
│   ├── api-server/                # Express 5 REST API
│   │   ├── src/
│   │   │   ├── app.ts             # Express app setup, middleware registration
│   │   │   ├── index.ts           # Server entry point (port binding)
│   │   │   ├── lib/
│   │   │   │   ├── ai-system-prompts.ts   # Default prompts + DB sync + OUTDATED_MARKERS
│   │   │   │   ├── prompt-generator.ts    # Core: frame analysis, AI calls, JSON normalization
│   │   │   │   ├── seed-providers.ts      # Seeds Nano Banana provider on startup
│   │   │   │   ├── video-downloader.ts    # yt-dlp / @distube/ytdl-core integration
│   │   │   │   └── logger.ts              # Pino structured logging
│   │   │   ├── middlewares/
│   │   │   │   ├── auth.ts                # requireAuth / requireAdmin
│   │   │   │   └── clerkProxyMiddleware.ts # Clerk frontend API proxy
│   │   │   └── routes/
│   │   │       ├── index.ts               # Route aggregator
│   │   │       ├── health.ts              # GET /healthz
│   │   │       ├── reel-prompt.ts         # Core: analyze, niches, packs, provider-settings
│   │   │       ├── admin.ts               # Admin: users, site-settings, announcements
│   │   │       ├── ai-providers.ts        # CRUD for AI providers + service assignments
│   │   │       ├── ai-systems.ts          # CRUD for system prompts (AI Systems page)
│   │   │       ├── generation.ts          # Image generation (Nano Banana)
│   │   │       ├── user-keys.ts           # Per-user encrypted API keys
│   │   │       └── frame-sessions.ts      # Frame extractor session management
│   │   ├── build.mjs                      # esbuild bundler config
│   │   └── tsconfig.json
│   │
│   ├── reel-prompt-studio/        # React SPA (main frontend)
│   │   ├── src/
│   │   │   ├── App.tsx            # Router, Clerk setup, route protection, QueryClient
│   │   │   ├── pages/
│   │   │   │   ├── dashboard.tsx  # Stats, recent activity
│   │   │   │   ├── studio.tsx     # Main: video upload, frame extraction, analysis, results
│   │   │   │   ├── niches.tsx     # Niche CRUD
│   │   │   │   ├── packs.tsx      # Prompt pack browser + detail view
│   │   │   │   ├── remix.tsx      # Remix Studio (story regeneration)
│   │   │   │   ├── settings.tsx   # AI providers + service assignments
│   │   │   │   ├── admin.tsx      # Admin panel (members, site settings, announcements)
│   │   │   │   ├── ai-systems.tsx # AI system prompt editor (admin)
│   │   │   │   ├── dev-agent.tsx  # Dev Agent AI chat (admin)
│   │   │   │   └── frame-extractor.tsx # Frame extraction tool
│   │   │   ├── components/
│   │   │   │   ├── layout.tsx     # AppLayout sidebar, AI status indicator
│   │   │   │   ├── announcement-banner.tsx
│   │   │   │   └── ui/            # shadcn/ui components (Radix-based)
│   │   │   └── hooks/
│   │   │       └── use-toast.ts
│   │   ├── public/                # favicon, logo, opengraph image
│   │   └── vite.config.ts
│   │
│   └── mockup-sandbox/            # Isolated component preview server (Canvas/Design)
│
├── lib/                           # Shared libraries
│   ├── db/                        # Drizzle ORM schema + migrations
│   │   └── src/schema/
│   │       ├── index.ts           # Barrel export
│   │       └── reel-prompt.ts     # All table definitions
│   ├── api-zod/                   # Zod schemas for all API request/response types
│   ├── api-client-react/          # React hooks wrapping fetch calls (useHealthCheck etc.)
│   └── api-spec/                  # OpenAPI spec (if present)
│
├── scripts/                       # Utility scripts
├── docs/                          # Project documentation (this folder)
├── .env.example                   # Environment variables reference
├── db_backup_*.sql                # Database snapshots
├── package.json                   # Workspace root
├── pnpm-workspace.yaml            # pnpm workspace config
└── replit.md                      # Replit-specific project memory
```

## Key Files Quick Reference

| File | Purpose |
|---|---|
| `artifacts/api-server/src/lib/prompt-generator.ts` | Core AI video analysis engine |
| `artifacts/api-server/src/lib/ai-system-prompts.ts` | All default system prompts + DB sync |
| `artifacts/api-server/src/routes/reel-prompt.ts` | Video analysis + packs endpoints |
| `artifacts/reel-prompt-studio/src/pages/studio.tsx` | Video upload + frame extraction UI |
| `artifacts/reel-prompt-studio/src/pages/admin.tsx` | Admin panel (members + site settings) |
| `lib/db/src/schema/reel-prompt.ts` | Database schema (single source of truth) |
