-- Migration prod `add_epingle_to_transactions` (20261025182057).
-- Sur test, rejouée SANS la reprise de données `UPDATE transactions SET epingle = true;`
-- (base vide : sans objet).
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS epingle boolean NOT NULL DEFAULT false;
