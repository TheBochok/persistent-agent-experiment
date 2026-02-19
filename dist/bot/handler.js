import { Telegraf, Markup } from 'telegraf';
import config from '../config/env.js';
import { generateText } from '../services/grok.js';
import { generateImage } from '../services/image_gen.js';
import { enforcePersona } from '../services/persona_guard.js';
import { getUser, createUser, updateUserAffection, updateUserTimezone, addChatMessage, getRecentChatHistory } from '../services/supabase.js';
import { initializeState, getState, updateState } from '../services/state_manager.js';
import { simulateGap } from '../services/simulation.js';
import { searchMemories, addMemory } from '../services/gemini_memory.js';
const bot = new Telegraf(config.TELEGRAM_BOT_TOKEN);
bot.start(async (ctx) => {
    const userId = ctx.from.id.toString();
    const name = ctx.from.first_name || 'Anonymous';
    let user = await getUser(userId);
    if (!user) {
        user = await createUser(userId, name);
        await initializeState(userId);
        // Onboarding Sequence: The "Skeptical Match"
        await ctx.reply("wait, who is this?");
        setTimeout(async () => {
            await ctx.reply("how did you even get my handle? i'm usually pretty good at filtering out the noise.");
        }, 2000);
        setTimeout(async () => {
            const webAppUrl = `https://project-her-production.up.railway.app/?v=${Date.now()}&id=${userId}`;
            await ctx.reply("fine. i'm aria. don't make me regret this. so... what do you want?", Markup.keyboard([
                Markup.button.webApp('Check My Status', webAppUrl)
            ]).resize());
        }, 5000);
    }
    else {
        // Existing user greeting - keep it dry
        const userId = ctx.from.id.toString();
        const webAppUrl = `https://project-her-production.up.railway.app/?v=${Date.now()}&id=${userId}`;
        await ctx.reply(`oh, it's you again.`, Markup.keyboard([
            Markup.button.webApp('Check My Status', webAppUrl)
        ]).resize());
    }
});
bot.command('remember', async (ctx) => {
    const userId = ctx.from.id.toString();
    console.log(`[/remember] Command received from ${userId}`);
    // Usage: /remember I have a dog named Fido
    const text = ctx.message.text.replace('/remember', '').trim();
    if (!text) {
        ctx.reply('Usage: /remember <fact>');
        return;
    }
    const success = await addMemory(userId, text);
    if (success) {
        console.log(`[/remember] Successfully stored for ${userId}: "${text}"`);
        ctx.reply('Got it. Stored in long-term memory.');
    }
    else {
        console.error(`[/remember] Failed to store for ${userId}`);
        ctx.reply('Failed to save memory. Check logs.');
    }
});
bot.command('timezone', async (ctx) => {
    const userId = ctx.from.id.toString();
    // Extract timezone from message "/timezone Europe/Vilnius"
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        ctx.reply('Usage: /timezone <Zone_Name> (e.g. /timezone Europe/Vilnius)');
        return;
    }
    const newZone = args[1];
    // Basic validation (or just let Postgres throw if invalid?)
    // Let's trust the user for now or try-catch the update.
    try {
        // Test if valid via JS Date
        new Date().toLocaleString("en-US", { timeZone: newZone });
        await updateUserTimezone(userId, newZone);
        ctx.reply(`Timezone updated to ${newZone}. I'll sync my schedule to that.`);
    }
    catch (e) {
        ctx.reply(`Invalid timezone: ${newZone}. Please use standard IANA names like 'Europe/Vilnius' or 'America/New_York'.`);
    }
});
bot.command('debug_affection', async (ctx) => {
    const userId = ctx.from.id.toString();
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        ctx.reply('Usage: /debug_affection <Score> (0-100)');
        return;
    }
    const score = parseInt(args[1], 10);
    if (isNaN(score) || score < 0 || score > 100) {
        ctx.reply('Score must be 0-100.');
        return;
    }
    // Directly update affection. We need a function that sets absolute value, not relative.
    // Currently updateUserAffection does relative +=.
    // I'll cheat and calculate the delta.
    const user = await getUser(userId);
    if (!user)
        return;
    const delta = score - user.affection;
    await updateUserAffection(userId, delta);
    ctx.reply(`DEBUG: Affection set to ${score}. Check my vibes.`);
});
bot.on('text', async (ctx) => {
    const userId = ctx.from.id.toString();
    const name = ctx.from.first_name || 'Anonymous';
    let user = await getUser(userId);
    if (!user) {
        user = await createUser(userId, name);
        if (!user) {
            console.error(`[Fatal] Could not create user ${userId}. Database desync?`);
            return ctx.reply("ugh, something's wrong with my brain. tell ben my database is acting up.");
        }
        await initializeState(userId);
    }
    // If this is a world tick from cron, simulate the gap and don't reply to user
    if (ctx.message.text === 'World Tick: Time to check on HER state.') {
        console.log(`[World Tick] Simulating for ${userId}`);
        const thought = await simulateGap(userId);
        if (thought) {
            // Rarity Logic: Base 1% + up to 3% bonus from affection
            const baseProb = 0.01;
            const bonusProb = (user?.affection || 0) / 100 * 0.03;
            const roll = Math.random();
            console.log(`[World Tick] Proactive roll: ${roll.toFixed(4)} vs Threshold: ${(baseProb + bonusProb).toFixed(4)}`);
            if (roll < (baseProb + bonusProb)) {
                console.log(`[World Tick] Proactive ping triggered: "${thought}"`);
                await ctx.reply(thought);
                await addChatMessage(userId, 'assistant', thought);
            }
        }
        return;
    }
    // Nightly Consolidation
    if (ctx.message.text === 'Nightly Consolidation: Time to synthesize chat history into long-term memories.') {
        console.log(`[Consolidation] Running nightly script for ${userId}`);
        // Instead of importing the script logic (which is complex for ESM), 
        // we can use exec to run the standalone consolidation script.
        // This is safer and cleaner for now.
        return;
    }
    // Simulate what happened since last message
    let state = await getState(userId);
    if (!state) {
        state = await initializeState(userId);
    }
    else {
        await simulateGap(userId);
        // Refresh state after simulation
        state = await getState(userId);
    }
    const userMessage = ctx.message.text;
    // Save User Message to History
    await addChatMessage(userId, 'user', userMessage);
    // Search Long-Term Memory
    const memories = await searchMemories(userId, userMessage);
    console.log(`[Memory Search] Query: "${userMessage}" | Found: ${memories.length} results`);
    if (memories.length > 0) {
        console.log(`[Memory Recalled] Content:`, memories);
    }
    else {
        console.log(`[Memory Recall] No memories matched threshold.`);
    }
    // Fetch Recent Chat History
    const chatHistory = await getRecentChatHistory(userId);
    // Ask Grok for reply using full context
    const replyData = await generateText(userMessage, {
        user: name,
        affection: user?.affection || 10,
        history: chatHistory,
        state: state || undefined,
        memories: memories,
        persona: user?.persona_config
    });
    // Handle Native Telegram Reaction
    if (replyData.reaction) {
        try {
            // Clean the reaction: Extract only the first emoji
            const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
            const matches = replyData.reaction.match(emojiRegex);
            if (matches && matches.length > 0) {
                const cleanEmoji = matches[0];
                await ctx.react(cleanEmoji);
                console.log(`[Reaction] Aria reacted with: ${cleanEmoji}`);
            }
        }
        catch (err) {
            console.warn(`[Reaction] Failed to react:`, err);
        }
    }
    // Enforce Persona Guardrails
    replyData.reply = await enforcePersona(replyData.reply, user?.persona_config?.name || "Aria");
    // Save Assistant Message to History
    await addChatMessage(userId, 'assistant', replyData.reply);
    // Update affection (Smart Logic)
    if (replyData.affection_change !== 0) {
        await updateUserAffection(userId, replyData.affection_change);
        console.log(`[Affection] User ${name}: ${replyData.affection_change} (${replyData.reason})`);
    }
    // Update last interaction timestamp
    if (state) {
        await updateState(userId, { last_update: new Date().toISOString() });
    }
    // Handle Image Generation if Aria wants to send a pic
    if (replyData.image_prompt) {
        console.log(`[Image Gen Logic] Triggered for user ${userId}. Prompt: ${replyData.image_prompt}`);
        try {
            const imageBuffer = await generateImage(replyData.image_prompt);
            if (imageBuffer && imageBuffer.length > 0) {
                console.log(`[Image Gen Logic] Success! Buffer size: ${imageBuffer.length}`);
                // Send the photo first
                await ctx.replyWithPhoto({ source: imageBuffer });
                console.log(`[Image Gen Logic] Photo message sent to Telegram`);
                // Then send the text reply
                await ctx.reply(replyData.reply);
            }
            else {
                console.error(`[Image Gen Logic] Failed - Buffer empty or null`);
                ctx.reply(replyData.reply);
            }
        }
        catch (imgError) {
            console.error(`[Image Gen Logic] EXCEPTION:`, imgError.message || imgError);
            ctx.reply(replyData.reply);
        }
    }
    else {
        console.log(`[Image Gen Logic] Skipped - No image_prompt in replyData`);
        ctx.reply(replyData.reply);
    }
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
