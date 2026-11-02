-- ============================================================================
-- Jeu de données fictives de la base TEST « monbudget-test » (ticket #21)
-- ============================================================================
--
-- À exécuter UNIQUEMENT sur TEST `ebupazakzfbpptmlrzze`, jamais sur PROD
-- `artvpflfhvouyngzgqob` : le script s'arrête de lui-même s'il détecte la prod.
--
-- Ce qu'il fait, pour UN utilisateur (celui de v_user_id ci-dessous) :
--   1. efface toutes les données de cet utilisateur (transactions, soldes,
--      comptes, catégories) ;
--   2. recrée 8 catégories, 4 comptes (un de chaque type, dont le compte
--      courant par défaut), des soldes mensuels et une trentaine de
--      transactions sur 3 mois (le mois en cours et les 2 précédents),
--      dont des virements internes (type `mouvement`).
-- Les autres utilisateurs ne sont jamais touchés.
--
-- Rejouable : relancer le script donne le même jeu de données, sans doublon.
-- Les dates sont calculées à partir du mois en cours, pour que l'écran du
-- mois courant ne soit jamais vide, quelle que soit la date d'exécution.
--
-- Tout est fictif et libellé « TEST … ». Aucun montant ni donnée réelle.
--
-- Comment le lancer : voir supabase/README.md, section « Jeu de données de test ».
-- Le script est un seul bloc `do` : il s'exécute en entier ou pas du tout.
-- ============================================================================

do $seed$
declare
  -- ┌──────────────────────────────────────────────────────────────────────┐
  -- │ PARAMÈTRE : identifiant de l'utilisateur de test (auth.users.id).    │
  -- │ Dashboard TEST → Authentication → Users → colonne « UID ».           │
  -- └──────────────────────────────────────────────────────────────────────┘
  v_user_id uuid := '00000000-0000-0000-0000-000000000000';

  -- Premier jour du mois en cours et des deux mois précédents
  m0 date := date_trunc('month', current_date)::date;
  m1 date := (date_trunc('month', current_date) - interval '1 month')::date;
  m2 date := (date_trunc('month', current_date) - interval '2 months')::date;

  -- Catégories
  c_salaire uuid; c_alim uuid; c_logement uuid; c_transport uuid;
  c_loisirs uuid; c_sante uuid; c_resto uuid; c_cadeaux uuid;
  -- Comptes
  k_courant uuid; k_livret uuid; k_invest uuid; k_especes uuid;

  n_tx int; n_mvt int; n_mois int;
begin
  -- ── Garde-fou 1 : jamais sur la prod ──────────────────────────────────────
  -- La prod contient le schéma de sauvegarde `backup_v1` (docs/RESTAURATION.md),
  -- volontairement absent de TEST.
  if exists (select 1 from pg_namespace where nspname = 'backup_v1') then
    raise exception 'ARRÊT : schéma backup_v1 détecté, cette base est la PROD (artvpflfhvouyngzgqob). Le jeu de données de test ne s''exécute que sur TEST (ebupazakzfbpptmlrzze). Rien n''a été modifié.';
  end if;

  -- ── Garde-fou 2 : paramètre renseigné et utilisateur existant ─────────────
  if v_user_id = '00000000-0000-0000-0000-000000000000' then
    raise exception 'ARRÊT : renseigner v_user_id en tête du script (UID de l''utilisateur de test). Rien n''a été modifié.';
  end if;
  if not exists (select 1 from auth.users where id = v_user_id) then
    raise exception 'ARRÊT : aucun utilisateur % dans auth.users de cette base. Rien n''a été modifié.', v_user_id;
  end if;

  -- ── 1. Effacement des données de cet utilisateur uniquement ──────────────
  -- Ordre imposé par les clés étrangères : les transactions d'abord (un compte
  -- qui porte des opérations ne peut pas être supprimé, #3), les soldes
  -- partent en cascade avec leurs comptes.
  delete from public.transactions where user_id = v_user_id;
  delete from public.soldes       where user_id = v_user_id;
  delete from public.comptes      where user_id = v_user_id;
  delete from public.categories   where user_id = v_user_id;

  -- ── 2. Catégories ─────────────────────────────────────────────────────────
  insert into public.categories (user_id, nom, type, couleur, emoji) values
    (v_user_id, 'TEST Salaire',     'entrée',   '#22C97A', '💼') returning id into c_salaire;
  insert into public.categories (user_id, nom, type, couleur, emoji) values
    (v_user_id, 'TEST Alimentation','sortie',   '#5B6EF5', '🛒') returning id into c_alim;
  insert into public.categories (user_id, nom, type, couleur, emoji) values
    (v_user_id, 'TEST Logement',    'sortie',   '#F59E0B', '🏠') returning id into c_logement;
  insert into public.categories (user_id, nom, type, couleur, emoji) values
    (v_user_id, 'TEST Transport',   'sortie',   '#14B8A6', '🚗') returning id into c_transport;
  insert into public.categories (user_id, nom, type, couleur, emoji) values
    (v_user_id, 'TEST Loisirs',     'sortie',   '#8B5CF6', '🎭') returning id into c_loisirs;
  insert into public.categories (user_id, nom, type, couleur, emoji) values
    (v_user_id, 'TEST Santé',       'sortie',   '#F05252', '💊') returning id into c_sante;
  insert into public.categories (user_id, nom, type, couleur, emoji) values
    (v_user_id, 'TEST Restaurants', 'sortie',   '#EC4899', '🍽️') returning id into c_resto;
  insert into public.categories (user_id, nom, type, couleur, emoji) values
    (v_user_id, 'TEST Cadeaux',     'les deux', '#378ADD', '🎁') returning id into c_cadeaux;

  -- ── 3. Comptes : un de chaque type ────────────────────────────────────────
  -- Le compte courant est le compte par défaut ; son solde initial est posé
  -- la veille du premier mois du jeu de données.
  insert into public.comptes (user_id, nom, type, banque, couleur, solde_initial, date_solde_initial, par_defaut)
    values (v_user_id, 'TEST Compte courant', 'courant', 'TEST Banque', '#7C6AF7', 1500.00, m2 - 1, true)
    returning id into k_courant;
  insert into public.comptes (user_id, nom, type, banque, couleur, solde_initial, date_solde_initial, plafond)
    values (v_user_id, 'TEST Livret A', 'livret', 'TEST Banque', '#22C97A', 3000.00, m2 - 1, 22950.00)
    returning id into k_livret;
  insert into public.comptes (user_id, nom, type, banque, couleur, solde_initial, date_solde_initial)
    values (v_user_id, 'TEST Portefeuille actions', 'investissement', 'TEST Courtier', '#F59E0B', 2000.00, m2 - 1)
    returning id into k_invest;
  insert into public.comptes (user_id, nom, type, banque, couleur, solde_initial, date_solde_initial)
    values (v_user_id, 'TEST Espèces', 'especes', null, '#14B8A6', 50.00, m2 - 1)
    returning id into k_especes;

  -- ── 4. Soldes relevés en banque (épargne et investissement, chaque mois) ──
  insert into public.soldes (user_id, compte_id, date, montant, note) values
    (v_user_id, k_livret, m2, 3000.00, 'TEST relevé'),
    (v_user_id, k_livret, m1, 3200.00, 'TEST relevé'),
    (v_user_id, k_livret, m0, 3400.00, 'TEST relevé'),
    (v_user_id, k_invest, m2, 2000.00, null),
    (v_user_id, k_invest, m1, 2085.40, null),
    (v_user_id, k_invest, m0, 2042.15, 'TEST baisse du marché');

  -- ── 5. Transactions : le même schéma de mois, trois fois ─────────────────
  -- Pour chaque mois (m2, m1, m0) : salaire, loyer, courses, transport,
  -- loisirs, restaurant, un virement vers le livret, un retrait d'espèces
  -- (mouvement courant → espèces) et une dépense payée en espèces.
  -- Les jours restent ≤ 28 pour exister dans tous les mois.
  insert into public.transactions
    (user_id, description, montant, type, categorie_id, date, compte_id, compte_dest_id, tricount, epingle, note)
  select v_user_id, t.description, t.montant, t.type, t.categorie_id, mois.d + t.jour, t.compte_id, t.compte_dest_id,
         t.tricount, t.epingle, t.note
  from (values (m2, 0), (m1, 1), (m0, 2)) as mois(d, k)
  cross join lateral (values
    -- description                       montant                 type         catégorie     jour compte     destination tricount     épinglée note
    ('TEST Salaire',                      2100.00,               'entrée',    c_salaire,    0,   k_courant, null::uuid, 'non',       true,  null::text),
    ('TEST Loyer',                        650.00,                'sortie',    c_logement,   1,   k_courant, null,       'non',       true,  null),
    ('TEST Courses supermarché',          84.30 + mois.k * 6.15, 'sortie',    c_alim,       4,   k_courant, null,       'non',       false, null),
    ('TEST Courses marché',               32.60,                 'sortie',    c_alim,       17,  k_courant, null,       'non',       false, 'TEST note : panier de légumes'),
    ('TEST Abonnement transports',        42.00,                 'sortie',    c_transport,  2,   k_courant, null,       'non',       false, null),
    ('TEST Cinéma',                       11.50 * (mois.k + 1),  'sortie',    c_loisirs,    12,  k_courant, null,       'oui',       false, null),
    ('TEST Restaurant entre amis',        48.90,                 'sortie',    c_resto,      20,  k_courant, null,       case mois.k when 0 then 'oui validé' else 'oui' end, false, null),
    ('TEST Virement épargne',             200.00,                'mouvement', null,         3,   k_courant, k_livret,   'non',       false, null),
    ('TEST Retrait espèces',              60.00,                 'mouvement', null,         9,   k_courant, k_especes,  'non',       false, null),
    ('TEST Boulangerie',                  7.80,                  'sortie',    c_alim,       10,  k_especes, null,       'non',       false, null)
  ) as t(description, montant, type, categorie_id, jour, compte_id, compte_dest_id, tricount, epingle, note);

  -- Quelques opérations ponctuelles, pour varier les listes et les statistiques
  insert into public.transactions
    (user_id, description, montant, type, categorie_id, date, compte_id, compte_dest_id, tricount, epingle, note) values
    (v_user_id, 'TEST Pharmacie',                   23.40, 'sortie',    c_sante,   m2 + 14, k_courant, null,     'non', false, null),
    (v_user_id, 'TEST Cadeau d''anniversaire',      45.00, 'sortie',    c_cadeaux, m1 + 15, k_courant, null,     'non', false, 'TEST note longue pour vérifier le retour à la ligne dans la liste des transactions'),
    (v_user_id, 'TEST Remboursement cadeau',        15.00, 'entrée',    c_cadeaux, m1 + 22, k_courant, null,     'non', false, null),
    (v_user_id, 'TEST Achat ETF',                  150.00, 'mouvement', null,      m1 + 5,  k_courant, k_invest, 'non', false, null),
    (v_user_id, 'TEST Opération sans catégorie',    19.99, 'sortie',    null,      m0 + 6,  k_courant, null,     'non', false, null);

  -- ── 6. Bilan ──────────────────────────────────────────────────────────────
  select count(*), count(*) filter (where type = 'mouvement'), count(distinct date_trunc('month', date))
    into n_tx, n_mvt, n_mois
    from public.transactions where user_id = v_user_id;
  raise notice 'Jeu de données TEST recréé : 8 catégories, 4 comptes, 6 soldes, % transactions dont % mouvements, sur % mois.',
    n_tx, n_mvt, n_mois;
end
$seed$;
