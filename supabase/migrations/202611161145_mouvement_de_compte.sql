-- Ticket #68 — Catégorie « Mouvement de compte » et retrait du type mouvement
-- Décision du chef de projet du 05/11/2026 : le type `mouvement` est abandonné.
-- Un virement interne = une sortie sur le compte de départ + une entrée sur le compte
-- d'arrivée, dans la catégorie cochée « Mouvement de compte » (une seule par utilisateur),
-- exclue des statistiques par le front (#69). Remplace #2 (option A) et #6.
--
-- Décision du chef de projet du 16/11/2026 (session #68) : la colonne
-- transactions.compte_dest_id est CONSERVÉE pour l'instant, forcée à null.
-- Raison : l'interface actuelle envoie `compte_dest_id: null` à chaque enregistrement ;
-- la supprimer casserait la saisie en prod jusqu'au merge de #69. Elle sera supprimée
-- (avec sa FK, son index et sa mention dans le trigger) par un ticket de suivi, une fois
-- #69 en prod.
--
-- Compatible avec l'interface actuelle : nouvelle colonne avec valeur par défaut,
-- aucune colonne supprimée, vue v_soldes_comptes avec les mêmes colonnes.
-- Aucune conversion de données : la migration échoue si un mouvement existe encore.

-- 1. Garde-fous : aucune transformation automatique de données
do $$
declare
  n_mvt int;
  n_doublons int;
begin
  select count(*) into n_mvt from public.transactions where type = 'mouvement';
  if n_mvt > 0 then
    raise exception 'Migration #68 interrompue : % transaction(s) de type « mouvement » existent encore. Supprimez-les ou ressaisissez-les en une sortie + une entrée avant d''appliquer cette migration.', n_mvt;
  end if;

  select count(*) into n_doublons
  from (
    select user_id from public.categories
    where lower(btrim(nom)) = 'virement interne'
    group by user_id having count(*) > 1
  ) d;
  if n_doublons > 0 then
    raise exception 'Migration #68 interrompue : % utilisateur(s) ont plusieurs catégories « Virement interne ». Fusionnez-les avant d''appliquer cette migration.', n_doublons;
  end if;
end;
$$;

-- 2. categories : drapeau « Mouvement de compte », au plus une catégorie cochée par utilisateur
alter table public.categories
  add column mouvement_compte boolean not null default false;

comment on column public.categories.mouvement_compte is
  'Catégorie « Mouvement de compte » (virements internes) : ses opérations comptent dans les soldes mais sont exclues des statistiques. Au plus une par utilisateur. Ticket #68.';

create unique index categories_un_mouvement_compte_par_user
  on public.categories (user_id)
  where mouvement_compte;

-- « Virement interne » (nom comparé sans casse ni espaces autour) devient la catégorie
-- « Mouvement de compte », de type `les deux` (elle porte des sorties et des entrées).
update public.categories
set mouvement_compte = true,
    type = 'les deux'
where lower(btrim(nom)) = 'virement interne';

-- 3. transactions : plus de type `mouvement`
alter table public.transactions drop constraint transactions_mouvement_comptes_check;
alter table public.transactions drop constraint transactions_type_check;
alter table public.transactions add constraint transactions_type_check
  check (type in ('entrée', 'sortie'));

-- compte_dest_id conservée mais toujours vide (voir l'en-tête)
alter table public.transactions add constraint transactions_compte_dest_id_vide_check
  check (compte_dest_id is null);

comment on column public.transactions.compte_dest_id is
  'Obsolète depuis #68 (abandon du type mouvement) : toujours null, sera supprimée après #69.';

-- 4. v_soldes_comptes : solde calculé = solde initial + entrées − sorties
-- Mêmes colonnes, même ordre : `create or replace` conserve les droits ; security_invoker reste activé.
create or replace view public.v_soldes_comptes
with (security_invoker = on)
as
select
  c.id                 as compte_id,
  c.user_id,
  c.nom,
  c.type,
  c.solde_initial,
  c.date_solde_initial,
  c.solde_initial + coalesce(f.total, 0)                     as solde_calcule,
  b.montant                                                  as dernier_solde_banque,
  b.date                                                     as date_dernier_solde_banque,
  case when b.date >= coalesce(c.date_solde_initial, '-infinity'::date)
       then c.solde_initial + coalesce(f.a_date_banque, 0) end as solde_calcule_a_date_banque,
  case when b.date >= coalesce(c.date_solde_initial, '-infinity'::date)
       then b.montant - (c.solde_initial + coalesce(f.a_date_banque, 0)) end as ecart,
  current_date - b.date                                      as nb_jours_depuis_releve
from public.comptes c
-- Dernier solde banque du compte (index unique soldes (compte_id, date))
left join lateral (
  select s.date, s.montant
  from public.soldes s
  where s.compte_id = c.id
    and s.user_id = c.user_id
  order by s.date desc
  limit 1
) b on true
-- Flux du compte depuis date_solde_initial : total, et total arrêté à la date du solde banque
left join lateral (
  select
    sum(case when t.type = 'entrée' then t.montant else -t.montant end) as total,
    sum(case when t.type = 'entrée' then t.montant else -t.montant end)
      filter (where t.date <= b.date)                                   as a_date_banque
  from public.transactions t
  where t.compte_id = c.id
    and t.date >= coalesce(c.date_solde_initial, '-infinity'::date)
) f on true;

comment on view public.v_soldes_comptes is
  'Une ligne par compte : solde calculé (solde initial + entrées − sorties depuis date_solde_initial), dernier solde banque saisi, solde calculé à la date de ce solde banque et écart (banque − calculé). security_invoker : soumis à la RLS de l''utilisateur. Tickets #5 et #68.';
