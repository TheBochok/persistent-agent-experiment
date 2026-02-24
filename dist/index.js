import 'dotenv/config';
import { startBot } from './bot/handler.js';
import config from './config/env.js';
const required = ['TELEGRAM_BOT_TOKEN', 'SUPABASE_URL', 'SUPABASE_KEY', 'GROK_API_KEY'];
for (const key of required) {
    if (!config[key]) {
        console.error(`Missing required environment variable: ${key}`);
        process.exit(1);
    }
}
startBot();
