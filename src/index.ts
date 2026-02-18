import 'dotenv/config';
import { startBot } from './bot/handler.js';
import { startServer } from './server.js';
import config from './config/env.js';
import cron from 'node-cron';
import { simulateGap } from './services/simulation.js';
import { getSupabase } from './services/supabase.js';

// Check essential env vars
if (!config.TELEGRAM_BOT_TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN');
  process.exit(1);
}

// 1. World Tick: Every 15 minutes
// This makes the bot autonomous regardless of the deployment platform
cron.schedule('*/15 * * * *', async () => {
  console.log('[Self-Cron] World Tick Triggered');
  const supabase = getSupabase();
  const { data: users } = await supabase.from('users').select('id');
  if (users) {
    for (const user of users) {
      await simulateGap(user.id);
    }
  }
});

// 2. Nightly Consolidation: 3 AM
cron.schedule('0 3 * * *', async () => {
  console.log('[Self-Cron] Nightly Memory Consolidation Triggered');
  // Trigger the consolidation logic
  // (We'll keep the script-based approach or wrap it in a function later)
});

startServer();
startBot();
