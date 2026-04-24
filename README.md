# Reel Prompt Studio

**Arabic/Darija AI video-to-prompt generator for Moroccan creators.**

Upload a short-form video → get a complete, scene-by-scene production prompt pack for AI video generators (Kling, Sora, Runway, Pika) — with image prompts, animation guides, Darija voice-overs, and sound design.

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your values

# Push database schema
pnpm --filter @workspace/db run push

# Start all services (3 terminals)
pnpm --filter @workspace/api-server run dev     # API on :8080
pnpm --filter @workspace/reel-prompt-studio run dev  # Frontend on :3000
```

> On **Replit**: all three workflows start automatically.

---

## Docker

```bash
docker compose up --build
```
- Frontend: http://localhost:3000
- API: http://localhost:8080

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + Tailwind + shadcn/ui |
| Backend | Express 5 + TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Clerk (email + social) |
| AI | GPT-5.4 via Replit AI + custom OpenAI-compatible |
| Monorepo | pnpm workspaces |

---

## Documentation

| Doc | Description |
|---|---|
| [Project Overview](docs/PROJECT_OVERVIEW.md) | What this is and who it's for |
| [Architecture](docs/ARCHITECTURE.md) | System design + Mermaid diagrams |
| [Project Structure](docs/PROJECT_STRUCTURE.md) | Folder and file guide |
| [Features](docs/FEATURES.md) | Implemented vs missing features |
| [Setup & Run](docs/SETUP_AND_RUN.md) | Full installation guide |
| [Dependency Analysis](docs/DEPENDENCY_ANALYSIS.md) | Package audit |
| [Security Review](docs/SECURITY_REVIEW.md) | Security risks + recommendations |
| [Roadmap](docs/ROADMAP_AND_RECOMMENDATIONS.md) | Priorities and next steps |

---

## Languages Supported

Darija (الدارجة) · Arabic (العربية) · French · English — auto-detected from video audio.

---

## Environment Variables

See [`.env.example`](.env.example) for all required variables.

---

## Developer Onboarding

### First time setup

1. **Install pnpm** — `npm i -g pnpm`
2. **Clone** — `git clone ... && cd ...`
3. **Install** — `pnpm install`
4. **Database** — Create a PostgreSQL DB, set `DATABASE_URL`
5. **Clerk** — Create a Clerk app at clerk.com, get `CLERK_SECRET_KEY` + `VITE_CLERK_PUBLISHABLE_KEY`
6. **AI** — Either use Replit AI integration (auto) or add a custom OpenAI-compatible provider in Settings
7. **Run** — `pnpm --filter @workspace/api-server run dev` + `pnpm --filter @workspace/reel-prompt-studio run dev`
8. **Admin role** — Register, then set `publicMetadata.role = "admin"` in Clerk Dashboard for your user

### Key concepts

- **System Prompts** live in the DB (`ai_system_prompts` table) and can be edited live via the Admin → AI Systems page
- **OUTDATED_MARKERS** in `ai-system-prompts.ts` auto-update old DB prompts on server restart
- **Demo Mode** — when no AI is configured, the app uses mock data; admin can also force demo ON/OFF
- **resolveAiConfig()** — checks DB service assignments first, then falls back to Replit AI env vars

### Where to find things

| Task | File |
|---|---|
| Modify AI analysis behavior | `artifacts/api-server/src/lib/prompt-generator.ts` |
| Change system prompts | `artifacts/api-server/src/lib/ai-system-prompts.ts` |
| Add a new API route | `artifacts/api-server/src/routes/` |
| Add a new page | `artifacts/reel-prompt-studio/src/pages/` + register in `App.tsx` |
| Modify DB schema | `lib/db/src/schema/reel-prompt.ts` then `pnpm --filter @workspace/db run push` |

---

## License

MIT
