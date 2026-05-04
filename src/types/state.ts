export interface HerState {
  user_id: string;
  current_activity: string;
  mood: string;
  last_update: string; // ISO timestamp
  diary_log: DiaryEntry[]; // JSON array
}

export interface DiaryEntry {
  timestamp: string;
  event: string;
  mood_shift?: number; // Effect on mood / affection score (-10 to +10)
}
