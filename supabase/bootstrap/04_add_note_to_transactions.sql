-- Migration prod `add_note_to_transactions` (20261026090825), rejouée telle quelle sur test.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS note text;
