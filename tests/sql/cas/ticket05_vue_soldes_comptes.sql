-- Tests du ticket #5 : vue v_soldes_comptes (solde calculé vs solde banque).
-- Base de départ : socle + données fictives + toutes les migrations.
-- Chaque appel qa.cas(cas, rôle, utilisateur, requête, attendu) : voir tests/sql/socle/20_harnais.sql.
--
-- Utilisateurs : A = aaaaaaaa-…-01, B = bbbbbbbb-…-02 (voir tests/sql/socle/10_donnees.sql).
-- Comptes du socle : 10…0a Livret A, 20…0a Livret DD, 30…0a Bitcoin (A, sans date_solde_initial) ;
--                    40…0b Livret B (B). Les 58 transactions du socle n'ont pas de compte.
-- Comptes créés ici (A) : e1… « Courant #5 » (solde initial 100 au 01/10/2026),
--                         e2… « Livret #5 » (solde initial 0 au 01/10/2026),
--                         e3… « Bornes #5 » (cas limites de dates, solde initial -250 au 01/10/2026).
-- Attention : les cas qui réussissent modifient la base pour les cas suivants (l'ordre compte).

\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set B '''bbbbbbbb-0000-0000-0000-000000000002'''

-- ───────── Structure ─────────
select qa.cas('La vue existe et est en security_invoker', 'postgres', null,
  $q$do $x$ begin
     if not exists (select 1 from pg_class where oid = 'public.v_soldes_comptes'::regclass
                    and relkind = 'v' and 'security_invoker=on' = any(reloptions))
       then raise exception 'vue absente ou sans security_invoker'; end if; end $x$ $q$);
select qa.cas('Colonnes attendues présentes', 'postgres', null,
  $q$do $x$ declare manquantes text; begin
     select string_agg(c, ',') into manquantes
     from unnest(array['compte_id','user_id','nom','type','solde_initial','date_solde_initial','solde_calcule',
                       'dernier_solde_banque','date_dernier_solde_banque','solde_calcule_a_date_banque','ecart',
                       'nb_jours_depuis_releve']) c
     where not exists (select 1 from information_schema.columns
                       where table_schema='public' and table_name='v_soldes_comptes' and column_name=c);
     if manquantes is not null then raise exception 'colonnes manquantes : %', manquantes; end if; end $x$ $q$);

-- ───────── Préparation : jeu d'exemple du critère 1 ─────────
select qa.cas('Préparation : comptes Courant #5 (100 au 01/10) et Livret #5 (0 au 01/10)', 'authenticated', :A,
  $q$insert into public.comptes (id,user_id,nom,type,solde_initial,date_solde_initial) values
     ('e1000000-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001','Courant #5','courant',100,'2026-10-01'),
     ('e2000000-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001','Livret #5','livret',0,'2026-10-01')$q$);
select qa.cas('Préparation : +50, −30, mouvement de 20 vers le livret', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id,compte_dest_id) values
     ('aaaaaaaa-0000-0000-0000-000000000001','#5 entrée',50,'entrée','2026-10-02','e1000000-0000-0000-0000-00000000000a',null),
     ('aaaaaaaa-0000-0000-0000-000000000001','#5 sortie',30,'sortie','2026-10-05','e1000000-0000-0000-0000-00000000000a',null),
     ('aaaaaaaa-0000-0000-0000-000000000001','#5 virement',20,'mouvement','2026-10-10','e1000000-0000-0000-0000-00000000000a','e2000000-0000-0000-0000-00000000000a')$q$);

-- ───────── Critères d'acceptation du ticket ─────────
select qa.cas('CA1 compte source : solde calculé = 100', 'authenticated', :A,
  $q$do $x$ declare v numeric; begin
     select solde_calcule into v from public.v_soldes_comptes where compte_id='e1000000-0000-0000-0000-00000000000a';
     if v is distinct from 100 then raise exception 'solde_calcule = %', v; end if; end $x$ $q$);
select qa.cas('CA1 livret destination : solde calculé = +20', 'authenticated', :A,
  $q$do $x$ declare v numeric; begin
     select solde_calcule into v from public.v_soldes_comptes where compte_id='e2000000-0000-0000-0000-00000000000a';
     if v is distinct from 20 then raise exception 'solde_calcule = %', v; end if; end $x$ $q$);
select qa.cas('CA2 A ne voit que ses comptes (5 lignes, aucune de B)', 'authenticated', :A,
  $q$do $x$ declare n int; m int; begin
     select count(*), count(*) filter (where user_id <> 'aaaaaaaa-0000-0000-0000-000000000001') into n, m from public.v_soldes_comptes;
     if n <> 5 or m <> 0 then raise exception '% lignes dont % d''un autre utilisateur', n, m; end if; end $x$ $q$);
select qa.cas('CA2 A ne lit pas le compte de B, même en le visant', 'authenticated', :A,
  $q$do $x$ begin
     if exists (select 1 from public.v_soldes_comptes where compte_id='40000000-0000-0000-0000-00000000000b')
       then raise exception 'compte de B visible'; end if; end $x$ $q$);
select qa.cas('CA2 B ne voit que son compte (1 ligne)', 'authenticated', :B,
  $q$do $x$ declare n int; begin
     select count(*) into n from public.v_soldes_comptes;
     if n <> 1 or not exists (select 1 from public.v_soldes_comptes where compte_id='40000000-0000-0000-0000-00000000000b')
       then raise exception '% lignes', n; end if; end $x$ $q$);
select qa.cas('CA2 anon : 0 ligne', 'anon', null,
  $q$do $x$ begin if (select count(*) from public.v_soldes_comptes) <> 0 then raise exception 'fuite'; end if; end $x$ $q$);
select qa.cas('CA3 compte sans solde banque : écart null (pas 0), solde banque, date et jours null', 'authenticated', :A,
  $q$do $x$ declare r record; begin
     select * into r from public.v_soldes_comptes where compte_id='e1000000-0000-0000-0000-00000000000a';
     if r.ecart is not null or r.dernier_solde_banque is not null or r.date_dernier_solde_banque is not null
        or r.solde_calcule_a_date_banque is not null or r.nb_jours_depuis_releve is not null
       then raise exception 'ecart=% banque=% date=% a_date=% jours=%', r.ecart, r.dernier_solde_banque,
            r.date_dernier_solde_banque, r.solde_calcule_a_date_banque, r.nb_jours_depuis_releve; end if; end $x$ $q$);

-- ───────── Solde banque et écart ─────────
select qa.cas('Préparation : soldes banque du Courant #5 (999 au 03/10, 95 au 15/10)', 'authenticated', :A,
  $q$insert into public.soldes (user_id,compte_id,date,montant) values
     ('aaaaaaaa-0000-0000-0000-000000000001','e1000000-0000-0000-0000-00000000000a','2026-10-03',999),
     ('aaaaaaaa-0000-0000-0000-000000000001','e1000000-0000-0000-0000-00000000000a','2026-10-15',95)$q$);
select qa.cas('Préparation : sortie de 10 le 20/10 (après le dernier relevé)', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id) values
     ('aaaaaaaa-0000-0000-0000-000000000001','#5 après relevé',10,'sortie','2026-10-20','e1000000-0000-0000-0000-00000000000a')$q$);
select qa.cas('Dernier solde banque = le plus récent (95 au 15/10)', 'authenticated', :A,
  $q$do $x$ declare r record; begin
     select * into r from public.v_soldes_comptes where compte_id='e1000000-0000-0000-0000-00000000000a';
     if r.dernier_solde_banque is distinct from 95 or r.date_dernier_solde_banque is distinct from date '2026-10-15'
       then raise exception 'banque=% au %', r.dernier_solde_banque, r.date_dernier_solde_banque; end if; end $x$ $q$);
select qa.cas('Solde calculé = 90 ; arrêté au 15/10 = 100 ; écart = 95 − 100 = −5', 'authenticated', :A,
  $q$do $x$ declare r record; begin
     select * into r from public.v_soldes_comptes where compte_id='e1000000-0000-0000-0000-00000000000a';
     if r.solde_calcule is distinct from 90 or r.solde_calcule_a_date_banque is distinct from 100 or r.ecart is distinct from -5
       then raise exception 'calcule=% a_date=% ecart=%', r.solde_calcule, r.solde_calcule_a_date_banque, r.ecart; end if; end $x$ $q$);
select qa.cas('Transaction du jour du relevé incluse dans le calcul à date banque', 'authenticated', :A,
  $q$do $x$ declare r record; begin
     insert into public.transactions (user_id,description,montant,type,date,compte_id) values
       ('aaaaaaaa-0000-0000-0000-000000000001','#5 jour du relevé',5,'entrée','2026-10-15','e1000000-0000-0000-0000-00000000000a');
     select * into r from public.v_soldes_comptes where compte_id='e1000000-0000-0000-0000-00000000000a';
     if r.solde_calcule_a_date_banque is distinct from 105 or r.ecart is distinct from -10 or r.solde_calcule is distinct from 95
       then raise exception 'a_date=% ecart=% calcule=%', r.solde_calcule_a_date_banque, r.ecart, r.solde_calcule; end if; end $x$ $q$);
select qa.cas('Écart nul quand banque = calcul (Livret #5 : relevé 20 au 31/10)', 'authenticated', :A,
  $q$do $x$ declare r record; begin
     insert into public.soldes (user_id,compte_id,date,montant) values
       ('aaaaaaaa-0000-0000-0000-000000000001','e2000000-0000-0000-0000-00000000000a','2026-10-31',20);
     select * into r from public.v_soldes_comptes where compte_id='e2000000-0000-0000-0000-00000000000a';
     if r.ecart is distinct from 0 then raise exception 'ecart=%', r.ecart; end if; end $x$ $q$);
select qa.cas('nb_jours_depuis_releve = aujourd''hui − date du relevé', 'authenticated', :A,
  $q$do $x$ declare r record; begin
     select * into r from public.v_soldes_comptes where compte_id='e1000000-0000-0000-0000-00000000000a';
     if r.nb_jours_depuis_releve is distinct from (current_date - date '2026-10-15')
       then raise exception 'jours=%', r.nb_jours_depuis_releve; end if; end $x$ $q$);

-- ───────── Bornes de dates (compte Bornes #5, solde initial −250 au 01/10) ─────────
select qa.cas('Préparation : compte Bornes #5 à découvert (−250 au 01/10)', 'authenticated', :A,
  $q$insert into public.comptes (id,user_id,nom,type,solde_initial,date_solde_initial) values
     ('e3000000-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001','Bornes #5','courant',-250,'2026-10-01')$q$);
select qa.cas('Préparation : sortie de 40 le 30/09 (avant le solde initial) et entrée de 7 le 01/10', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id) values
     ('aaaaaaaa-0000-0000-0000-000000000001','#5 avant solde initial',40,'sortie','2026-09-30','e3000000-0000-0000-0000-00000000000a'),
     ('aaaaaaaa-0000-0000-0000-000000000001','#5 jour du solde initial',7,'entrée','2026-10-01','e3000000-0000-0000-0000-00000000000a')$q$);
select qa.cas('Avant date_solde_initial ignorée, jour même comptée : −250 + 7 = −243', 'authenticated', :A,
  $q$do $x$ declare v numeric; begin
     select solde_calcule into v from public.v_soldes_comptes where compte_id='e3000000-0000-0000-0000-00000000000a';
     if v is distinct from -243 then raise exception 'solde_calcule = %', v; end if; end $x$ $q$);
select qa.cas('Relevé antérieur au solde initial : calcul à date banque et écart null', 'authenticated', :A,
  $q$do $x$ declare r record; begin
     insert into public.soldes (user_id,compte_id,date,montant) values
       ('aaaaaaaa-0000-0000-0000-000000000001','e3000000-0000-0000-0000-00000000000a','2026-09-15',-300);
     select * into r from public.v_soldes_comptes where compte_id='e3000000-0000-0000-0000-00000000000a';
     if r.dernier_solde_banque is distinct from -300 or r.solde_calcule_a_date_banque is not null or r.ecart is not null
       then raise exception 'banque=% a_date=% ecart=%', r.dernier_solde_banque, r.solde_calcule_a_date_banque, r.ecart; end if; end $x$ $q$);
select qa.cas('Relevé le jour du solde initial : comparé (−250 + 7 = −243, écart 0)', 'authenticated', :A,
  $q$do $x$ declare r record; begin
     insert into public.soldes (user_id,compte_id,date,montant) values
       ('aaaaaaaa-0000-0000-0000-000000000001','e3000000-0000-0000-0000-00000000000a','2026-10-01',-243);
     select * into r from public.v_soldes_comptes where compte_id='e3000000-0000-0000-0000-00000000000a';
     if r.solde_calcule_a_date_banque is distinct from -243 or r.ecart is distinct from 0
       then raise exception 'a_date=% ecart=%', r.solde_calcule_a_date_banque, r.ecart; end if; end $x$ $q$);
select qa.cas('Sans date_solde_initial : toutes les transactions comptent (Livret A, 0 + 12 en 2020)', 'authenticated', :A,
  $q$do $x$ declare v numeric; begin
     insert into public.transactions (user_id,description,montant,type,date,compte_id) values
       ('aaaaaaaa-0000-0000-0000-000000000001','#5 ancienne',12,'entrée','2020-01-01','10000000-0000-0000-0000-00000000000a');
     select solde_calcule into v from public.v_soldes_comptes where compte_id='10000000-0000-0000-0000-00000000000a';
     if v is distinct from 12 then raise exception 'solde_calcule = %', v; end if; end $x$ $q$);

-- ───────── Mouvements ─────────
select qa.cas('Mouvement modifié (20 → 25) : source et destination suivent', 'authenticated', :A,
  $q$do $x$ declare s numeric; d numeric; begin
     update public.transactions set montant = 25 where description = '#5 virement';
     select solde_calcule into s from public.v_soldes_comptes where compte_id='e1000000-0000-0000-0000-00000000000a';
     select solde_calcule into d from public.v_soldes_comptes where compte_id='e2000000-0000-0000-0000-00000000000a';
     if s is distinct from 90 or d is distinct from 25 then raise exception 'source=% dest=%', s, d; end if; end $x$ $q$);
select qa.cas('Somme des soldes calculés inchangée par un virement interne', 'authenticated', :A,
  $q$do $x$ declare avant numeric; apres numeric; begin
     select sum(solde_calcule) into avant from public.v_soldes_comptes;
     insert into public.transactions (user_id,description,montant,type,date,compte_id,compte_dest_id) values
       ('aaaaaaaa-0000-0000-0000-000000000001','#5 virement 2',33.33,'mouvement','2026-10-25','e2000000-0000-0000-0000-00000000000a','e1000000-0000-0000-0000-00000000000a');
     select sum(solde_calcule) into apres from public.v_soldes_comptes;
     if avant is distinct from apres then raise exception 'avant=% après=%', avant, apres; end if; end $x$ $q$);
select qa.cas('Transactions sans compte (socle) : aucun effet sur les soldes', 'authenticated', :A,
  $q$do $x$ declare v numeric; begin
     select solde_calcule into v from public.v_soldes_comptes where compte_id='20000000-0000-0000-0000-00000000000a';
     if v is distinct from 0 then raise exception 'Livret DD = %', v; end if; end $x$ $q$);

-- ───────── Sécurité et lecture seule ─────────
select qa.cas('service_role : solde posé par A sur le compte de B (ÉCART #24) ignoré', 'service_role', null,
  $q$do $x$ declare r record; begin
     insert into public.soldes (user_id,compte_id,date,montant) values
       ('aaaaaaaa-0000-0000-0000-000000000001','40000000-0000-0000-0000-00000000000b','2026-12-31',123456);
     select * into r from public.v_soldes_comptes where compte_id='40000000-0000-0000-0000-00000000000b';
     if r.dernier_solde_banque is distinct from 10 then raise exception 'banque de B = %', r.dernier_solde_banque; end if; end $x$ $q$);
select qa.cas('Écriture dans la vue refusée', 'authenticated', :A,
  $q$insert into public.v_soldes_comptes (compte_id, nom) values (gen_random_uuid(), 'x')$q$, '55000');
select qa.cas('Montants sérialisés en nombres JSON (PostgREST)', 'authenticated', :A,
  $q$do $x$ begin
     if (select json_typeof(to_json(solde_calcule)) from public.v_soldes_comptes limit 1) <> 'number'
       then raise exception 'pas un nombre'; end if; end $x$ $q$);
