import { Telegraf } from 'telegraf';
import { config } from '../config/env.js';
import { generateText } from '../services/grok.js';
import { getUser, createUser, updateUserAffection } from '../services/supabase.js';
const bot = new Telegraf(config.TELEGRAM_BOT_TOKEN);
bot.start(async (ctx) => {
    const userId = ctx.from.id.toString();
    const name = ctx.from.first_name || 'Anonymous';
    let user = await getUser(userId);
    if (!user) {
        user = await createUser(userId, name);
        if (!user) {
            ctx.reply('Failed to create user. Please try again.');
            return;
        }
        ctx.reply(`Hi ${name}. Who are you?`);
    }
    else {
        ctx.reply(`Oh, it's you again.`);
    }
});
bot.on('text', async (ctx) => {
    const userId = ctx.from.id.toString();
    const name = ctx.from.first_name || 'Anonymous';
    let user = await getUser(userId);
    if (!user) {
        user = await createUser(userId, name);
        if (!user) {
            ctx.reply('Failed to load user. Please try again.');
            return;
        }
    }
    const userMessage = ctx.message.text;
    // Here we would ideally ask Grok to evaluate sentiment AND generate a reply.
    // For MVP: assume neutral +1 for engagement unless explicitly "bad".
    // Real implementation: Prompt Grok for JSON { reply, score_delta }
    const reply = await generateText(userMessage, {
        user: name,
        affection: user.affection,
        history: '' // TODO: Fetch recent chat history
    });
    // Update affection (Placeholder logic)
    // If reply is very short or refuses, maybe decrease.
    // If user says "love", increase.
    if (userMessage.toLowerCase().includes('love')) {
        await updateUserAffection(userId, 5);
    }
    else if (userMessage.toLowerCase().includes('hate')) {
        await updateUserAffection(userId, -5);
    }
    else {
        await updateUserAffection(userId, 1); // Slow burn
    }
    ctx.reply(reply);
});
export const startBot = () => {
    bot.launch().catch(err => {
        console.error('Failed to launch bot', err);
    });
    console.log('Bot started');
    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
};
