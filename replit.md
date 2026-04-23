# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Reel Prompt Studio — AI Provider System

### New Provider Architecture (replaced old providerSettings + userApiKeys system)

Three new DB tables:
- `ai_providers` — OpenRouter or Custom AI providers (name, baseUrl, apiKey, isActive)
- `ai_provider_models` — Models per provider (modelId, label, capabilities: analysis/vision/images)
- `ai_service_assignments` — Maps AI services to specific models

### API Routes (all require auth + admin)
- `GET/POST /api/ai-providers` — list / create providers
- `PUT/DELETE /api/ai-providers/:id` — update / delete provider
- `POST /api/ai-providers/:id/models` — add model to provider
- `PUT/DELETE /api/ai-providers/models/:modelId` — update / delete model
- `GET /api/ai-service-assignments` — get service→model assignments
- `PUT /api/ai-service-assignments` — save assignments

### Service Keys
- `video-analysis` — Vision model for reel analysis
- `remix` — Text model for story remix
- `story-summary` — Text model for Darija summaries
- `image-generation` — Image generation model

### Resolution Order (prompt-generator.ts)
1. DB-configured model for service (via getServiceModel)
2. Fall back to Replit AI Integration env vars (AI_INTEGRATIONS_OPENAI_*)
