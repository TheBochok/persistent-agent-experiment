import express from 'express';
import { getState } from './services/state_manager.js';
import { getUser, updateUserTimezone } from './services/supabase.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Serve static files for the Mini-App frontend
app.use(express.static(path.join(__dirname, '../public')));

// CORS middleware to allow requests from the Telegram Mini-App domain
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// API endpoint for Aria's status
app.get('/api/status/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const state = await getState(userId);
    const user = await getUser(userId);
    
    if (!state) {
      return res.status(404).json({ error: 'State not found' });
    }

    // Calculate a "Social Battery" based on time since last update (just a mock logic for now)
    const lastUpdate = new Date(state.last_update).getTime();
    const now = new Date().getTime();
    const diffHours = (now - lastUpdate) / (1000 * 60 * 60);
    const battery = Math.max(20, Math.min(100, 100 - (diffHours * 5)));

    res.json({
      name: 'Aria',
      activity: state.current_activity,
      mood: state.mood,
      battery: Math.round(battery),
      affection: user?.affection || 0,
      recent_events: state.diary_log.slice(-3).reverse()
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Auto-set timezone from Mini App (fires silently on first open)
app.post('/api/timezone', async (req, res) => {
  const { userId, timezone } = req.body;
  if (!userId || !timezone) return res.status(400).json({ error: 'Missing fields' });

  const user = await getUser(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Only update if not already set by the user manually
  if (!user.timezone) {
    await updateUserTimezone(userId, timezone);
    console.log(`[Timezone] Auto-set for ${userId}: ${timezone}`);
  }

  res.json({ ok: true });
});

export const startServer = () => {
  app.listen(port, () => {
    console.log(`Mini-App server running on port ${port}`);
  });
};
