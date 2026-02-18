import 'dotenv/config';
import { startBot } from './bot/handler.js';
import config from './config/env.js';
// Check essential env vars
if (!config.TELEGRAM_BOT_TOKEN) {
    console.error('Missing TELEGRAM_BOT_TOKEN');
    process.exit(1);
}
startBot();
