# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Project HER is a TypeScript/Node.js AI companion Telegram bot. It uses Grok (xAI) as its language model, Supabase (PostgreSQL) for persistence, and implements an affection system that dynamically adjusts the AI's personality based on user interaction quality.

## Commands

```bash
npm run dev      # Run in development mode (ts-node-esm)
npm run build    # Compile TypeScript to dist/
npm start        # Run compiled output (dist/index.js)
```

No test framework or linter is configured yet. Always edit `src/` — never `dist/` (compiled output, not source of truth).

## Database Setup

Run once in Supabase SQL Editor:
```sql
create table public.users (
  id text primary key,
  name text,
  affection int default 50,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
```

## Architecture

```
src/
├── index.ts              # Entry point — loads dotenv, validates env, starts bot
├── config/env.ts         # Default-exported config object (reads process.env)
├── types/index.ts        # User interface {id, name, affection, created_at}
├── bot/handler.ts        # Telegraf setup: /start + text message handlers
└── services/
    ├── grok.ts           # Grok API via OpenAI SDK pointed at xAI endpoint
    └── supabase.ts       # User CRUD + affection updates (clamped 0–100)
```

**Message flow:** Telegram message → `bot/handler.ts` fetches/creates user → calls `generateText()` with message + affection context → updates affection score → replies.

**Affection tiers** (`grok.ts`): <30 = cold/distant, 30–80 = friendly/neutral, >80 = warm/flirty. New users start at 50.

**Affection scoring** (`handler.ts`): Currently MVP/placeholder — keyword-based (+5 for "love", −5 for "hate", +1 otherwise). The intended design is to ask Grok to return `{ reply, score_delta }` JSON instead.

## Key Technical Details

- **Grok integration** — Uses the `openai` npm package with `baseURL: 'https://api.x.ai/v1'` (default, no env var needed). Current model: `grok-4-1-fast-non-reasoning`
- **ESM modules** — `"type": "module"` in package.json, `NodeNext` module resolution in tsconfig. All local imports require `.js` extensions even for `.ts` source files
- **dotenv loading** — `import 'dotenv/config'` is in `index.ts` only; it must remain the first import there
- **Supabase affection update** — `updateUserAffection()` makes two DB calls (fetch then update); no optimistic locking
- **Chat history** — Not yet implemented; `history` is always passed as `''` to `generateText()`
- **HF vars** (`HF_API_KEY`, `HF_MODEL_ID`) — Reserved for future Hugging Face / Stable Diffusion image generation; not implemented yet
- **Environment variables** — `TELEGRAM_BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_KEY`, `GROK_API_KEY` are required; `GROK_BASE_URL` defaults to `https://api.x.ai/v1`
