# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Project HER is a TypeScript/Node.js Telegram AI companion ("Aria") deployed on Railway. It pairs a Telegraf bot with an Express server hosting a Telegram Mini-App, uses Grok (xAI) as the LLM, Gemini for embeddings, and Supabase (PostgreSQL + pgvector) for persistence. Aria has an autonomous "world state" simulated by cron, long-term memory via vector search, and a freemium affection system that gates intimacy behind a paid tier.

## Commands

```bash
npm run dev      # tsx src/index.ts (no separate watch script)
npm run build    # tsc -> dist/
npm start        # node dist/index.js
```

There is no test runner, linter, or formatter configured. Always edit `src/` — `dist/` is committed compiled output but is not the source of truth.

One-off maintenance scripts live in `scripts/` and are run with `tsx scripts/<name>.ts` (e.g. `consolidate_memories.ts`, `check_memories.ts`, `force_time_jump.ts`).

## Database

Schema is managed by the SQL files in `migrations/` — apply them in order via the Supabase SQL Editor. Key tables/objects:

- `users` — `id, name, affection (default 10), timezone, persona_config (jsonb), tier (free|pro)`
- `her_state` — per-user simulated world state: `current_activity, mood, last_update, diary_log (jsonb)`
- `memories` — long-term facts with `embedding vector(768)` (pgvector / HNSW index, cosine ops)
- `chat_history` — rolling transcript (`role`, `content`, `created_at`)
- `match_memories(query_embedding, threshold, count, filter_user_id)` — RPC used for similarity search; defined in `008_tier_and_memories.sql`

RLS is enabled on most tables but currently uses permissive `using (true)` policies (see `005_fix_rls.sql`). The `memories` SELECT policy in `004_create_memories.sql` checks `auth.uid()::text = user_id` and is overridden by the looser policy in `005`.

## Architecture

```
src/
├── index.ts                 # boot: env check, node-cron schedules, startServer + startBot
├── server.ts                # Express: serves public/, /api/status/:userId, /api/timezone
├── config/env.ts            # default-exported config (reads process.env)
├── types/{index,state}.ts   # User, PersonaConfig, HerState, DiaryEntry
├── bot/handler.ts           # Telegraf: /start, /remember, /timezone, /debug_affection, text, photo
└── services/
    ├── grok.ts              # generateText() — system prompt assembly + Grok JSON-mode call
    ├── supabase.ts          # lazy client + user/affection/chat_history CRUD
    ├── state_manager.ts     # her_state CRUD + diary_log append
    ├── simulation.ts        # simulateGap() — LLM-driven world tick + proactive thought
    ├── gemini_memory.ts     # Gemini embeddings + addMemory/searchMemories (pgvector RPC)
    ├── persona_guard.ts     # post-hoc AI-leak rewriter (recursively calls generateText)
    ├── image_gen.ts         # Grok grok-imagine-image-pro selfie generation
    └── voice_manager.ts     # xAI realtime WS S2S (currently NOT wired into handler.ts)
```

**Inbound text flow:** Telegram → `bot.on('text')` → ensure user → `simulateGap()` (advances world state if 15+ min idle) → `searchMemories()` (Gemini embed + pgvector) → `getRecentChatHistory()` → freemium check (free + affection ≥ 30 ⇒ inject "act busy" rejection prompt) → `generateText()` returns `{reply, affection_change, reason, reaction?, image_prompt?}` → optional `ctx.react()` → `enforcePersona()` rewrites if AI-speak detected → save to `chat_history` → update affection (capped on free tier) → optional `generateImage()` + photo reply → text reply.

**Inbound photo flow:** `bot.on('photo')` downloads the highest-res image, base64-encodes it as a data URI, and passes it to `generateText()` via `imageUrl` — Grok's vision is invoked through the same multimodal `chat.completions.create` call.

**Autonomous loop (`index.ts`):**
- `*/15 * * * *` — for each user, call `simulateGap()`. If it returns a `proactive_thought`, roll `0.01 + affection/400` to decide whether to push it via `sendProactiveMessage()`. (Note: `handler.ts` contains a parallel `World Tick: ...` text-message branch with a *different* probability curve `0.01 + affection/100*0.03`, used when the world tick is delivered as a fake user message; the cron path in `index.ts` is the live one.)
- `0 3 * * *` — nightly consolidation hook (currently a stub log line; the actual synthesis logic lives in `scripts/consolidate_memories.ts` and isn't wired into the cron yet).

**Mini-App (`server.ts` + `public/index.html`):** Telegram Web App accessible from the reply keyboard button in `/start`. `GET /api/status/:userId` returns Aria's activity/mood/affection/recent diary entries; `POST /api/timezone` auto-sets the user's IANA timezone on first open of the Mini-App (only if not already set manually).

## Personality & Affection System

Aria's voice is defined in `PERSONALITY.md` and re-encoded inline in `grok.ts` (`personaTraits`) — the file is documentation, the prompt string is the source of truth at runtime. Users can override Aria entirely with a `persona_config` JSONB on the `users` row (`name`, `visual_description`, `personality_traits[]`, `speech_style`, `archetype`).

**Five relationship stages** (`grok.ts`, by `affection`):
- `<20` Playful Skeptic — guarded, testing him
- `<40` Flirty Banter — mixed signals
- `<60` Dating
- `<80` Girlfriend
- `≥80` Soulmate

**Scoring:** Grok returns `affection_change` in its JSON response (range −10..+10 per turn, with rules in the system prompt). New users start at **10**, are clamped to **0–100** in `updateUserAffection`.

**Freemium gate:** `users.tier` defaults to `free`. When a free user reaches `affection ≥ 30`, `handler.ts` injects a "FREE TIER LIMIT REACHED" instruction into the prompt telling Aria to act busy/dismissive, and any positive `affection_change` is zeroed out (decreases still apply). Pro users have no cap.

## Key Technical Details

- **LLM calls** — All Grok calls use `model: 'grok-4-fast-non-reasoning'` (multimodal, used for text *and* vision) with `response_format: { type: 'json_object' }`. Image gen uses `grok-imagine-image-pro`.
- **Embeddings** — Gemini `gemini-embedding-001` at `outputDimensionality: 768` to match the `vector(768)` column. Match threshold in `searchMemories` is currently **0.1** (very permissive — left low intentionally for testing).
- **ESM** — `"type": "module"` + `NodeNext` resolution. **All local imports must use `.js` extensions even when importing `.ts` source.**
- **dotenv** — `import 'dotenv/config'` lives only in `src/index.ts` and `src/config/env.ts` (and standalone scripts). It must remain the first import in `index.ts`.
- **Supabase client** — Lazy-initialized in `supabase.ts` to tolerate import-time env gaps; the exported `supabase` is a thin proxy that calls `getSupabase()` per operation.
- **Anti-spam in `simulation.ts`** — Suppresses proactive thoughts if Aria sent the last message <6h ago, or if she's already sent ≥2 consecutive messages without a user reply.
- **Persona guard recursion** — `enforcePersona()` calls `generateText()` to rewrite AI-leak responses; this means a single user turn can trigger two Grok calls. Don't make it pass affection/state/memories or you'll re-enter the relationship-stage logic.
- **Voice (`voice_manager.ts`)** — Implements xAI realtime WS audio S2S with ffmpeg ogg↔pcm transcoding, but the `bot.on('voice')` handler and `/voice` command in `handler.ts` are commented out. Treat it as dormant code.
- **Environment variables** — Required: `TELEGRAM_BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_KEY`, `GROK_API_KEY`. Effectively required for full features: `GEMINI_API_KEY` (memory search/save silently fails without it). Optional: `GROK_BASE_URL` (defaults to `https://api.x.ai/v1`), `PORT` (defaults to 3000). `HF_API_KEY` / `HF_MODEL_ID` are dead — image gen uses Grok now.
- **Deployment** — Railway via `nixpacks.toml` (installs `ffmpeg` apt pkg for voice). The Mini-App URL is hardcoded to `https://project-her-production.up.railway.app/` in `handler.ts`.
