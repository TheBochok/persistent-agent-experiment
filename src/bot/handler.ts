import { Telegraf } from 'telegraf';
import config from '../config/env.js';
import { generateText } from '../services/grok.js';
import { getUser, createUser, updateUserAffection } from '../services/supabase.js';
import type { User } from '../types/index.js';

const bot = new Telegraf(config.TELEGRAM_BOT_TOKEN);

async function ensureUser(userId: string, name: string): Promise<User | null> {
  const user = await getUser(userId);
  if (user) return user;
  return createUser(userId, name);
}

bot.start(async (ctx) => {
  const userId = ctx.from.id.toString();
  const name = ctx.from.first_name || 'Anonymous';

  const existing = await getUser(userId);
  if (existing) {
    await ctx.reply(`Oh, it's you again.`);
    return;
  }

  const user = await createUser(userId, name);
  if (!user) {
    await ctx.reply('Failed to create user. Please try again.');
    return;
  }

  await ctx.reply(`Hi ${name}. Who are you?`);
});

bot.on('text', async (ctx) => {
  const userId = ctx.from.id.toString();
  const name = ctx.from.first_name || 'Anonymous';

  const user = await ensureUser(userId, name);
  if (!user) {
    await ctx.reply('Failed to load user. Please try again.');
    return;
  }

  const userMessage = ctx.message.text;

  try {
    const reply = await generateText(userMessage, {
      user: name,
      affection: user.affection,
    });

    const delta = userMessage.toLowerCase().includes('love') ? 5
      : userMessage.toLowerCase().includes('hate') ? -5
      : 1;

    await updateUserAffection(userId, user.affection, delta);
    await ctx.reply(reply);
  } catch (err) {
    console.error('Error handling message:', err);
    await ctx.reply('Something went wrong. Please try again.');
  }
});

export const startBot = () => {
  bot.launch().catch((err) => {
    console.error('Failed to launch bot:', err);
    process.exit(1);
  });
  console.log('Bot started');

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
};
