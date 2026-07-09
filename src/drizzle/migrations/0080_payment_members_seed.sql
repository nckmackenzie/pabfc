INSERT INTO payment_members (id, payment_id, member_id)
SELECT gen_random_uuid()::text, id, member_id FROM payments;
