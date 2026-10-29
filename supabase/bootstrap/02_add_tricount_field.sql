-- Migration prod `add_tricount_field` (20261025180931), rejouée telle quelle sur test.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tricount TEXT DEFAULT 'non' CHECK (tricount IN ('non', 'oui', 'oui validé'));
