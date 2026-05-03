import { Telegraf, Markup } from 'telegraf';
import config from '../config/env.js';
import { generateText } from '../services/grok.js';
import { generateImage } from '../services/image_gen.js';
import { enforcePersona } from '../services/persona_guard.js';
import { getUser, createUser, updateUserAffection, updateUserTimezone, addChatMessage, getRecentChatHistory } from '../services/supabase.js';
import { initializeState, getState, updateState } from '../services/state_manager.js';
import { simulateGap } from '../services/simulation.js';
import { searchMemories, addMemory } from '../services/gemini_memory.js';
import { voiceManager } from '../services/voice_manager.js';
import axios from 'axios';
import type { User, HerState } from '../types/index.js';

const bot = new Telegraf(config.TELEGRAM_BOT_TOKEN);

async function ensureUser(userId: string, name: string): Promise<User | null> {
  const user = await getUser(userId);
  if (user) return user;
  return createUser(userId, name);
}

bot.start(async (ctx) => {
  const userId = ctx.from.id.toString();
  const name = ctx.from.first_name || 'Anonymous';
  const webAppUrl = `${config.MINI_APP_URL}/?v=${Date.now()}&id=${userId}`;

  const existing = await getUser(userId);
  if (existing) {
    await ctx.reply(`oh, it's you again.`,
      Markup.keyboard([
        Markup.button.webApp('Check My Status', webAppUrl)
      ]).resize()
    );
    return;
  }

  const user = await createUser(userId, name);
  if (!user) {
    await ctx.reply('Failed to create user. Please try again.');
    return;
  }

  await initializeState(userId);

  // Onboarding Sequence: The "Skeptical Match"
  await ctx.reply("wait, who is this?");
  setTimeout(async () => {
    await ctx.reply("how did you even get my handle? i'm usually pretty good at filtering out the noise.");
  }, 2000);
  setTimeout(async () => {
    await ctx.reply("fine. i'm aria. don't make me regret this. so... what do you want?",
      Markup.keyboard([
        Markup.button.webApp('Check My Status', webAppUrl)
      ]).resize()
    );
  }, 5000);
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
  } else {
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
  try {
    // Test if valid via JS Date
    new Date().toLocaleString("en-US", { timeZone: newZone });
    await updateUserTimezone(userId, newZone);
    ctx.reply(`Timezone updated to ${newZone}. I'll sync my schedule to that.`);
  } catch (e) {
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
  if (!user) return;
  
  const delta = score - user.affection;
  await updateUserAffection(userId, delta);
  
  ctx.reply(`DEBUG: Affection set to ${score}. Check my vibes.`);
});

/*
bot.command('voice', async (ctx) => {
  const userId = ctx.from.id.toString();
  // Usage: /voice tell me a joke
  const text = ctx.message.text.replace('/voice', '').trim();
  
  if (!text) {
    ctx.reply('Usage: /voice <text>');
    return;
  }
  
  try {
    await ctx.sendChatAction('record_voice');
    // Ask Voice Manager to generate audio
    const voiceBuffer = await voiceManager.generateVoiceResponse(text);
    
    // Send it
    await ctx.replyWithVoice({ source: voiceBuffer });
    console.log(`[/voice] Sent generated voice to ${userId}`);
    
    // Save to history? Maybe not for debug commands.
  } catch (err) {
    console.error('[/voice] Error:', err);
    ctx.reply('Voice gen failed. Check logs.');
  }
});

// Handle incoming voice messages (Audio S2S)
bot.on('voice', async (ctx) => {
  const userId = ctx.from.id.toString();
  console.log(`[Voice] Received voice note from ${userId}`);

  // Download the file
  const fileId = ctx.message.voice.file_id;
  const fileLink = await ctx.telegram.getFileLink(fileId);
  const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
  const oggBuffer = Buffer.from(response.data);

  try {
    await ctx.sendChatAction('record_voice');
    const replyBuffer = await voiceManager.processVoiceMessage(oggBuffer);
    
    // Send voice reply
    await ctx.replyWithVoice({ source: replyBuffer });
    console.log(`[Voice] Sent reply to ${userId}`);
    
    // Log interaction
    await addChatMessage(userId, 'user', '[Voice Note]');
    await addChatMessage(userId, 'assistant', '[Voice Note]');

  } catch (err) {
    console.error('[Voice] Error processing:', err);
    ctx.reply("my mic is broken. or my brain. one of the two.");
  }

  await ctx.reply(`Hi ${name}. Who are you?`);
});
*/


bot.on('text', async (ctx) => {
  const userId = ctx.from.id.toString();
  const name = ctx.from.first_name || 'Anonymous';

  const user = await ensureUser(userId, name);
  if (!user) {
    console.error(`[Fatal] Could not create user ${userId}. Database desync?`);
    return ctx.reply("ugh, something's wrong with my brain. tell ben my database is acting up.");
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
    return;
  }

  // Simulate what happened since last message
  let state = await getState(userId);
  
  if (!state) {
    state = await initializeState(userId);
  } else {
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

  // Fetch Recent Chat History
  const chatHistory = await getRecentChatHistory(userId);

  // Freemium Logic: Check if user is capped
  let isCapped = false;
  let softRejectionPrompt = "";
  
  // Default tier to free if undefined
  const userTier = user?.tier || 'free';
  const currentAffection = user?.affection || 10;

  if (userTier === 'free' && currentAffection >= 30) {
    isCapped = true;
    softRejectionPrompt = `
[SYSTEM NOTICE: FREE TIER LIMIT REACHED]
The user is on the free tier and has hit the affection cap.
You must now act BUSY, DISMISSIVE, and DISTRACTED.
You are trying to end the conversation to "get back to work" or "go do something else."
Do NOT be mean, just be unavailable.
If they want your full attention, vaguely suggest they "buy you a coffee" or "upgrade" (implying subscription) but keep it in character (e.g., "i'd love to chat but i gotta focus. unless you're buying me coffee? lol").
Refuse to engage in deep emotional topics. Keep replies short and detached.
`;
  }

  // Ask Grok for reply using full context
  // We append the softRejectionPrompt to the userMessage effectively, or pass it in context if we modified generateText.
  // Since generateText constructs the system prompt, passing it as part of 'userMessage' is a hack but works if we don't want to change the signature.
  // BETTER: Append it to the memories or history context? 
  // Let's modify the userMessage sent to generateText to include a hidden system instruction if possible, 
  // OR just append it to the end of the prompt.
  
  let finalPrompt = userMessage;
  if (isCapped) {
      finalPrompt += `\n\n${softRejectionPrompt}`;
  }

  const replyData = await generateText(finalPrompt, { 
    user: name, 
    affection: currentAffection, 
    history: chatHistory, 
    state: state || undefined,
    memories: memories,
    persona: user?.persona_config,
    timezone: user?.timezone
  });

  // Handle Native Telegram Reaction
  if (replyData.reaction) {
    try {
      // Clean the reaction: Extract only the first emoji
      const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
      const matches = replyData.reaction.match(emojiRegex);
      if (matches && matches.length > 0) {
        const cleanEmoji = matches[0];
        await ctx.react(cleanEmoji as any);
        console.log(`[Reaction] Aria reacted with: ${cleanEmoji}`);
      }
    } catch (err) {
      console.warn(`[Reaction] Failed to react:`, err);
    }
  }

  // Enforce Persona Guardrails
  replyData.reply = await enforcePersona(replyData.reply, user?.persona_config?.name || "Aria");
  
  // Save Assistant Message to History
  await addChatMessage(userId, 'assistant', replyData.reply);
  
  // Update affection (Smart Logic)
  // If capped, we do NOT allow affection to increase. It can only decrease.
  let affectionChange = replyData.affection_change;
  
  if (isCapped && affectionChange > 0) {
      console.log(`[Affection Cap] User ${name} is capped at ${currentAffection}. Ignoring increase of ${affectionChange}.`);
      affectionChange = 0;
  }

  if (affectionChange !== 0) {
    await updateUserAffection(userId, affectionChange);
    console.log(`[Affection] User ${name}: ${affectionChange} (${replyData.reason})`);
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
        // Send the photo first
        await ctx.replyWithPhoto({ source: imageBuffer });
        // Then send the text reply
        await ctx.reply(replyData.reply);
      } else {
        ctx.reply(replyData.reply);
      }
    } catch (imgError: any) {
      console.error(`[Image Gen Logic] EXCEPTION:`, imgError.message || imgError);
      ctx.reply(replyData.reply);
    }
  } else {
    ctx.reply(replyData.reply);
  }
});

// Handle incoming photos (Vision Capability)
bot.on('photo', async (ctx) => {
  const userId = ctx.from.id.toString();
  const name = ctx.from.first_name || 'Anonymous';
  const caption = ctx.message.caption || '';
  
  console.log(`[Vision] Received photo from ${userId}. Caption: "${caption}"`);

  // Basic User Init (Duplicate logic, should refactor but keep for safety)
  let user = await getUser(userId);
  if (!user) {
    user = await createUser(userId, name);
    await initializeState(userId);
  }

  // Get the highest resolution photo
  const photos = ctx.message.photo;
  const fileId = photos[photos.length - 1].file_id;
  
  try {
    const fileLink = await ctx.telegram.getFileLink(fileId);
    console.log(`[Vision] File Link: ${fileLink.href}`);

    // Download the image as a buffer
    const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data);
    const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

    await ctx.sendChatAction('typing');

    // Fetch context
    let state = await getState(userId);
    if (!state) state = await initializeState(userId);
    
    // Save to history (User sent an image)
    await addChatMessage(userId, 'user', `[Sent an Image] ${caption}`);

    // Call Grok with Vision
    const chatHistory = await getRecentChatHistory(userId);
    
    // Pass caption as the prompt, or generic if empty
    const prompt = caption || "What do you think of this?";

    // Freemium Logic (Vision)
    let isCapped = false;
    let softRejectionPrompt = "";
    
    // Default tier to free if undefined
    const userTier = user?.tier || 'free';
    const currentAffection = user?.affection || 10;

    if (userTier === 'free' && currentAffection >= 30) {
      isCapped = true;
      softRejectionPrompt = ` [SYSTEM NOTICE: FREE TIER LIMIT REACHED. ACT BUSY/DISMISSIVE due to work/distraction. Suggest coffee/upgrade if they want attention.]`;
    }
    
    let finalPrompt = prompt + softRejectionPrompt;
    
    // Explicitly pass imageUrl (as base64 data URI)
    const replyData = await generateText(finalPrompt, { 
      user: name, 
      affection: currentAffection, 
      history: chatHistory, 
      state: state || undefined,
      memories: [],
      persona: user?.persona_config,
      imageUrl: base64Image,
      timezone: user?.timezone
    });

    // Enforce Persona
    replyData.reply = await enforcePersona(replyData.reply, user?.persona_config?.name || "Aria");

    // Reply
    await ctx.reply(replyData.reply);
    await addChatMessage(userId, 'assistant', replyData.reply);

    // Update affection
    let affectionChange = replyData.affection_change;
    if (isCapped && affectionChange > 0) {
        affectionChange = 0;
    }
    
    if (affectionChange !== 0) {
      await updateUserAffection(userId, affectionChange);
    }

  } catch (err) {
    console.error(`[Vision] Error processing photo:`, err);
    ctx.reply("i can't see that for some reason. glitch in the matrix?");
  }
});

export const sendProactiveMessage = async (userId: string, text: string) => {
  try {
    await bot.telegram.sendMessage(userId, text);
    console.log(`[Proactive] Sent to ${userId}: "${text}"`);
    // Also save to history so she remembers she said it
    await addChatMessage(userId, 'assistant', text);
  } catch (err) {
    console.error(`[Proactive] Failed to send to ${userId}:`, err);
  }
};

export const startBot = async () => {
  try {
    // Clear any stuck webhooks or polling sessions before starting
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    
    bot.launch().catch(err => {
      console.error('Failed to launch bot', err);
    });
    console.log('Bot started and cleared previous sessions');
  } catch (err) {
    console.error('Error during bot startup:', err);
  }
  
  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
};
