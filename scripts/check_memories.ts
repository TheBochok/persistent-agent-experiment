import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

async function check() {
  console.log("Checking memories table...");
  const { data, error } = await supabase
    .from('memories')
    .select('id, user_id, content')
    .limit(10);

  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Memories found:", data);
  }
}

check();
