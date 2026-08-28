ALTER TABLE orders ADD COLUMN first_seen_at timestamptz NOT NULL DEFAULT clock_timestamp();
