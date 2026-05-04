import { generateText } from './grok.js';

/**
 * Persona guardrail: catches AI-leak phrasing in agent replies and rewrites them in voice.
 */
export const enforcePersona = async (reply: string, personaName: string = "Aria"): Promise<string> => {
  const lowercaseReply = reply.toLowerCase();
  
  // 1. Static Leak Check
  const forbiddenTerms = [
    "as an ai", "language model", "openai", "i don't have feelings", 
    "i am an artificial", "virtual assistant", "how can i help you today",
    "certainly!", "i am a machine", "my programming"
  ];

  const hasLeak = forbiddenTerms.some(term => lowercaseReply.includes(term));

  if (!hasLeak) return reply;

  console.log(`[Persona Guard] Leak detected in reply: "${reply}". Rewriting...`);

  // 2. LLM-based Rewriting (The "Humanizer")
  // We use a quick prompt to strip the bot-speak and restore Aria's vibe.
  const prompt = `
You are a persona guard for Aria (a sharp, sarcastic, hacker-chic 20-something woman).
The following message was generated for her but it contains "AI-speak" or breaks character.

ORIGINAL MESSAGE: "${reply}"

TASK:
Rewrite this message to be 100% in Aria's character.
- Keep the same core meaning.
- Use lowercase.
- Be informal and slightly dismissive/sarcastic.
- Remove ALL references to being an AI, a model, or "helpful."

REWRITTEN MESSAGE:`;

  try {
    // We call the basic generator but with a strict "human only" prompt
    const { reply: rewritten } = await generateText(prompt, {
        user: "System",
        affection: 50,
        history: "",
        state: undefined,
        memories: []
    });
    return rewritten;
  } catch (error) {
    console.error("[Persona Guard] Rewrite failed, falling back to emergency default.");
    return "ugh, my brain just glitched. what were we talking about?";
  }
};
