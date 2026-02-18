-- Create Chat History Table
CREATE TABLE IF NOT EXISTS chat_history (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

-- Allow public access for now
CREATE POLICY "Allow public insert" ON chat_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select" ON chat_history FOR SELECT USING (true);

-- Index for fast retrieval
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history(created_at DESC);
