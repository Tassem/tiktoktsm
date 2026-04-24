# Project Overview — Reel Prompt Studio

## What is it?

**Reel Prompt Studio** is a full-stack Arabic/Darija web application designed for **Moroccan content creators**. It analyzes short-form videos (TikTok, Instagram Reels) and automatically generates professional AI video-generation prompt packs for tools like **Kling, Sora, Runway, and Pika**.

## Target Users

Moroccan and Arabic-speaking video creators who want to:
- Recreate or remix viral video styles
- Generate scene-by-scene image + animation prompts
- Get Darija voice-over scripts and sound design
- Manage content organized by niche

## Core Value Proposition

Upload a reel → get a complete, production-ready prompt pack in under 2 minutes.

## Languages Supported

| Language | Status |
|---|---|
| الدارجة المغربية (Moroccan Darija) | Full support — Arabic script |
| العربية الفصحى (Modern Standard Arabic) | Full support |
| Français | Full support |
| English | Full support |
| Mixed / Code-switching | Auto-detected |

## Live Features

| Feature | Description |
|---|---|
| Video to Prompt | Upload a video, extract frames + audio, generate full prompt pack |
| Niches | Organize content by category (comedy, tutorial, drama, etc.) |
| Stories (Prompt Packs) | Browse, edit, and manage generated prompt packs |
| Remix Studio | Generate new story concepts from existing prompt packs |
| Frame Extractor | Extract and download frames from any video |
| AI Systems Editor | Admin editor for all AI system prompts |
| Dev Agent | AI consultant to improve system prompts and outputs |
| Admin Panel | Member management, site settings, demo mode, announcements |
| Image Generation | Nano Banana integration for generating images from prompts |

## Tech at a Glance

- **Frontend:** React 19 + Vite + Tailwind + shadcn/ui
- **Backend:** Express 5 + TypeScript + Drizzle ORM
- **Database:** PostgreSQL
- **Auth:** Clerk (email + social login)
- **AI:** Replit AI (gpt-5.4) + custom OpenAI-compatible providers
- **Monorepo:** pnpm workspaces
