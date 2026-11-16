-- Ticket #24 — Contrôle d'appartenance pour soldes.compte_id et transactions.categorie_id
-- Une clé étrangère ne passe pas par la RLS : sans contrôle, un utilisateur connaissant l'id
-- d'un compte ou d'une catégorie d'un autre utilisateur pourrait y rattacher un relevé ou une
-- opération. Même mécanique que transactions_verifier_comptes (#3) : trigger `before`,
-- security invoker, search_path vide, noms qualifiés, erreur 23503 avec un message en français.
--
-- Choix : deux fonctions SÉPARÉES, transactions_verifier_comptes (#3) n'est pas modifiée.
--   - soldes est une autre table : il lui faut de toute façon sa propre fonction ;
--   - transactions_verifier_comptes sera réécrite par #86 (retrait de compte_dest_id) :
--     ne pas la toucher ici évite que les deux tickets modifient la même fonction ;
--   - chaque trigger ne se déclenche que sur ses colonnes (`update of …`) : modifier
--     l'épingle ou le Tricount d'une opération ne déclenche aucun des deux contrôles.
--
-- Compatible avec l'interface actuelle : aucune colonne ajoutée, modifiée ni supprimée ;
-- seules les écritures qui visent l'objet d'un autre utilisateur sont refusées.
-- Aucune donnée transformée : la migration échoue si une ligne existante viole déjà la règle.

-- 1. Garde-fou : aucune ligne existante ne rattache un objet d'un autre utilisateur
do $$
declare
  n_soldes int;
  n_tx     int;
begin
  select count(*) into n_soldes
  from public.soldes s
  join public.comptes c on c.id = s.compte_id
  where c.user_id <> s.user_id;

  select count(*) into n_tx
  from public.transactions t
  join public.categories c on c.id = t.categorie_id
  where c.user_id <> t.user_id;

  if n_soldes > 0 or n_tx > 0 then
    raise exception 'Migration #24 interrompue : % relevé(s) et % opération(s) sont rattachés au compte ou à la catégorie d''un autre utilisateur. Corrigez-les avant d''appliquer cette migration.', n_soldes, n_tx;
  end if;
end;
$$;

-- 2. soldes : le compte du relevé appartient à l'utilisateur du relevé
-- security invoker : lecture de public.comptes avec les droits de l'appelant ; sous RLS il ne
-- voit que ses comptes, ce qui suffit au contrôle. Le trigger `before insert` passe avant la
-- détection du conflit : un upsert (compte_id, date) sur le compte d'un autre est refusé aussi.
create function public.soldes_verifier_compte()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.comptes c
    where c.id = new.compte_id and c.user_id = new.user_id
  ) then
    raise exception 'Le compte de ce relevé n''existe pas ou appartient à un autre utilisateur.'
      using errcode = '23503';
  end if;

  return new;
end;
$$;

create trigger soldes_verifier_compte
  before insert or update of compte_id, user_id
  on public.soldes
  for each row
  execute function public.soldes_verifier_compte();

-- 3. transactions : la catégorie de l'opération appartient à l'utilisateur de l'opération
-- Catégorie facultative : contrôlée seulement si elle est renseignée. La suppression d'une
-- catégorie (FK `on delete set null`) remet categorie_id à null : le contrôle laisse passer.
create function public.transactions_verifier_categorie()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.categorie_id is not null and not exists (
    select 1 from public.categories c
    where c.id = new.categorie_id and c.user_id = new.user_id
  ) then
    raise exception 'La catégorie de cette opération n''existe pas ou appartient à un autre utilisateur.'
      using errcode = '23503';
  end if;

  return new;
end;
$$;

create trigger transactions_verifier_categorie
  before insert or update of categorie_id, user_id
  on public.transactions
  for each row
  execute function public.transactions_verifier_categorie();
