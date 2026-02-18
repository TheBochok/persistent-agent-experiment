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
export default config;
