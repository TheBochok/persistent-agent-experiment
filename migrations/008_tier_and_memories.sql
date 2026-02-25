-- Add tier column to users table
alter table public.users 
add column if not exists tier text default 'free';

-- Create match_memories function for vector search
create or replace function match_memories (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_user_id text
)
returns table (
  id uuid,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    memories.id,
    memories.content,
    1 - (memories.embedding <=> query_embedding) as similarity
  from memories
  where 1 - (memories.embedding <=> query_embedding) > match_threshold
  and memories.user_id = filter_user_id
  order by similarity desc
  limit match_count;
end;
$$;
