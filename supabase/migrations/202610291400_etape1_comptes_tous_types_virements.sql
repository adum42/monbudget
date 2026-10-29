-- Ticket #3 — Comptes de tous types, solde initial et virements
-- Décision #2 (option A) : un virement = une transaction `mouvement`
--   compte_id = compte source, compte_dest_id = compte destination.
-- Décisions du chef de projet (29/10/2026, suite #3) :
--   - suppression d'un compte qui porte des opérations : refusée (on delete restrict) ;
--   - une transaction ne peut référencer que des comptes du même utilisateur (trigger) ;
--   - transactions.montant en numeric(12,2) et strictement positif ;
--   - solde_initial peut être négatif (compte à découvert) ;
--   - aucune contrainte sur le type du compte par défaut ; type par défaut 'courant'.
-- Compatible avec l'interface actuelle : uniquement des colonnes nullable
-- ou avec valeur par défaut ; `direction` n'est utilisée nulle part dans index.html.
-- Aucune donnée transformée : backup_v1 est identique aux tables actuelles (vérifié le 29/10/2026).
-- Vérifié en lecture avant écriture : 0 transaction avec montant <= 0 ou null.

-- 1. comptes.type : tous les types de comptes, 'courant' par défaut
alter table public.comptes drop constraint comptes_type_check;
alter table public.comptes add constraint comptes_type_check
  check (type in ('courant', 'livret', 'investissement', 'especes'));
alter table public.comptes alter column type set default 'courant';

-- 2. comptes : solde initial, compte par défaut, plafond réglementaire
alter table public.comptes
  add column solde_initial      numeric(12,2) not null default 0,
  add column date_solde_initial date,
  add column par_defaut         boolean       not null default false,
  add column plafond            numeric(12,2);

-- Exception assumée à la règle « montants toujours positifs » :
-- solde_initial est un solde, pas un flux ; il peut être négatif (compte courant à découvert).
-- Pas de check de signe sur cette colonne.
comment on column public.comptes.solde_initial is
  'Solde du compte à date_solde_initial. Peut être négatif (compte à découvert) : exception à la règle des montants positifs.';

alter table public.comptes add constraint comptes_plafond_check
  check (plafond is null or plafond > 0);

-- Un seul compte par défaut par utilisateur (quel que soit son type)
create unique index comptes_un_par_defaut_par_user
  on public.comptes (user_id)
  where par_defaut;

-- 3. transactions : montants en numeric(12,2), strictement positifs
alter table public.transactions alter column montant type numeric(12,2);
alter table public.transactions add constraint transactions_montant_check
  check (montant > 0);

-- 4. transactions : on ne supprime pas un compte qui porte des opérations
-- (ancienne FK : on delete set null). soldes.compte_id reste en cascade.
alter table public.transactions drop constraint transactions_compte_id_fkey;
alter table public.transactions add constraint transactions_compte_id_fkey
  foreign key (compte_id) references public.comptes (id) on delete restrict;

-- 5. transactions : compte destination d'un mouvement
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

-- 6. transactions : les comptes référencés appartiennent au même utilisateur
-- Une clé étrangère ne passe pas par la RLS : sans ce contrôle, un utilisateur
-- connaissant l'id d'un compte d'un autre utilisateur pourrait y rattacher une opération.
-- security invoker (défaut) : la fonction lit public.comptes avec les droits de l'appelant ;
-- sous RLS il ne voit que ses comptes, ce qui suffit au contrôle. Aucun privilège
-- élevé, donc rien à révoquer ; une fonction `returns trigger` n'est pas appelable via l'API.
create function public.transactions_verifier_comptes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.compte_id is not null and not exists (
    select 1 from public.comptes c
    where c.id = new.compte_id and c.user_id = new.user_id
  ) then
    raise exception 'Le compte de cette opération n''existe pas ou appartient à un autre utilisateur.'
      using errcode = '23503';
  end if;

  if new.compte_dest_id is not null and not exists (
    select 1 from public.comptes c
    where c.id = new.compte_dest_id and c.user_id = new.user_id
  ) then
    raise exception 'Le compte de destination de ce virement n''existe pas ou appartient à un autre utilisateur.'
      using errcode = '23503';
  end if;

  return new;
end;
$$;

create trigger transactions_verifier_comptes
  before insert or update of compte_id, compte_dest_id, user_id
  on public.transactions
  for each row
  execute function public.transactions_verifier_comptes();

-- 7. transactions : suppression de `direction` (abandonnée en #2, 0 valeur non nulle)
-- La contrainte transactions_direction_check est supprimée avec la colonne.
alter table public.transactions drop column direction;
