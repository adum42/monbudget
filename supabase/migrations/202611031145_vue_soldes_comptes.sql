-- Ticket #5 — Vue v_soldes_comptes : solde calculé vs solde banque
-- Une ligne par compte de l'utilisateur connecté.
--
-- Définitions (glossaire de docs/PROJET.md) :
--   - solde calculé = solde_initial + entrées − sorties − mouvements sortants + mouvements entrants,
--     pour les transactions datées >= date_solde_initial (toutes si date_solde_initial est vide) ;
--   - solde banque  = dernière ligne de `soldes` du compte (date la plus récente) ;
--   - écart         = solde banque − solde calculé arrêté à la date de ce solde banque (inclus).
--
-- Choix d'implémentation (à confirmer par Corentin, voir le commentaire du ticket) :
--   - une transaction datée du jour même de date_solde_initial est comptée (règle « >= » du ticket) ;
--   - si le dernier solde banque est antérieur à date_solde_initial, la comparaison n'a pas de sens :
--     solde_calcule_a_date_banque et ecart valent null ;
--   - nb_jours_depuis_releve est calculé avec current_date du serveur (UTC).
--
-- RLS : security_invoker = on, la vue applique les politiques des tables sous-jacentes
-- avec les droits de l'utilisateur qui l'interroge. On ne lit que les soldes du même
-- utilisateur que le compte (soldes.compte_id n'a pas de contrôle d'appartenance, #24).
-- Aucune table modifiée : migration compatible avec l'interface actuelle.

create view public.v_soldes_comptes
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
    sum(x.delta)                            as total,
    sum(x.delta) filter (where x.date <= b.date) as a_date_banque
  from (
    -- Le compte est la source : entrée +, sortie −, mouvement sortant −
    select t.date,
           case when t.type = 'entrée' then t.montant else -t.montant end as delta
    from public.transactions t
    where t.compte_id = c.id
    union all
    -- Le compte est la destination d'un mouvement : +
    select t.date, t.montant
    from public.transactions t
    where t.compte_dest_id = c.id
      and t.type = 'mouvement'
  ) x
  where x.date >= coalesce(c.date_solde_initial, '-infinity'::date)
) f on true;

comment on view public.v_soldes_comptes is
  'Une ligne par compte : solde calculé (solde initial + transactions depuis date_solde_initial, mouvements compris), dernier solde banque saisi, solde calculé à la date de ce solde banque et écart (banque − calculé). security_invoker : soumis à la RLS de l''utilisateur. Ticket #5.';
