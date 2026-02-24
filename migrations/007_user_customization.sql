-- Migration to add persona_config to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS persona_config JSONB;
