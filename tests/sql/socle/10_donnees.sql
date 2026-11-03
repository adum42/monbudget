-- Jeu de données fictif, de la même forme que la prod au 29/10/2026 (montants inventés).
-- Chargé APRÈS le schéma de départ (supabase/bootstrap/) et AVANT les migrations :
-- chaque migration est ainsi rejouée sur une base qui contient déjà des données, comme en prod.
-- Il ne doit donc utiliser que des colonnes qui existent avant toute migration.
--
-- Utilisateurs :
--   A = aaaaaaaa-0000-0000-0000-000000000001 (a@test) : le propriétaire, 3 comptes
--   B = bbbbbbbb-0000-0000-0000-000000000002 (b@test) : un autre utilisateur, 1 compte,
--       sert à vérifier que A ne voit ni ne touche les données de B.
-- Comptes : 10…0a Livret A, 20…0a Livret DD, 30…0a Bitcoin (A) ; 40…0b Livret B (B).

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test');

insert into public.categories (id, user_id, nom) values
  ('c0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Courses');

insert into public.comptes (id, user_id, nom, type) values
  ('10000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'Livret A',  'livret'),
  ('20000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'Livret DD', 'livret'),
  ('30000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'Bitcoin',   'investissement'),
  ('40000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002', 'Livret B',  'livret');

-- 58 transactions de A sans compte (4 entrées, 54 sorties), libellées « tx 1 » à « tx 58 ».
insert into public.transactions (user_id, description, montant, type, categorie_id, date)
select 'aaaaaaaa-0000-0000-0000-000000000001', 'tx ' || g, (g * 7.31)::numeric(10,2),
       case when g <= 4 then 'entrée' else 'sortie' end,
       case when g % 2 = 0 then 'c0000000-0000-0000-0000-000000000001'::uuid end,
       date '2026-09-01' + (g % 28)
from generate_series(1, 58) g;

insert into public.soldes (user_id, compte_id, date, montant) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', '2026-08-31', 100),
  ('aaaaaaaa-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', '2026-09-30', 150),
  ('aaaaaaaa-0000-0000-0000-000000000001', '20000000-0000-0000-0000-00000000000a', '2026-09-30', 30.72),
  ('aaaaaaaa-0000-0000-0000-000000000001', '30000000-0000-0000-0000-00000000000a', '2026-09-30', 4950),
  ('bbbbbbbb-0000-0000-0000-000000000002', '40000000-0000-0000-0000-00000000000b', '2026-09-30', 10);
