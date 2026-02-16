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

No test framework or linter is configured yet.

## Architecture

```
src/
├── index.ts              # Entry point — validates env, starts bot
├── config/env.ts         # Default-exported config object (dotenv)
├── types/index.ts        # TypeScript interfaces (User)
├── bot/handler.ts        # Telegram bot setup (Telegraf): /start + text handlers
└── services/
    ├── grok.ts           # Grok API via OpenAI SDK (xAI endpoint), affection-based system prompts
    └── supabase.ts       # User CRUD, affection score updates (clamped 0–100)
```

**Message flow:** Telegram message → `bot/handler.ts` fetches/creates user from Supabase → sends message + affection level to `services/grok.ts` → Grok generates response with personality matching affection tier → handler updates affection score and replies.

**Affection tiers** (in `grok.ts`): <30 = cold/distant, 30–80 = friendly/neutral, >80 = warm/flirty. New users start at 50.

## Key Technical Details

- **ESM modules** — `"type": "module"` in package.json, `NodeNext` module resolution in tsconfig
- **Strict TypeScript** — strict mode enabled, target ESNext
- **Database schema** — single `users` table: `id text PK, name text, affection int default 50, created_at timestamptz`
- **Environment variables** — `TELEGRAM_BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_KEY`, `GROK_API_KEY` (required); `HF_API_KEY`, `HF_MODEL_ID` (optional)
