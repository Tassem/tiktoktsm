# Architecture — Reel Prompt Studio

## Overview

The project is a **pnpm monorepo** with three main artifacts and three shared libraries.

```
┌─────────────────────────────────────────────────────────┐
│                    pnpm Workspace                        │
│                                                          │
│  artifacts/                     lib/                    │
│  ├── reel-prompt-studio  ←──── api-client-react         │
│  │   (React + Vite SPA)         api-zod                 │
│  │                              db                      │
│  ├── api-server           ──────┘                       │
│  │   (Express 5 API)                                    │
│  │                                                      │
│  └── mockup-sandbox                                     │
│      (Component Preview)                                │
└─────────────────────────────────────────────────────────┘
```

## System Architecture Diagram

```mermaid
graph TB
    subgraph Client["Browser (React SPA)"]
        UI[React Pages & Components]
        Clerk_FE[Clerk Auth SDK]
        QC[TanStack Query Cache]
    end

    subgraph Server["API Server (Express 5)"]
        MW_CLERK[Clerk Middleware]
        MW_AUTH[Auth Middleware]
        ROUTES[Route Handlers]
        PG[Prompt Generator]
        SYS_PROMPT[System Prompts Loader]
    end

    subgraph AI["AI Providers"]
        REPLIT_AI[Replit AI / gpt-5.4]
        CUSTOM_AI[Custom OpenAI-Compatible]
        NANO[Nano Banana Image Gen]
    end

    subgraph DB["PostgreSQL Database"]
        NICHES[niches]
        PACKS[prompt_packs]
        SCENES[scene_prompts]
        PROVIDERS[ai_providers]
        PROMPTS[ai_system_prompts]
        SETTINGS[site_settings]
        USERS[provider_settings]
    end

    subgraph Auth["Clerk Cloud"]
        CLERK_CLOUD[User Management]
    end

    UI -->|HTTP + cookies| ROUTES
    Clerk_FE -->|JWT tokens| MW_CLERK
    MW_CLERK --> MW_AUTH
    MW_AUTH --> ROUTES
    ROUTES --> PG
    PG --> SYS_PROMPT
    SYS_PROMPT -->|loads from DB| PROMPTS
    PG -->|OpenAI-compatible API| REPLIT_AI
    PG -->|OpenAI-compatible API| CUSTOM_AI
    ROUTES -->|image gen| NANO
    ROUTES <-->|R/W| DB
    MW_CLERK <-->|verify JWT| CLERK_CLOUD
```

## Video Analysis Flow

```mermaid
sequenceDiagram
    participant Browser
    participant API as API Server
    participant AI as AI Provider (gpt-5.4)

    Browser->>Browser: Extract 48 frames (1/3s) at 400px JPEG
    Browser->>Browser: Read full video as base64 for audio
    Browser->>API: POST /api/analyze<br/>{frames[], videoDataUrl, nicheId}

    API->>AI: POST /v1/audio/transcriptions<br/>(video audio → text, 60s timeout)
    AI-->>API: transcript text

    API->>API: Load system prompt from DB<br/>(video-analysis key)
    API->>AI: POST /v1/chat/completions<br/>{24 frames (low-detail) + transcript + system prompt}
    Note over AI: gpt-5.4 analyzes frames + audio<br/>Detects language, extracts scenes

    AI-->>API: JSON {title, detectedLanguage, summaryPrompt, scenes[]}

    API->>API: normalizeVideoAnalysisResponse()<br/>assign frame thumbnails to scenes

    API->>DB: INSERT prompt_packs + scene_prompts
    API-->>Browser: {promptPackId, scenes[]}
```

## AI Provider Resolution

```mermaid
flowchart TD
    A[AI Request] --> B{DB service assignment\nexists?}
    B -->|Yes| C[Use DB-configured\nmodel + credentials]
    B -->|No| D{Replit AI env vars\nset?}
    D -->|Yes| E[Use gpt-5.4 via\nReplit AI proxy]
    D -->|No| F[Throw: No AI provider\nconfigured]
    C --> G[Call OpenAI-compatible API]
    E --> G
```

## Database Schema

```mermaid
erDiagram
    niches {
        int id PK
        text name
        text description
        text icon
        text color
        int sort_order
    }
    prompt_packs {
        int id PK
        int niche_id FK
        text title
        text summary_prompt
        text status
        text source_url
        int analysis_id FK
    }
    scene_prompts {
        int id PK
        int pack_id FK
        int scene_number
        text scene_type
        text title
        text image_prompt
        text animation_prompt
        text voice_over_darija
        text sound_effects_prompt
        text scene_frame_url
    }
    reel_analyses {
        int id PK
        text source_url
        text raw_response
        text status
    }
    ai_providers {
        int id PK
        text type
        text name
        text base_url
        text api_key
        bool is_active
    }
    ai_provider_models {
        int id PK
        int provider_id FK
        text model_id
        text name
    }
    ai_service_assignments {
        int id PK
        text service_name
        int model_id FK
    }
    ai_system_prompts {
        int id PK
        text system_key
        text display_name
        text system_prompt
        text model_override
    }
    site_settings {
        int id PK
        text site_name
        bool site_locked
        text registration_mode
        bool force_demo_mode
    }
    niches ||--o{ prompt_packs : "has"
    prompt_packs ||--o{ scene_prompts : "contains"
    ai_providers ||--o{ ai_provider_models : "has"
    ai_provider_models ||--o{ ai_service_assignments : "assigned to"
```

## Request Authentication Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant CL as Clerk Proxy Middleware
    participant AM as Auth Middleware
    participant R as Route Handler

    C->>CL: HTTP Request + session cookie
    CL->>CL: Forward Clerk-related paths to Clerk Cloud
    CL->>AM: clerkMiddleware() populates auth
    AM->>AM: Check getAuth(req).userId
    alt No userId
        AM-->>C: 401 Unauthorized
    else Has userId
        AM->>AM: Check publicMetadata.role
        alt requireAdmin && role !== admin
            AM-->>C: 403 Forbidden
        else
            AM->>R: Proceed
        end
    end
```
