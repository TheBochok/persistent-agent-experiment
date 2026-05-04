# Project HER

Experimental conversational agent with persistent long-term memory, an autonomous internal world that evolves between user interactions, and a behavior model that adapts to interaction history. Built to explore whether continuity-of-state changes the texture of human–agent interaction.

The agent ("Aria") is delivered through Telegram, with a small Express server hosting a Telegram Mini-App for inspecting its current internal state (activity, mood, recent diary entries). Stack: Telegraf, Grok (xAI) for the LLM, Gemini for embeddings, Supabase (Postgres + pgvector) for persistence.

## Setup

```bash
git clone <repo-url>
cd project-her
npm install
cp .env.example .env   # fill in the values below
```

Required env vars:
- `TELEGRAM_BOT_TOKEN` — from @BotFather
- `SUPABASE_URL`, `SUPABASE_KEY` — from the Supabase dashboard
- `GROK_API_KEY` — xAI API key
- `GEMINI_API_KEY` — Google AI Studio (used for memory embeddings)
- `MINI_APP_URL` — public URL where the Mini-App is served (e.g. your Railway/Fly/etc. domain)

Optional: `GROK_BASE_URL` (defaults to `https://api.x.ai/v1`), `PORT` (defaults to 3000).

Apply the SQL files in `migrations/` in order via the Supabase SQL Editor before first run. They create `users`, `her_state`, `memories` (pgvector), `chat_history`, and the `match_memories` RPC.

## Run

```bash
npm run dev      # tsx src/index.ts
npm run build    # tsc -> dist/
npm start        # node dist/index.js
```

## How it works

- **`bot/handler.ts`** — Telegraf handlers for text, photos (vision), and a few slash commands.
- **`services/grok.ts`** — assembles the system prompt (current behavior stage, persona, recalled memories, current world state) and calls Grok in JSON mode.
- **`services/simulation.ts`** — every 15 minutes (via `node-cron` in `index.ts`) advances the agent's internal world state and occasionally produces a proactive message, gated by an interaction-history-scaled probability and anti-spam rules.
- **`services/gemini_memory.ts`** — long-term memory via Gemini embeddings + pgvector cosine similarity through the `match_memories` Postgres function.
- **`services/persona_guard.ts`** — post-hoc rewriter that catches AI-leak phrasing ("as an AI...") and rewrites the reply in character.
- **`server.ts`** + **`public/index.html`** — Telegram Mini-App surfacing the agent's current activity, mood, behavior state, and recent diary entries.

See `CLAUDE.md` for a more detailed architecture writeup and `PERSONALITY.md` for the agent's character brief.

## License

ISC. See `LICENSE`.
