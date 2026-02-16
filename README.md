# Project HER (AI Companion)

## Setup

1.  **Clone the repo:**
    ```bash
    git clone <repo-url>
    cd project-her
    npm install
    ```

2.  **Configure Environment:**
    Copy `.env.example` to `.env` and fill in the details:
    ```bash
    cp .env.example .env
    ```
    - `TELEGRAM_BOT_TOKEN`: From @BotFather
    - `SUPABASE_URL` & `SUPABASE_KEY`: From Supabase dashboard
    - `GROK_API_KEY`: xAI API Key

3.  **Database Setup (Supabase):**
    Run the following SQL in Supabase SQL Editor:
    ```sql
    create table public.users (
      id text primary key,
      name text,
      affection int default 50,
      created_at timestamp with time zone default timezone('utc'::text, now())
    );
    ```

4.  **Run:**
    ```bash
    npm run dev
    ```

## Architecture
- **Bot:** Telegraf (Telegram)
- **Brain:** Grok (xAI)
- **Memory/State:** Supabase (PostgreSQL)
- **Affection System:** Tracks user interaction quality to adjust personality.
