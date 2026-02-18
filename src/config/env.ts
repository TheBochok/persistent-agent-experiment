import 'dotenv/config';

const config = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_KEY: process.env.SUPABASE_KEY || '',
  GROK_API_KEY: process.env.GROK_API_KEY || '',
  GROK_BASE_URL: process.env.GROK_BASE_URL || 'https://api.x.ai/v1',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  HF_API_KEY: process.env.HF_API_KEY || '',
  HF_MODEL_ID: process.env.HF_MODEL_ID || 'runwayml/stable-diffusion-v1-5',
};

console.log('[Config Debug] BOT_TOKEN length:', config.TELEGRAM_BOT_TOKEN.length);
if (config.TELEGRAM_BOT_TOKEN.length > 0) {
  console.log('[Config Debug] BOT_TOKEN starts with:', config.TELEGRAM_BOT_TOKEN.substring(0, 10));
}

export default config;
