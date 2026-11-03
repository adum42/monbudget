-- Tests du ticket #3 : comptes de tous types, solde initial, virements, montants positifs,
-- appartenance des comptes, RLS. Base de départ : socle + données fictives + toutes les migrations.
-- Chaque appel qa.cas(cas, rôle, utilisateur, requête, attendu) : voir tests/sql/socle/20_harnais.sql.
--
-- Utilisateurs : A = aaaaaaaa-…-01 (comptes 10…0a Livret A, 20…0a Livret DD, 30…0a Bitcoin),
--                B = bbbbbbbb-…-02 (compte 40…0b Livret B).
-- Attention : les cas qui réussissent modifient la base pour les cas suivants (l'ordre compte).

\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set B '''bbbbbbbb-0000-0000-0000-000000000002'''

-- ───────── Critères d'acceptation du ticket ─────────
select qa.cas('CA2 compte courant créé (authenticated)', 'authenticated', :A,
  $q$insert into public.comptes (user_id,nom,type) values ('aaaaaaaa-0000-0000-0000-000000000001','Compte courant','courant')$q$);
select qa.cas('CA2 type par défaut = courant', 'authenticated', :A,
  $q$do $x$ begin insert into public.comptes (user_id,nom) values ('aaaaaaaa-0000-0000-0000-000000000001','Sans type');
    if (select type from public.comptes where nom='Sans type') <> 'courant' then raise exception 'type par défaut faux'; end if; end $x$ $q$);
select qa.cas('Type especes accepté', 'authenticated', :A,
  $q$insert into public.comptes (user_id,nom,type) values ('aaaaaaaa-0000-0000-0000-000000000001','Portefeuille','especes')$q$);
select qa.cas('Type inconnu refusé', 'authenticated', :A,
  $q$insert into public.comptes (user_id,nom,type) values ('aaaaaaaa-0000-0000-0000-000000000001','X','pea')$q$, '23514');
select qa.cas('CA3 mouvement compte_id = compte_dest_id refusé', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id,compte_dest_id)
    values ('aaaaaaaa-0000-0000-0000-000000000001','virement',10,'mouvement','2026-10-01','10000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-00000000000a')$q$, '23514');
select qa.cas('CA4 colonne direction absente', 'postgres', null,
  $q$do $x$ begin if exists (select 1 from information_schema.columns where table_schema='public' and table_name='transactions' and column_name='direction')
    then raise exception 'direction existe'; end if; end $x$ $q$);

-- ───────── Mouvements ─────────
select qa.cas('Mouvement Livret A -> Livret DD accepté', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id,compte_dest_id)
    values ('aaaaaaaa-0000-0000-0000-000000000001','mvt-ok',100,'mouvement','2026-10-01','10000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-00000000000a')$q$);
select qa.cas('Mouvement sans compte_dest_id refusé', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id)
    values ('aaaaaaaa-0000-0000-0000-000000000001','x',10,'mouvement','2026-10-01','10000000-0000-0000-0000-00000000000a')$q$, '23514');
select qa.cas('Mouvement sans compte_id refusé', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_dest_id)
    values ('aaaaaaaa-0000-0000-0000-000000000001','x',10,'mouvement','2026-10-01','10000000-0000-0000-0000-00000000000a')$q$, '23514');
select qa.cas('Sortie avec compte_dest_id refusée', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id,compte_dest_id)
    values ('aaaaaaaa-0000-0000-0000-000000000001','x',10,'sortie','2026-10-01','10000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-00000000000a')$q$, '23514');
select qa.cas('Mouvement modifié en entrée, compte_dest_id restant : refusé', 'authenticated', :A,
  $q$update public.transactions set type='entrée' where description='mvt-ok'$q$, '23514');
select qa.cas('Mouvement modifié en entrée avec compte_dest_id=null : accepté', 'authenticated', :A,
  $q$update public.transactions set type='entrée', compte_dest_id=null where description='mvt-ok'$q$);

-- ───────── Appartenance des comptes (trigger transactions_verifier_comptes) ─────────
select qa.cas('A rattache une sortie au compte de B : refusé', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id)
    values ('aaaaaaaa-0000-0000-0000-000000000001','x',10,'sortie','2026-10-01','40000000-0000-0000-0000-00000000000b')$q$, '23503');
select qa.cas('A vire vers le compte de B : refusé', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id,compte_dest_id)
    values ('aaaaaaaa-0000-0000-0000-000000000001','x',10,'mouvement','2026-10-01','10000000-0000-0000-0000-00000000000a','40000000-0000-0000-0000-00000000000b')$q$, '23503');
select qa.cas('Compte inexistant : refusé (23503)', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id)
    values ('aaaaaaaa-0000-0000-0000-000000000001','x',10,'sortie','2026-10-01',gen_random_uuid())$q$, '23503');
select qa.cas('Update d''une tx sans compte -> compte de B : refusé', 'authenticated', :A,
  $q$update public.transactions set compte_id='40000000-0000-0000-0000-00000000000b' where description='tx 1'$q$, '23503');
select qa.cas('Update d''une tx sans compte -> son propre compte : accepté', 'authenticated', :A,
  $q$update public.transactions set compte_id='10000000-0000-0000-0000-00000000000a' where description='tx 2'$q$);
select qa.cas('Update user_id A -> B par A : refusé par la RLS', 'authenticated', :A,
  $q$update public.transactions set user_id='bbbbbbbb-0000-0000-0000-000000000002' where description='tx 3'$q$, '42501');
select qa.cas('Update user_id A -> B (service_role) avec compte de A : refusé par le trigger', 'service_role', null,
  $q$update public.transactions set user_id='bbbbbbbb-0000-0000-0000-000000000002' where description='tx 2'$q$, '23503');
select qa.cas('service_role : tx de A sur compte de B refusée (trigger hors RLS)', 'service_role', null,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id)
    values ('aaaaaaaa-0000-0000-0000-000000000001','x',10,'sortie','2026-10-01','40000000-0000-0000-0000-00000000000b')$q$, '23503');
select qa.cas('B insère une tx avec user_id = A sur un compte de A : refusé (trigger)', 'authenticated', :B,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id)
    values ('aaaaaaaa-0000-0000-0000-000000000001','x',10,'sortie','2026-10-01','10000000-0000-0000-0000-00000000000a')$q$, '23503');
select qa.cas('B insère une tx sans compte avec user_id = A : refusé (RLS)', 'authenticated', :B,
  $q$insert into public.transactions (user_id,description,montant,type,date)
    values ('aaaaaaaa-0000-0000-0000-000000000001','x',10,'sortie','2026-10-01')$q$, '42501');

-- ───────── Visiteur non connecté (anon) ─────────
select qa.cas('anon : insert tx sans compte refusé (RLS)', 'anon', null,
  $q$insert into public.transactions (user_id,description,montant,type,date)
    values ('aaaaaaaa-0000-0000-0000-000000000001','x',10,'sortie','2026-10-01')$q$, '42501');
select qa.cas('anon : insert tx avec compte de A refusé (trigger avant RLS : 23503)', 'anon', null,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id)
    values ('aaaaaaaa-0000-0000-0000-000000000001','x',10,'sortie','2026-10-01','10000000-0000-0000-0000-00000000000a')$q$, '23503');
select qa.cas('anon : insert compte refusé (RLS)', 'anon', null,
  $q$insert into public.comptes (user_id,nom) values ('aaaaaaaa-0000-0000-0000-000000000001','x')$q$, '42501');
select qa.cas('anon : select transactions = 0 ligne', 'anon', null,
  $q$do $x$ begin if (select count(*) from public.transactions) <> 0 then raise exception 'fuite'; end if; end $x$ $q$);

-- ───────── Montants ─────────
select qa.cas('Montant négatif refusé', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date) values ('aaaaaaaa-0000-0000-0000-000000000001','x',-12,'sortie','2026-10-01')$q$, '23514');
select qa.cas('Montant nul refusé', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date) values ('aaaaaaaa-0000-0000-0000-000000000001','x',0,'sortie','2026-10-01')$q$, '23514');
select qa.cas('Montant 0.004 (arrondi à 0.00) refusé', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date) values ('aaaaaaaa-0000-0000-0000-000000000001','x',0.004,'sortie','2026-10-01')$q$, '23514');
select qa.cas('Montant 0.005 (arrondi à 0.01) accepté', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date) values ('aaaaaaaa-0000-0000-0000-000000000001','m0005',0.005,'sortie','2026-10-01')$q$);
select qa.cas('Montant max 9999999999.99 accepté', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date) values ('aaaaaaaa-0000-0000-0000-000000000001','mmax',9999999999.99,'entrée','2026-10-01')$q$);
select qa.cas('Montant 10^10 refusé (dépassement)', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date) values ('aaaaaaaa-0000-0000-0000-000000000001','x',10000000000,'entrée','2026-10-01')$q$, '22003');
select qa.cas('Montant 12.345 arrondi à 12.35', 'authenticated', :A,
  $q$do $x$ begin insert into public.transactions (user_id,description,montant,type,date) values ('aaaaaaaa-0000-0000-0000-000000000001','m12345',12.345,'sortie','2026-10-01');
    if (select montant from public.transactions where description='m12345') <> 12.35 then raise exception 'arrondi'; end if; end $x$ $q$);
select qa.cas('solde_initial négatif accepté', 'authenticated', :A,
  $q$insert into public.comptes (user_id,nom,type,solde_initial,date_solde_initial) values ('aaaaaaaa-0000-0000-0000-000000000001','Découvert','courant',-250.50,'2026-09-30')$q$);
select qa.cas('Plafond 0 refusé', 'authenticated', :A,
  $q$insert into public.comptes (user_id,nom,type,plafond) values ('aaaaaaaa-0000-0000-0000-000000000001','x','livret',0)$q$, '23514');
select qa.cas('Plafond 22950 accepté', 'authenticated', :A,
  $q$update public.comptes set plafond=22950 where id='10000000-0000-0000-0000-00000000000a'$q$);
select qa.cas('Solde banque négatif toujours accepté (soldes)', 'authenticated', :A,
  $q$insert into public.soldes (user_id,compte_id,date,montant) values ('aaaaaaaa-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000a','2026-10-15',-5)$q$);

-- ───────── Compte par défaut ─────────
select qa.cas('Compte par défaut de type livret accepté', 'authenticated', :A,
  $q$update public.comptes set par_defaut=true where id='10000000-0000-0000-0000-00000000000a'$q$);
select qa.cas('Deuxième compte par défaut pour A refusé', 'authenticated', :A,
  $q$update public.comptes set par_defaut=true where id='20000000-0000-0000-0000-00000000000a'$q$, '23505');
select qa.cas('Compte par défaut pour B (autre utilisateur) accepté', 'authenticated', :B,
  $q$update public.comptes set par_defaut=true where id='40000000-0000-0000-0000-00000000000b'$q$);
select qa.cas('Changer le défaut en 2 updates (retirer puis poser) : accepté', 'authenticated', :A,
  $q$do $x$ begin update public.comptes set par_defaut=false where user_id=auth.uid() and par_defaut;
    update public.comptes set par_defaut=true where id='20000000-0000-0000-0000-00000000000a'; end $x$ $q$);
select qa.cas('Changer le défaut en 1 update (bascule) : refusé, index non déferrable', 'authenticated', :A,
  $q$update public.comptes set par_defaut = (id='10000000-0000-0000-0000-00000000000a') where user_id=auth.uid()$q$, '23505');

-- ───────── Suppression de compte (refusée s'il porte des opérations) ─────────
select qa.cas('Supprimer un compte portant une tx (compte_id) : refusé', 'authenticated', :A,
  $q$delete from public.comptes where id='10000000-0000-0000-0000-00000000000a'$q$, '23503');
select qa.cas('Préparation : virement Livret A -> Bitcoin', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id,compte_dest_id)
     values ('aaaaaaaa-0000-0000-0000-000000000001','mvt-btc',5,'mouvement','2026-10-02','10000000-0000-0000-0000-00000000000a','30000000-0000-0000-0000-00000000000a')$q$);
select qa.cas('  … suppression de Bitcoin (destination du virement) refusée', 'authenticated', :A,
  $q$delete from public.comptes where id='30000000-0000-0000-0000-00000000000a'$q$, '23503');
select qa.cas('Supprimer un compte sans tx mais avec soldes : accepté', 'authenticated', :A,
  $q$delete from public.comptes where id='20000000-0000-0000-0000-00000000000a'$q$);
select qa.cas('  … ses soldes sont supprimés en cascade', 'postgres', null,
  $q$do $x$ begin if exists (select 1 from public.soldes where compte_id='20000000-0000-0000-0000-00000000000a') then raise exception 'soldes orphelins'; end if; end $x$ $q$);
select qa.cas('A ne peut pas supprimer le compte de B (0 ligne, RLS)', 'authenticated', :A,
  $q$do $x$ declare n int; begin delete from public.comptes where id='40000000-0000-0000-0000-00000000000b'; get diagnostics n=row_count;
    if n<>0 then raise exception 'supprimé'; end if; end $x$ $q$);

-- ───────── Suppression d'un utilisateur (auth.admin.deleteUser) ─────────
-- A possède des comptes qui portent des transactions : la cascade auth.users -> comptes et
-- -> transactions doit passer malgré les clés « on delete restrict ». Le cas lève ensuite
-- volontairement l'erreur QA001 pour tout annuler : obtenir QA001 prouve que le delete a réussi.
select qa.cas('Suppression du user A (cascade) malgré les FK restrict', 'postgres', null,
  $q$do $x$ begin delete from auth.users where id='aaaaaaaa-0000-0000-0000-000000000001'; raise exception using errcode='QA001', message='rollback volontaire'; end $x$ $q$, 'QA001');

-- ───────── Écarts connus, hors périmètre de #3 (suivis par le ticket #24) ─────────
-- Ces cas décrivent le comportement ACTUEL. Quand #24 sera livré, leur attendu passera à '23503'.
select qa.cas('ÉCART #24 : A pose un solde sur le compte de B (accepté aujourd''hui)', 'authenticated', :A,
  $q$insert into public.soldes (user_id,compte_id,date,montant) values ('aaaaaaaa-0000-0000-0000-000000000001','40000000-0000-0000-0000-00000000000b','2026-10-20',1)$q$);
select qa.cas('Préparation : B crée une catégorie', 'authenticated', :B,
  $q$insert into public.categories (id,user_id,nom) values ('c0000000-0000-0000-0000-00000000000b','bbbbbbbb-0000-0000-0000-000000000002','Cat B')$q$);
select qa.cas('ÉCART #24 : tx de A avec la catégorie de B (acceptée aujourd''hui)', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,categorie_id) values ('aaaaaaaa-0000-0000-0000-000000000001','x',1,'sortie','2026-10-01','c0000000-0000-0000-0000-00000000000b')$q$);
