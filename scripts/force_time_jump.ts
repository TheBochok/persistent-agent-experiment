import { createClient } from '@supabase/supabase-js';
import config from '../src/config/env.js';

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);

async function forceTimeJump() {
  // Get the first user we find in her_state
  const { data: states, error } = await supabase
    .from('her_state')
    .select('*')
    .limit(1);

  if (error || !states || states.length === 0) {
    console.error('No user state found. Message the bot first!');
    return;
  }

  const userId = states[0].user_id;
  const oldTime = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(); // 4 hours ago

  console.log(`Forcing time jump for user ${userId}...`);
  console.log(`Setting last_update to ${oldTime}`);

  const { error: updateError } = await supabase
    .from('her_state')
    .update({ last_update: oldTime })
    .eq('user_id', userId);

  if (updateError) {
    console.error('Failed to update state:', updateError);
  } else {
    console.log('Success! Message her now. She should think it has been 4 hours.');
  }
}

forceTimeJump();
