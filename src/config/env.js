"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_KEY: process.env.SUPABASE_KEY || '',
    GROK_API_KEY: process.env.GROK_API_KEY || '',
    GROK_BASE_URL: process.env.GROK_BASE_URL || 'https://api.x.ai/v1',
    HF_API_KEY: process.env.HF_API_KEY || '',
    HF_MODEL_ID: process.env.HF_MODEL_ID || 'runwayml/stable-diffusion-v1-5', // Placeholder
};
//# sourceMappingURL=env.js.map