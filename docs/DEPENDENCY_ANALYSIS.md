# Dependency Analysis — Reel Prompt Studio

## Monorepo Workspace Packages

| Package | Role |
|---|---|
| `@workspace/api-server` | Express REST API |
| `@workspace/reel-prompt-studio` | React frontend SPA |
| `@workspace/db` | Drizzle ORM + PostgreSQL schema |
| `@workspace/api-zod` | Shared Zod request/response schemas |
| `@workspace/api-client-react` | React Query hooks for API calls |
| `@workspace/mockup-sandbox` | Isolated component preview (dev only) |

## API Server Dependencies

| Package | Version | Purpose |
|---|---|---|
| `express` | ^5 | HTTP server framework |
| `@clerk/express` | ^2.1.5 | Clerk auth middleware |
| `drizzle-orm` | catalog | ORM for PostgreSQL |
| `zod` | ^3.25.0 | Schema validation |
| `archiver` | ^7.0.1 | ZIP export for prompt packs |
| `cookie-parser` | ^1.4.7 | Cookie parsing |
| `cors` | ^2 | CORS headers |
| `http-proxy-middleware` | ^3.0.5 | Clerk proxy passthrough |
| `pino` | ^9 | Structured JSON logging |
| `pino-http` | ^10 | HTTP request logging |
| `@distube/ytdl-core` | ^4.16.12 | YouTube video download |

## Frontend Dependencies

| Package | Version | Purpose |
|---|---|---|
| `react` | catalog | UI framework |
| `@clerk/react` | ^6.4.2 | Clerk auth SDK |
| `@tanstack/react-query` | catalog | Server state management |
| `wouter` | ^3.3.5 | Lightweight client router |
| `tailwindcss` | catalog | Utility CSS framework |
| `framer-motion` | catalog | Animations |
| `lucide-react` | catalog | Icons |
| `jszip` | ^3.10.1 | Client-side ZIP export |
| `recharts` | ^2.15.2 | Charts (dashboard stats) |
| `@radix-ui/*` | various | Accessible UI primitives (all in use) |
| `date-fns` | ^3.6.0 | Date formatting |
| `react-hook-form` | ^7.55.0 | Form state management |
| `zod` | catalog | Form validation |

## Unused Packages Analysis

### Frontend — All Radix UI components are used
All 27 `@radix-ui/*` packages are imported in `components/ui/` files.

### Potentially Underutilized
| Package | Notes |
|---|---|
| `play-dl` (workspace root) | Installed at workspace root but usage not confirmed in main artifacts |
| `recharts` | Used in dashboard — only if dashboard stats are displayed |
| `react-day-picker` | Part of shadcn Calendar component — may not be used in main pages |
| `embla-carousel-react` | Part of shadcn Carousel — may not be actively used in pages |
| `input-otp` | Part of shadcn OTP input — only needed for invite codes |
| `vaul` | Shadcn Drawer primitive — check if Drawer component is used |
| `cmdk` | Command palette — check if Command component is used |
| `next-themes` | Theme toggling — dark mode is CSS-variable based, may be redundant |

## Dependency Risks

| Package | Risk | Recommendation |
|---|---|---|
| `@distube/ytdl-core` | YouTube TOS, frequently breaks | Treat as optional fallback |
| `play-dl` | Same as above | Consolidate with ytdl-core |
| `archiver` | Low risk | Pin to specific version |
| `@clerk/express` ^2 | Minor version changes can affect middleware | Pin or use lockfile strictly |

## Update Recommendations

```bash
# Check for outdated packages
pnpm outdated

# Update non-breaking (patch + minor)
pnpm update --recursive --latest
```
