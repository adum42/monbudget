-- Ticket #3 — Comptes de tous types, solde initial et virements
-- Décision #2 (option A) : un virement = une transaction `mouvement`
--   compte_id = compte source, compte_dest_id = compte destination.
-- Compatible avec l'interface actuelle : uniquement des colonnes nullable
-- ou avec valeur par défaut ; `direction` n'est utilisée nulle part dans index.html.
-- Aucune donnée transformée : backup_v1 est identique aux tables actuelles (vérifié le 29/10/2026).

-- 1. comptes.type : tous les types de comptes
alter table public.comptes drop constraint comptes_type_check;
alter table public.comptes add constraint comptes_type_check
  check (type in ('courant', 'livret', 'investissement', 'especes'));

-- 2. comptes : solde initial, compte par défaut, plafond réglementaire
alter table public.comptes
  add column solde_initial      numeric(12,2) not null default 0,
  add column date_solde_initial date,
  add column par_defaut         boolean       not null default false,
  add column plafond            numeric(12,2);

alter table public.comptes add constraint comptes_plafond_check
  check (plafond is null or plafond > 0);

-- Un seul compte par défaut par utilisateur
create unique index comptes_un_par_defaut_par_user
  on public.comptes (user_id)
  where par_defaut;

-- 3. transactions : compte destination d'un mouvement
-- on delete restrict : supprimer un compte qui est la destination d'un virement est refusé
-- (un `set null` violerait de toute façon la contrainte ci-dessous).
alter table public.transactions
  add column compte_dest_id uuid references public.comptes (id) on delete restrict;

-- Un mouvement a deux comptes renseignés et différents ;
-- une entrée / sortie n'a pas de compte destination.
alter table public.transactions add constraint transactions_mouvement_comptes_check
  check (
    (type =  'mouvement' and compte_id is not null and compte_dest_id is not null and compte_id <> compte_dest_id)
    or
    (type <> 'mouvement' and compte_dest_id is null)
  );

create index transactions_compte_id_idx      on public.transactions (compte_id);
create index transactions_compte_dest_id_idx on public.transactions (compte_dest_id);

-- 4. transactions : suppression de `direction` (abandonnée en #2, 0 valeur non nulle)
-- La contrainte transactions_direction_check est supprimée avec la colonne.
alter table public.transactions drop column direction;
