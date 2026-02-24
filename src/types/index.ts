export interface User {
  id: string;
  name: string;
  affection: number;
  created_at?: string;
  timezone?: string; // e.g. 'Europe/Vilnius'
  persona_config?: PersonaConfig;
}

export interface PersonaConfig {
  name: string;
  visual_description: string;
  personality_traits: string[];
  speech_style: string;
  archetype: string;
}

export * from './state.js';
