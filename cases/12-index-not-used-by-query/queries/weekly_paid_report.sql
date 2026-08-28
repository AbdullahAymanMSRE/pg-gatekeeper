SELECT id, total_cents FROM orders WHERE lower(status) = 'paid' AND created_at > now() - interval '7 days' ORDER BY created_at DESC;
