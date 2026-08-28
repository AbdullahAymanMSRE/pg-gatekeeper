ALTER TABLE customers ALTER COLUMN email TYPE varchar(20) USING left(email, 20);
