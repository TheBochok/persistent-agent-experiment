-- Enable pgvector extension
create extension if not exists vector;

-- Create memories table
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  content text not null, -- The summarized memory/fact
  embedding vector(768), -- Gemini text-embedding-004 is 768 dimensions
  created_at timestamptz default now(),
  metadata jsonb default '{}'::jsonb -- Tags: "work", "hobbies", "family"
);

-- Enable RLS
alter table public.memories enable row level security;
create policy "Users can read own memories" on public.memories
  for select using (auth.uid()::text = user_id);

-- Create index for fast similarity search
create index on public.memories using hnsw (embedding vector_cosine_ops);
