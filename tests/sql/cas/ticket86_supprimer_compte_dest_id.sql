-- Tests du ticket #86 : suppression de transactions.compte_dest_id (colonne, FK, index, trigger, contrainte).
-- Base de départ : socle + données fictives + toutes les migrations.
-- Chaque appel qa.cas(cas, rôle, utilisateur, requête, attendu) : voir tests/sql/socle/20_harnais.sql.
--
-- Utilisateurs : A = aaaaaaaa-…-01 (comptes 10…0a Livret A, 20…0a Livret DD, 30…0a Bitcoin),
--                B = bbbbbbbb-…-02 (compte 40…0b Livret B). Voir tests/sql/socle/10_donnees.sql.
-- Le garde-fou (migration interrompue si une transaction a compte_dest_id renseignée) se teste hors de
-- ce fichier, sur une base où la migration n'est pas encore passée : voir la PR.
-- Attention : les cas qui réussissent modifient la base pour les cas suivants (l'ordre compte).

\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set B '''bbbbbbbb-0000-0000-0000-000000000002'''

-- ───────── CA1 / CA2 : colonne, index, FK et contrainte absents ─────────
select qa.cas('CA1 colonne transactions.compte_dest_id absente', 'postgres', null,
  $q$do $x$ begin
     if exists (select 1 from information_schema.columns
                where table_schema='public' and table_name='transactions' and column_name='compte_dest_id')
       then raise exception 'colonne encore présente'; end if; end $x$ $q$);
select qa.cas('CA2 index transactions_compte_dest_id_idx absent', 'postgres', null,
  $q$do $x$ begin
     if exists (select 1 from pg_indexes where schemaname='public' and indexname='transactions_compte_dest_id_idx')
       then raise exception 'index encore présent'; end if; end $x$ $q$);
select qa.cas('CA2 FK transactions_compte_dest_id_fkey absente ; seule transactions_compte_id_fkey vise comptes', 'postgres', null,
  $q$do $x$ begin
     if exists (select 1 from pg_constraint where conname='transactions_compte_dest_id_fkey')
       then raise exception 'FK encore présente'; end if;
     if (select array_agg(conname::text order by conname) from pg_constraint
         where conrelid='public.transactions'::regclass and contype='f' and confrelid='public.comptes'::regclass)
        is distinct from array['transactions_compte_id_fkey']
       then raise exception 'FK vers comptes inattendues'; end if; end $x$ $q$);
select qa.cas('CA2 contrainte transactions_compte_dest_id_vide_check absente', 'postgres', null,
  $q$do $x$ begin
     if exists (select 1 from pg_constraint where conname='transactions_compte_dest_id_vide_check')
       then raise exception 'contrainte encore présente'; end if; end $x$ $q$);
select qa.cas('Index transactions_compte_id_idx conservé', 'postgres', null,
  $q$do $x$ begin
     if not exists (select 1 from pg_indexes where schemaname='public' and indexname='transactions_compte_id_idx')
       then raise exception 'index compte_id disparu'; end if; end $x$ $q$);

-- ───────── CA3 : trigger transactions_verifier_comptes sans compte_dest_id ─────────
select qa.cas('CA3 trigger : before insert or update of compte_id, user_id', 'postgres', null,
  $q$do $x$ begin
     if (select pg_get_triggerdef(oid) from pg_trigger where tgname='transactions_verifier_comptes')
        is distinct from 'CREATE TRIGGER transactions_verifier_comptes BEFORE INSERT OR UPDATE OF compte_id, user_id ON public.transactions FOR EACH ROW EXECUTE FUNCTION transactions_verifier_comptes()'
       then raise exception 'trigger absent ou mal défini'; end if;
     if (select tgenabled from pg_trigger where tgname='transactions_verifier_comptes') <> 'O'
       then raise exception 'trigger désactivé'; end if; end $x$ $q$);
select qa.cas('CA3 fonction : ne mentionne plus compte_dest_id, security invoker, search_path vide', 'postgres', null,
  $q$do $x$ declare p record; begin
     select * into p from pg_proc where oid='public.transactions_verifier_comptes()'::regprocedure;
     if p.prosrc like '%compte_dest%' then raise exception 'la fonction mentionne encore la colonne'; end if;
     if p.prosecdef then raise exception 'security definer'; end if;
     if p.proconfig is distinct from array['search_path=""'] then raise exception 'search_path = %', p.proconfig; end if; end $x$ $q$);
select qa.cas('CA3 aucun objet de public ne dépend plus d''une colonne compte_dest_id', 'postgres', null,
  $q$do $x$ begin
     if exists (select 1 from information_schema.columns where table_schema='public' and column_name='compte_dest_id')
       then raise exception 'colonne compte_dest_id trouvée dans public'; end if;
     if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                where n.nspname='public' and p.prosrc like '%compte_dest%')
       then raise exception 'une fonction de public mentionne encore compte_dest'; end if; end $x$ $q$);

select qa.cas('CA3 A rattache une sortie au compte de B : refusé (23503)', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id)
     values ('aaaaaaaa-0000-0000-0000-000000000001','#86 x',10,'sortie','2026-11-02','40000000-0000-0000-0000-00000000000b')$q$, '23503');
select qa.cas('CA3 message en français sur compte_id', 'authenticated', :A,
  $q$do $x$ begin
     insert into public.transactions (user_id,description,montant,type,date,compte_id)
       values ('aaaaaaaa-0000-0000-0000-000000000001','#86 x',10,'sortie','2026-11-02','40000000-0000-0000-0000-00000000000b');
     raise exception 'insertion acceptée';
   exception when sqlstate '23503' then
     if sqlerrm <> 'Le compte de cette opération n''existe pas ou appartient à un autre utilisateur.'
       then raise exception 'message inattendu : %', sqlerrm; end if; end $x$ $q$);
select qa.cas('CA3 compte inexistant : refusé (23503)', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id)
     values ('aaaaaaaa-0000-0000-0000-000000000001','#86 x',10,'entrée','2026-11-02',gen_random_uuid())$q$, '23503');
select qa.cas('CA3 service_role : tx de A sur le compte de B refusée (trigger hors RLS)', 'service_role', null,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id)
     values ('aaaaaaaa-0000-0000-0000-000000000001','#86 x',10,'sortie','2026-11-02','40000000-0000-0000-0000-00000000000b')$q$, '23503');

-- ───────── Écritures normales (front après #69 : construireLigneTx) ─────────
select qa.cas('Insertion d''une sortie sur Livret A : acceptée', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id,categorie_id,tricount,epingle,note)
     values ('aaaaaaaa-0000-0000-0000-000000000001','#86 sortie',40,'sortie','2026-11-03','10000000-0000-0000-0000-00000000000a','c0000000-0000-0000-0000-000000000001','non',true,null)$q$);
select qa.cas('Insertion d''une entrée sur Livret DD : acceptée', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id,categorie_id,tricount,epingle,note)
     values ('aaaaaaaa-0000-0000-0000-000000000001','#86 entrée',40,'entrée','2026-11-03','20000000-0000-0000-0000-00000000000a',null,'non',true,'note')$q$);
select qa.cas('Modification complète de la sortie (vers Bitcoin) : acceptée, 1 ligne', 'authenticated', :A,
  $q$do $x$ declare n int; begin
     update public.transactions set description='#86 sortie modif', montant=41, type='sortie', date='2026-11-04',
       compte_id='30000000-0000-0000-0000-00000000000a', categorie_id=null, tricount='oui', epingle=false, note=null
     where description='#86 sortie';
     get diagnostics n = row_count; if n <> 1 then raise exception '% ligne(s)', n; end if; end $x$ $q$);
select qa.cas('Modification : sortie déplacée vers le compte de B : refusée (23503)', 'authenticated', :A,
  $q$update public.transactions set compte_id='40000000-0000-0000-0000-00000000000b' where description='#86 sortie modif'$q$, '23503');
select qa.cas('Modification de l''épingle seule : acceptée', 'authenticated', :A,
  $q$update public.transactions set epingle=true where description='#86 sortie modif'$q$);
select qa.cas('service_role : user_id A -> B avec un compte de A : refusé (trigger sur user_id)', 'service_role', null,
  $q$update public.transactions set user_id='bbbbbbbb-0000-0000-0000-000000000002' where description='#86 entrée'$q$, '23503');
select qa.cas('v_soldes_comptes suit les opérations : Bitcoin −41, Livret DD +40', 'authenticated', :A,
  $q$do $x$ declare b numeric; d numeric; begin
     select solde_calcule - solde_initial into b from public.v_soldes_comptes where compte_id='30000000-0000-0000-0000-00000000000a';
     select solde_calcule - solde_initial into d from public.v_soldes_comptes where compte_id='20000000-0000-0000-0000-00000000000a';
     if b <> -41 or d <> 40 then raise exception 'Bitcoin % / Livret DD %', b, d; end if; end $x$ $q$);
select qa.cas('Suppression d''une opération : acceptée, 1 ligne', 'authenticated', :A,
  $q$do $x$ declare n int; begin
     delete from public.transactions where description='#86 entrée';
     get diagnostics n = row_count; if n <> 1 then raise exception '% ligne(s)', n; end if; end $x$ $q$);

-- ───────── Une écriture qui enverrait encore la colonne échoue (ancien front) ─────────
select qa.cas('Insertion avec compte_dest_id : colonne inexistante (42703)', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id,compte_dest_id)
     values ('aaaaaaaa-0000-0000-0000-000000000001','#86 x',10,'sortie','2026-11-02','10000000-0000-0000-0000-00000000000a',null)$q$, '42703');

-- ───────── CA6 : vue et RLS inchangées ─────────
select qa.cas('CA6 v_soldes_comptes : mêmes colonnes, même ordre, security_invoker', 'postgres', null,
  $q$do $x$ begin
     if (select array_agg(attname::text order by attnum) from pg_attribute
         where attrelid='public.v_soldes_comptes'::regclass and attnum > 0 and not attisdropped)
        is distinct from array['compte_id','user_id','nom','type','solde_initial','date_solde_initial','solde_calcule',
                               'dernier_solde_banque','date_dernier_solde_banque','solde_calcule_a_date_banque','ecart','nb_jours_depuis_releve']
       then raise exception 'colonnes de la vue modifiées'; end if;
     if not exists (select 1 from pg_class where oid='public.v_soldes_comptes'::regclass and 'security_invoker=on' = any(reloptions))
       then raise exception 'security_invoker perdu'; end if; end $x$ $q$);
select qa.cas('CA6 RLS transactions : activée, une seule politique ALL auth.uid() = user_id', 'postgres', null,
  $q$do $x$ begin
     if not (select relrowsecurity from pg_class where oid='public.transactions'::regclass)
       then raise exception 'RLS désactivée'; end if;
     if (select count(*) from pg_policies where schemaname='public' and tablename='transactions') <> 1
        or not exists (select 1 from pg_policies where schemaname='public' and tablename='transactions'
                       and cmd='ALL' and qual like '%auth.uid() = user_id%')
       then raise exception 'politiques de transactions modifiées'; end if; end $x$ $q$);
select qa.cas('CA6 B ne voit aucune opération de A', 'authenticated', :B,
  $q$do $x$ begin
     if exists (select 1 from public.transactions where user_id='aaaaaaaa-0000-0000-0000-000000000001')
       then raise exception 'B voit des opérations de A'; end if; end $x$ $q$);

-- ───────── Suppression d'un compte et d'un utilisateur ─────────
select qa.cas('Supprimer un compte portant une opération : toujours refusé (FK compte_id restrict)', 'authenticated', :A,
  $q$delete from public.comptes where id='30000000-0000-0000-0000-00000000000a'$q$, '23503');
select qa.cas('Suppression du user A (cascade) toujours possible', 'postgres', null,
  $q$do $x$ begin delete from auth.users where id='aaaaaaaa-0000-0000-0000-000000000001';
     raise exception using errcode='QA001', message='annulation volontaire'; end $x$ $q$, 'QA001');
