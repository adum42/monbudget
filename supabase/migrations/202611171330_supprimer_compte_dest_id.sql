-- Ticket #86 — Suppression de transactions.compte_dest_id (colonne, FK, index, trigger, contrainte)
-- Suite de #68 : la colonne avait été conservée et forcée à null (transactions_compte_dest_id_vide_check)
-- parce que le front l'envoyait encore. Depuis #69 (en prod le 16/11/2026), le front ne l'envoie
-- ni ne la lit plus : elle n'a plus de raison d'exister.
--
-- Ce que fait la migration :
--   1. garde-fou : échec si une transaction a encore compte_dest_id renseignée (aucune perte silencieuse) ;
--   2. trigger transactions_verifier_comptes : fonction réécrite sans le bloc compte_dest_id,
--      trigger recréé en `before insert or update of compte_id, user_id` (l'ancienne définition
--      `update of compte_id, compte_dest_id, user_id` dépend de la colonne et en bloque la suppression) ;
--   3. suppression de la contrainte transactions_compte_dest_id_vide_check, de l'index
--      transactions_compte_dest_id_idx, de la FK transactions_compte_dest_id_fkey, puis de la colonne.
--
-- Inchangés : v_soldes_comptes (ne lit plus compte_dest_id depuis #68), RLS, transactions_verifier_categorie (#24).
-- Compatible avec l'interface actuelle : le front n'envoie plus compte_dest_id depuis #69.

-- 1. Garde-fou
do $$
declare
  n_dest int;
begin
  select count(*) into n_dest from public.transactions where compte_dest_id is not null;
  if n_dest > 0 then
    raise exception 'Migration #86 interrompue : % transaction(s) ont encore compte_dest_id renseignée. Rien n''a été supprimé ; vérifiez ces lignes avant d''appliquer cette migration.', n_dest;
  end if;
end;
$$;

-- 2. Trigger d'appartenance des comptes, sans compte_dest_id
-- Le trigger est supprimé d'abord : sa liste de colonnes (`update of … compte_dest_id …`) dépend de la colonne.
drop trigger transactions_verifier_comptes on public.transactions;

-- Mêmes conventions que #3 : security invoker (lecture de public.comptes sous la RLS de l'appelant),
-- search_path vide, noms qualifiés, erreur 23503 en français.
create or replace function public.transactions_verifier_comptes()
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

  return new;
end;
$$;

create trigger transactions_verifier_comptes
  before insert or update of compte_id, user_id
  on public.transactions
  for each row
  execute function public.transactions_verifier_comptes();

-- 3. Contrainte, index, clé étrangère, puis colonne
alter table public.transactions drop constraint transactions_compte_dest_id_vide_check;
drop index public.transactions_compte_dest_id_idx;
alter table public.transactions drop constraint transactions_compte_dest_id_fkey;
alter table public.transactions drop column compte_dest_id;
