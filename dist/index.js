import 'dotenv/config';
import { startBot, sendProactiveMessage } from './bot/handler.js';
import { startServer } from './server.js';
import config from './config/env.js';
import cron from 'node-cron';
import { simulateGap } from './services/simulation.js';
import { getSupabase, getUser } from './services/supabase.js';
const required = ['TELEGRAM_BOT_TOKEN', 'SUPABASE_URL', 'SUPABASE_KEY', 'GROK_API_KEY'];
for (const key of required) {
    if (!config[key]) {
        console.error(`Missing required environment variable: ${key}`);
        process.exit(1);
    }
}
// 1. World Tick: Every 15 minutes
// This makes the bot autonomous regardless of the deployment platform
cron.schedule('*/15 * * * *', async () => {
    console.log('[Self-Cron] World Tick Triggered');
    const supabase = getSupabase();
    const { data: users } = await supabase.from('users').select('id');
    if (users) {
        for (const u of users) {
            // simulateGap returns a thought string if she has something to say
            // AND enough time has passed (15m+)
            const thought = await simulateGap(u.id);
            if (thought) {
                const user = await getUser(u.id);
                const affection = user?.affection || 0;
                // Probability Curve:
                // Base: 1% (Rarely random)
                // Scaling: Affection / 200 (At 100 affection -> +50% chance per tick)
                // This makes high affection users get messaged almost every hour if they are idle.
                // Let's tune it: Affection 50 -> 25% per 15m -> ~1 msg/hour. A bit high.
                // Let's do Affection / 400 -> 12.5% per 15m -> ~1 msg/2 hours.
                const chance = 0.01 + (affection / 400);
                if (Math.random() < chance) {
                    console.log(`[Proactive] Sending to ${u.id}: "${thought}" (Chance: ${chance.toFixed(2)})`);
                    await sendProactiveMessage(u.id, thought);
                }
                else {
                    console.log(`[Proactive] Skipped for ${u.id} (Thought generated but rolled low)`);
                }
            }
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
