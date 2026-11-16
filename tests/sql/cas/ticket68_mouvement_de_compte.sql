-- Tests du ticket #68 : catégorie « Mouvement de compte » et retrait du type mouvement.
-- Base de départ : socle + données fictives + toutes les migrations.
-- Chaque appel qa.cas(cas, rôle, utilisateur, requête, attendu) : voir tests/sql/socle/20_harnais.sql.
--
-- Utilisateurs : A = aaaaaaaa-…-01, B = bbbbbbbb-…-02 (voir tests/sql/socle/10_donnees.sql).
-- Catégories du socle : c0…01 Courses (A), c0…a8 « Virement interne » créée en `sortie` (A),
--                       c0…b8 « virement INTERNE » avec espaces (B).
-- Comptes créés ici (A) : f1… « Départ #68 » (1000 au 01/11/2026), f2… « Arrivée #68 » (0 au 01/11/2026).
-- Le garde-fou (migration interrompue si un mouvement existe) se teste hors de ce fichier, sur une base
-- où la migration n'est pas encore passée : voir le commentaire du ticket #68.
-- Attention : les cas qui réussissent modifient la base pour les cas suivants (l'ordre compte).

\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set B '''bbbbbbbb-0000-0000-0000-000000000002'''

-- ───────── Structure ─────────
select qa.cas('categories.mouvement_compte : boolean not null default false', 'postgres', null,
  $q$do $x$ begin
     if not exists (select 1 from information_schema.columns
                    where table_schema='public' and table_name='categories' and column_name='mouvement_compte'
                      and data_type='boolean' and is_nullable='NO' and column_default='false')
       then raise exception 'colonne absente ou mal définie'; end if; end $x$ $q$);
select qa.cas('Index unique partiel categories_un_mouvement_compte_par_user', 'postgres', null,
  $q$do $x$ begin
     if not exists (select 1 from pg_indexes where schemaname='public' and indexname='categories_un_mouvement_compte_par_user'
                    and indexdef like 'CREATE UNIQUE INDEX%(user_id) WHERE mouvement_compte')
       then raise exception 'index absent ou mal défini'; end if; end $x$ $q$);
select qa.cas('Contrainte transactions_mouvement_comptes_check supprimée', 'postgres', null,
  $q$do $x$ begin
     if exists (select 1 from pg_constraint where conname='transactions_mouvement_comptes_check')
       then raise exception 'contrainte encore présente'; end if; end $x$ $q$);
select qa.cas('transactions.type : entrée et sortie seulement', 'postgres', null,
  $q$do $x$ begin
     if (select pg_get_constraintdef(oid) from pg_constraint where conname='transactions_type_check')
        is distinct from $d$CHECK ((type = ANY (ARRAY['entrée'::text, 'sortie'::text])))$d$
       then raise exception 'contrainte de type inattendue'; end if; end $x$ $q$);
select qa.cas('compte_dest_id conservée (décision du 16/11) et forcée à null', 'postgres', null,
  $q$do $x$ begin
     if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='transactions' and column_name='compte_dest_id')
       then raise exception 'colonne supprimée trop tôt (le front actuel l''envoie)'; end if;
     if (select pg_get_constraintdef(oid) from pg_constraint where conname='transactions_compte_dest_id_vide_check')
        is distinct from 'CHECK ((compte_dest_id IS NULL))'
       then raise exception 'contrainte compte_dest_id vide absente'; end if; end $x$ $q$);
select qa.cas('v_soldes_comptes toujours en security_invoker', 'postgres', null,
  $q$do $x$ begin
     if not exists (select 1 from pg_class where oid = 'public.v_soldes_comptes'::regclass
                    and relkind = 'v' and 'security_invoker=on' = any(reloptions))
       then raise exception 'security_invoker perdu'; end if; end $x$ $q$);
select qa.cas('v_soldes_comptes ne lit plus compte_dest_id', 'postgres', null,
  $q$do $x$ begin
     if pg_get_viewdef('public.v_soldes_comptes'::regclass) like '%compte_dest_id%'
       then raise exception 'la vue référence encore compte_dest_id'; end if; end $x$ $q$);

-- ───────── CA1 : « Virement interne » cochée et de type `les deux` ─────────
select qa.cas('CA1 A : Virement interne cochée, passée de sortie à les deux', 'authenticated', :A,
  $q$do $x$ declare r record; begin
     select * into r from public.categories where id='c0000000-0000-0000-0000-0000000000a8';
     if not r.mouvement_compte or r.type <> 'les deux' then raise exception 'coche=% type=%', r.mouvement_compte, r.type; end if; end $x$ $q$);
select qa.cas('CA1 B : « virement INTERNE » (casse, espaces) cochée et de type les deux', 'authenticated', :B,
  $q$do $x$ declare r record; begin
     select * into r from public.categories where id='c0000000-0000-0000-0000-0000000000b8';
     if not r.mouvement_compte or r.type <> 'les deux' then raise exception 'coche=% type=%', r.mouvement_compte, r.type; end if; end $x$ $q$);
select qa.cas('CA1 les autres catégories restent non cochées', 'postgres', null,
  $q$do $x$ begin
     if exists (select 1 from public.categories where mouvement_compte and lower(btrim(nom)) <> 'virement interne')
       then raise exception 'catégorie cochée à tort'; end if; end $x$ $q$);
select qa.cas('Nouvelle catégorie : non cochée par défaut', 'authenticated', :A,
  $q$do $x$ begin
     insert into public.categories (user_id,nom) values ('aaaaaaaa-0000-0000-0000-000000000001','Loisirs #68');
     if (select mouvement_compte from public.categories where nom='Loisirs #68') then raise exception 'cochée'; end if; end $x$ $q$);

-- ───────── CA2 : une seule catégorie cochée par utilisateur ─────────
select qa.cas('CA2 cocher une seconde catégorie (Courses) : refusé', 'authenticated', :A,
  $q$update public.categories set mouvement_compte=true where id='c0000000-0000-0000-0000-000000000001'$q$, '23505');
select qa.cas('CA2 créer une seconde catégorie cochée : refusé', 'authenticated', :A,
  $q$insert into public.categories (user_id,nom,mouvement_compte) values ('aaaaaaaa-0000-0000-0000-000000000001','Autre virement',true)$q$, '23505');
select qa.cas('Changer de catégorie cochée en 1 update (bascule) : refusé, index non déferrable', 'authenticated', :A,
  $q$update public.categories set mouvement_compte = (id='c0000000-0000-0000-0000-000000000001') where user_id=auth.uid()$q$, '23505');
select qa.cas('Changer de catégorie cochée : décocher puis cocher (2 updates) accepté', 'authenticated', :A,
  $q$do $x$ begin
     update public.categories set mouvement_compte=false where user_id=auth.uid() and mouvement_compte;
     update public.categories set mouvement_compte=true where id='c0000000-0000-0000-0000-000000000001'; end $x$ $q$);
select qa.cas('  … retour sur Virement interne', 'authenticated', :A,
  $q$do $x$ begin
     update public.categories set mouvement_compte=false where user_id=auth.uid() and mouvement_compte;
     update public.categories set mouvement_compte=true where id='c0000000-0000-0000-0000-0000000000a8'; end $x$ $q$);
select qa.cas('L''unicité est par utilisateur : A et B ont chacun la leur', 'postgres', null,
  $q$do $x$ begin
     if (select count(*) from public.categories where mouvement_compte) <> 2 then raise exception 'attendu 2'; end if; end $x$ $q$);

-- ───────── CA3 : plus de mouvement ─────────
select qa.cas('CA3 insérer un mouvement : refusé', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id)
     values ('aaaaaaaa-0000-0000-0000-000000000001','x',10,'mouvement','2026-11-02','10000000-0000-0000-0000-00000000000a')$q$, '23514');
select qa.cas('CA3 insérer un mouvement avec les deux comptes : refusé', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id,compte_dest_id)
     values ('aaaaaaaa-0000-0000-0000-000000000001','x',10,'mouvement','2026-11-02','10000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-00000000000a')$q$, '23514');
select qa.cas('Sortie avec compte_dest_id renseigné : refusée', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id,compte_dest_id)
     values ('aaaaaaaa-0000-0000-0000-000000000001','x',10,'sortie','2026-11-02','10000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-00000000000a')$q$, '23514');
select qa.cas('Ligne envoyée par le front actuel (compte_dest_id null) : acceptée', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id,compte_dest_id,categorie_id,tricount,epingle,note)
     values ('aaaaaaaa-0000-0000-0000-000000000001','Front actuel #68',4.2,'sortie','2026-11-02','10000000-0000-0000-0000-00000000000a',null,'c0000000-0000-0000-0000-000000000001','non',true,null)$q$);

-- ───────── CA4 : un virement = une sortie + une entrée ─────────
select qa.cas('Préparation : comptes Départ #68 (1000 au 01/11) et Arrivée #68 (0 au 01/11)', 'authenticated', :A,
  $q$insert into public.comptes (id,user_id,nom,type,solde_initial,date_solde_initial) values
     ('f1000000-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001','Départ #68','courant',1000,'2026-11-01'),
     ('f2000000-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001','Arrivée #68','livret',0,'2026-11-01')$q$);
select qa.cas('Préparation : sortie 100 sur Départ + entrée 100 sur Arrivée, catégorie Virement interne', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id,categorie_id) values
     ('aaaaaaaa-0000-0000-0000-000000000001','Virement #68',100,'sortie','2026-11-03','f1000000-0000-0000-0000-00000000000a','c0000000-0000-0000-0000-0000000000a8'),
     ('aaaaaaaa-0000-0000-0000-000000000001','Virement #68',100,'entrée','2026-11-03','f2000000-0000-0000-0000-00000000000a','c0000000-0000-0000-0000-0000000000a8')$q$);
select qa.cas('CA4 solde calculé : Départ 1000 → 900, Arrivée 0 → 100', 'authenticated', :A,
  $q$do $x$ declare d numeric; a numeric; begin
     select solde_calcule into d from public.v_soldes_comptes where compte_id='f1000000-0000-0000-0000-00000000000a';
     select solde_calcule into a from public.v_soldes_comptes where compte_id='f2000000-0000-0000-0000-00000000000a';
     if d is distinct from 900 or a is distinct from 100 then raise exception 'départ=% arrivée=%', d, a; end if; end $x$ $q$);
select qa.cas('CA4 relevé banque à 900 le 05/11 : écart nul sur Départ', 'authenticated', :A,
  $q$do $x$ declare r record; begin
     insert into public.soldes (user_id,compte_id,date,montant) values
       ('aaaaaaaa-0000-0000-0000-000000000001','f1000000-0000-0000-0000-00000000000a','2026-11-05',900);
     select * into r from public.v_soldes_comptes where compte_id='f1000000-0000-0000-0000-00000000000a';
     if r.ecart is distinct from 0 or r.solde_calcule_a_date_banque is distinct from 900
       then raise exception 'ecart=% a_date=%', r.ecart, r.solde_calcule_a_date_banque; end if; end $x$ $q$);
select qa.cas('Somme des soldes calculés inchangée par le virement', 'authenticated', :A,
  $q$do $x$ declare avant numeric; apres numeric; begin
     select sum(solde_calcule) into avant from public.v_soldes_comptes;
     insert into public.transactions (user_id,description,montant,type,date,compte_id,categorie_id) values
       ('aaaaaaaa-0000-0000-0000-000000000001','Virement #68 retour',40,'sortie','2026-11-06','f2000000-0000-0000-0000-00000000000a','c0000000-0000-0000-0000-0000000000a8'),
       ('aaaaaaaa-0000-0000-0000-000000000001','Virement #68 retour',40,'entrée','2026-11-06','f1000000-0000-0000-0000-00000000000a','c0000000-0000-0000-0000-0000000000a8');
     select sum(solde_calcule) into apres from public.v_soldes_comptes;
     if avant is distinct from apres then raise exception 'avant=% après=%', avant, apres; end if; end $x$ $q$);

-- ───────── CA6 : RLS inchangée ─────────
select qa.cas('CA6 A ne voit que ses catégories', 'authenticated', :A,
  $q$do $x$ begin
     if exists (select 1 from public.categories where user_id <> auth.uid()) then raise exception 'fuite'; end if;
     if exists (select 1 from public.categories where id='c0000000-0000-0000-0000-0000000000b8') then raise exception 'catégorie de B visible'; end if; end $x$ $q$);
select qa.cas('CA6 B ne peut pas décocher la catégorie de A (0 ligne)', 'authenticated', :B,
  $q$do $x$ declare n int; begin
     update public.categories set mouvement_compte=false where id='c0000000-0000-0000-0000-0000000000a8';
     get diagnostics n = row_count; if n <> 0 then raise exception 'modifiée'; end if; end $x$ $q$);
select qa.cas('CA6 B ne voit que ses soldes (1 ligne)', 'authenticated', :B,
  $q$do $x$ begin
     if (select count(*) from public.v_soldes_comptes) <> 1 then raise exception 'nombre de lignes'; end if; end $x$ $q$);
select qa.cas('CA6 anon : aucune catégorie, aucun solde', 'anon', null,
  $q$do $x$ begin
     if (select count(*) from public.categories) + (select count(*) from public.v_soldes_comptes) <> 0
       then raise exception 'fuite'; end if; end $x$ $q$);

-- ───────── Non-régression front ─────────
select qa.cas('loadCategories (select *) renvoie mouvement_compte', 'authenticated', :A,
  $q$do $x$ begin
     if (select to_jsonb(c) ? 'mouvement_compte' from public.categories c limit 1) is not true
       then raise exception 'colonne absente du select *'; end if; end $x$ $q$);
