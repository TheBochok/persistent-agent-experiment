import OpenAI from 'openai';
import config from '../config/env.js';

const grok = new OpenAI({
  apiKey: config.GROK_API_KEY,
  baseURL: config.GROK_BASE_URL,
});

export const generateImage = async (prompt: string): Promise<Buffer | null> => {
  if (!config.GROK_API_KEY) {
    console.error('Missing GROK_API_KEY');
    return null;
  }

  console.log('[Image Gen Start] Calling Grok API with prompt:', prompt);

  try {
    const response = await grok.images.generate({
      model: "grok-imagine-image-pro",
      prompt: prompt,
    });

    console.log('[Grok Image Debug] API Response stringified:', JSON.stringify(response));

    const imageData = response.data?.[0];
    const url = imageData?.url;
    if (!url) {
      console.error('Grok Image Gen: No URL in response', response);
      return null;
    }

    const imageResponse = await fetch(url);
    if (!imageResponse.ok) {
      console.error('Failed to fetch image from Grok URL:', await imageResponse.text());
      return null;
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Grok Image Gen Failed:', error);
    return null;
  }
};
