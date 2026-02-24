-- Migration for her_state table
create table public.her_state (
  user_id text primary key references public.users(id) on delete cascade,
  current_activity text not null default 'sleeping',
  mood text not null default 'neutral',
  last_update timestamptz not null default now(),
  diary_log jsonb not null default '[]'::jsonb
);

-- RLS policies (if enabled)
alter table public.her_state enable row level security;

create policy "Enable all for authenticated users" on public.her_state
  for all using (true);
