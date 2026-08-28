ALTER TABLE orders ADD CONSTRAINT orders_customer_id_fkey2 FOREIGN KEY (customer_id) REFERENCES customers (id);
