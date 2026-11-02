-- Migration prod `add_epingle_to_transactions` (20261025182057).
-- Sur test, rejouée SANS la reprise de données `UPDATE transactions SET epingle = true;`.
-- Cause réelle : la première tentative (SQL prod complet) a été annulée par le client
-- (confirmation coupée automatiquement, voir supabase/README.md) ; la ligne UPDATE a alors
-- été retirée et la migration relancée. Sans effet sur le schéma : la base test était vide.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS epingle boolean NOT NULL DEFAULT false;
