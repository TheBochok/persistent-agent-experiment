"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startBot = void 0;
const telegraf_1 = require("telegraf");
const env_1 = require("../config/env");
const grok_1 = require("../services/grok");
const supabase_1 = require("../services/supabase");
const index_1 = require("../types/index");
const bot = new telegraf_1.Telegraf(env_1.config.TELEGRAM_BOT_TOKEN);
bot.start(async (ctx) => {
    const userId = ctx.from.id.toString();
    const name = ctx.from.first_name || 'Anonymous';
    let user = await (0, supabase_1.getUser)(userId);
    if (!user) {
        user = await (0, supabase_1.createUser)(userId, name);
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
    let user = await (0, supabase_1.getUser)(userId);
    if (!user) {
        user = await (0, supabase_1.createUser)(userId, name);
        if (!user) {
            ctx.reply('Failed to load user. Please try again.');
            return;
        }
    }
    const userMessage = ctx.message.text;
    // Here we would ideally ask Grok to evaluate sentiment AND generate a reply.
    // For MVP: assume neutral +1 for engagement unless explicitly "bad".
    // Real implementation: Prompt Grok for JSON { reply, score_delta }
    const reply = await (0, grok_1.generateText)(userMessage, {
        user: name,
        affection: user.affection,
        history: '' // TODO: Fetch recent chat history
    });
    // Update affection (Placeholder logic)
    // If reply is very short or refuses, maybe decrease.
    // If user says "love", increase.
    if (userMessage.toLowerCase().includes('love')) {
        await (0, supabase_1.updateUserAffection)(userId, 5);
    }
    else if (userMessage.toLowerCase().includes('hate')) {
        await (0, supabase_1.updateUserAffection)(userId, -5);
    }
    else {
        await (0, supabase_1.updateUserAffection)(userId, 1); // Slow burn
    }
    ctx.reply(reply);
});
const startBot = () => {
    bot.launch().catch(err => {
        console.error('Failed to launch bot', err);
    });
    console.log('Bot started');
    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
};
exports.startBot = startBot;
//# sourceMappingURL=handler.js.map