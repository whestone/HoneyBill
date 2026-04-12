ALTER TABLE users ADD COLUMN first_name TEXT;
ALTER TABLE users ADD COLUMN last_name TEXT;
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN mobile TEXT;
-- Migrate existing full_name into last_name as fallback
UPDATE users SET last_name = full_name WHERE first_name IS NULL AND last_name IS NULL;
