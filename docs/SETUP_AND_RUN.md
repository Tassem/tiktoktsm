# Setup & Run Guide — Reel Prompt Studio

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20+ | LTS recommended |
| pnpm | 9+ | `npm i -g pnpm` |
| PostgreSQL | 15+ | Local or cloud |
| ffmpeg | Any | Required for audio extraction |

## 1. Clone & Install

```bash
git clone https://github.com/Tassem/tiktoktsm.git
cd tiktoktsm
pnpm install
```

## 2. Environment Variables

```bash
cp .env.example .env
# Edit .env and fill in all required values
```

Required variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Random 32+ char string |
| `CLERK_SECRET_KEY` | From Clerk Dashboard |
| `VITE_CLERK_PUBLISHABLE_KEY` | From Clerk Dashboard |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Replit AI or custom OpenAI base URL |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | API key for the above |

## 3. Database Setup

```bash
# Push schema to your PostgreSQL database
pnpm --filter @workspace/db run push
```

The server seeds default data on first startup:
- Nano Banana image provider
- Default AI system prompts

## 4. Run in Development

**Option A: Replit (recommended)**
- All three workflows start automatically via Replit

**Option B: Manual (3 terminals)**

```bash
# Terminal 1 — API Server
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend
pnpm --filter @workspace/reel-prompt-studio run dev

# Terminal 3 — (optional) Component Sandbox
pnpm --filter @workspace/mockup-sandbox run dev
```

## 5. Run with Docker

```bash
# Build and start all services
docker compose up --build

# Run only the API
docker compose up api

# Run only the frontend
docker compose up frontend
```

The `docker-compose.yml` starts:
- `postgres` — PostgreSQL 15 on port 5432
- `api` — Express API on port 8080
- `frontend` — Vite frontend on port 3000

## 6. Build for Production

```bash
# Build API
pnpm --filter @workspace/api-server run build

# Build Frontend
pnpm --filter @workspace/reel-prompt-studio run build
```

## 7. Admin Setup

1. Create an account via the sign-up page
2. In the Clerk Dashboard (or Replit Auth pane) → set your user's `publicMetadata.role = "admin"`
3. Return to the app — Admin Panel and Dev Agent will be visible in the sidebar

## 8. Add AI Provider

Go to **Settings → AI Providers** and add either:
- **OpenRouter** — requires an OpenRouter API key
- **Custom** — any OpenAI-compatible API (base URL + key)

Then assign the model to services under **Service Assignments**.

> If Replit AI env vars are set, the app works out of the box with no manual provider setup.
