ALTER TABLE orders ADD COLUMN first_seen_at timestamptz NOT NULL DEFAULT now();
