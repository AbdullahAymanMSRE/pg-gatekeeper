SELECT setseed(0.42);
INSERT INTO customers (email)
SELECT 'user' || g || '@example.com' FROM generate_series(1, 20000) g;
INSERT INTO orders (customer_id, status, total_cents, notes, created_at, updated_at)
SELECT (random() * 19999 + 1)::bigint,
       (ARRAY['pending','paid','shipped','cancelled'])[(random()*3+1)::int],
       (random() * 50000)::int,
       CASE WHEN random() < 0.1 THEN 'gift wrap' END,
       now() - (random() * interval '365 days'),
       now()
FROM generate_series(1, 200000) g;
ANALYZE;
