-- Migration to add timezone to users table
alter table public.users
add column timezone text default 'UTC';
