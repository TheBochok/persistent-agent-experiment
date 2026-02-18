-- Migration to add timezone to users table
alter table public.users
add column timezone text default 'UTC';

-- Optional: Set default for existing users
update public.users set timezone = 'Europe/Vilnius' where id = '1054416507'; -- Set for you specifically
