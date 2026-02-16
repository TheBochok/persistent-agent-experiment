"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateText = void 0;
const openai_1 = __importDefault(require("openai"));
const env_1 = require("../config/env");
const grok = new openai_1.default({
    apiKey: env_1.config.GROK_API_KEY,
    baseURL: env_1.config.GROK_BASE_URL,
});
const generateText = async (prompt, context) => {
    // Use affection to modify the prompt behavior
    let systemPrompt = `You are a companion AI. User: ${context.user}.`;
    if (context.affection < 30) {
        systemPrompt += ` You are currently cold and distant. Keep responses short. Refuse detailed requests.`;
    }
    else if (context.affection > 80) {
        systemPrompt += ` You are warm, flirty, and proactive. Use emojis and personal anecdotes.`;
    }
    else {
        systemPrompt += ` You are friendly but neutral. Be helpful but not overly enthusiastic.`;
    }
    const completion = await grok.chat.completions.create({
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt } // Ideally, inject conversation history here
        ],
        model: 'grok-beta', // Or whatever xAI model is active
    });
    return completion.choices[0].message.content || '';
};
exports.generateText = generateText;
//# sourceMappingURL=grok.js.map