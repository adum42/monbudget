-- Tests du ticket #24 : contrôle d'appartenance de soldes.compte_id et transactions.categorie_id.
-- Base de départ : socle + données fictives + toutes les migrations.
-- Chaque appel qa.cas(cas, rôle, utilisateur, requête, attendu) : voir tests/sql/socle/20_harnais.sql.
--
-- Utilisateurs : A = aaaaaaaa-…-01, B = bbbbbbbb-…-02 (voir tests/sql/socle/10_donnees.sql).
-- Comptes du socle : 10…0a Livret A, 20…0a Livret DD (A) ; 40…0b Livret B (B), relevé du 30/09/2026.
-- Catégories du socle : c0…01 Courses (A), c0…b8 « virement INTERNE » (B).
-- Montants fictifs. Le garde-fou (migration interrompue si une ligne viole déjà la règle) se teste
-- hors de ce fichier, sur une base où la migration n'est pas encore passée : voir la PR.
-- Attention : les cas qui réussissent modifient la base pour les cas suivants (l'ordre compte).

\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set B '''bbbbbbbb-0000-0000-0000-000000000002'''

-- ───────── Structure : mêmes conventions que #3 ─────────
select qa.cas('Fonctions security invoker, search_path vide', 'postgres', null,
  $q$do $x$ declare r record; n int := 0; begin
     for r in select proname, prosecdef, proconfig from pg_proc
              where pronamespace = 'public'::regnamespace
                and proname in ('soldes_verifier_compte','transactions_verifier_categorie') loop
       n := n + 1;
       if r.prosecdef then raise exception '% en security definer', r.proname; end if;
       if r.proconfig is distinct from array['search_path=""'] then raise exception '% : proconfig=%', r.proname, r.proconfig; end if;
     end loop;
     if n <> 2 then raise exception '% fonction(s) trouvée(s) sur 2', n; end if; end $x$ $q$);
select qa.cas('Trigger soldes_verifier_compte : before insert or update of compte_id, user_id', 'postgres', null,
  $q$do $x$ begin
     if (select pg_get_triggerdef(oid) from pg_trigger where tgname='soldes_verifier_compte')
        is distinct from 'CREATE TRIGGER soldes_verifier_compte BEFORE INSERT OR UPDATE OF compte_id, user_id ON public.soldes FOR EACH ROW EXECUTE FUNCTION soldes_verifier_compte()'
       then raise exception 'trigger absent ou mal défini'; end if; end $x$ $q$);
select qa.cas('Trigger transactions_verifier_categorie : before insert or update of categorie_id, user_id', 'postgres', null,
  $q$do $x$ begin
     if (select pg_get_triggerdef(oid) from pg_trigger where tgname='transactions_verifier_categorie')
        is distinct from 'CREATE TRIGGER transactions_verifier_categorie BEFORE INSERT OR UPDATE OF categorie_id, user_id ON public.transactions FOR EACH ROW EXECUTE FUNCTION transactions_verifier_categorie()'
       then raise exception 'trigger absent ou mal défini'; end if; end $x$ $q$);
select qa.cas('Trigger transactions_verifier_comptes (#3, réécrit par #86) : before insert or update of compte_id, user_id', 'postgres', null,
  $q$do $x$ begin
     if (select pg_get_triggerdef(oid) from pg_trigger where tgname='transactions_verifier_comptes')
        is distinct from 'CREATE TRIGGER transactions_verifier_comptes BEFORE INSERT OR UPDATE OF compte_id, user_id ON public.transactions FOR EACH ROW EXECUTE FUNCTION transactions_verifier_comptes()'
       then raise exception 'trigger transactions_verifier_comptes inattendu'; end if; end $x$ $q$);

-- ───────── CA1 : B ne peut pas poser un solde sur un compte de A ─────────
select qa.cas('CA1 B insère un relevé sur le Livret A de A : refusé', 'authenticated', :B,
  $q$insert into public.soldes (user_id,compte_id,date,montant) values ('bbbbbbbb-0000-0000-0000-000000000002','10000000-0000-0000-0000-00000000000a','2026-11-01',1)$q$, '23503');
select qa.cas('CA1 message en français', 'authenticated', :B,
  $q$do $x$ begin
     insert into public.soldes (user_id,compte_id,date,montant) values ('bbbbbbbb-0000-0000-0000-000000000002','10000000-0000-0000-0000-00000000000a','2026-11-01',1);
     raise exception 'accepté';
   exception when foreign_key_violation then
     if sqlerrm <> 'Le compte de ce relevé n''existe pas ou appartient à un autre utilisateur.' then raise exception 'message : %', sqlerrm; end if;
   end $x$ $q$);
select qa.cas('CA1 B upsert (compte_id,date) sur un relevé existant de A : refusé, relevé de A intact', 'authenticated', :B,
  $q$insert into public.soldes (user_id,compte_id,date,montant) values ('bbbbbbbb-0000-0000-0000-000000000002','10000000-0000-0000-0000-00000000000a','2026-09-30',1)
     on conflict (compte_id,date) do update set montant = excluded.montant$q$, '23503');
select qa.cas('  … le relevé de A n''a pas changé', 'postgres', null,
  $q$do $x$ begin
     if (select montant from public.soldes where compte_id='10000000-0000-0000-0000-00000000000a' and date='2026-09-30') <> 150
       then raise exception 'relevé de A modifié'; end if; end $x$ $q$);
select qa.cas('CA1 B déplace son relevé vers le compte de A : refusé', 'authenticated', :B,
  $q$update public.soldes set compte_id='10000000-0000-0000-0000-00000000000a' where compte_id='40000000-0000-0000-0000-00000000000b'$q$, '23503');
select qa.cas('CA1 compte inexistant : refusé', 'authenticated', :B,
  $q$insert into public.soldes (user_id,compte_id,date,montant) values ('bbbbbbbb-0000-0000-0000-000000000002','99999999-0000-0000-0000-000000000000','2026-11-01',1)$q$, '23503');
select qa.cas('CA1 service_role ne contourne pas le contrôle (relevé de A sur le compte de B)', 'service_role', null,
  $q$insert into public.soldes (user_id,compte_id,date,montant) values ('aaaaaaaa-0000-0000-0000-000000000001','40000000-0000-0000-0000-00000000000b','2026-11-01',1)$q$, '23503');

-- ───────── CA2 : B ne peut pas utiliser une catégorie de A ─────────
select qa.cas('CA2 B insère une opération avec la catégorie Courses de A : refusé', 'authenticated', :B,
  $q$insert into public.transactions (user_id,description,montant,type,date,categorie_id) values ('bbbbbbbb-0000-0000-0000-000000000002','#24 x',1,'sortie','2026-11-01','c0000000-0000-0000-0000-000000000001')$q$, '23503');
select qa.cas('CA2 message en français', 'authenticated', :B,
  $q$do $x$ begin
     insert into public.transactions (user_id,description,montant,type,date,categorie_id) values ('bbbbbbbb-0000-0000-0000-000000000002','#24 x',1,'sortie','2026-11-01','c0000000-0000-0000-0000-000000000001');
     raise exception 'acceptée';
   exception when foreign_key_violation then
     if sqlerrm <> 'La catégorie de cette opération n''existe pas ou appartient à un autre utilisateur.' then raise exception 'message : %', sqlerrm; end if;
   end $x$ $q$);
select qa.cas('Préparation : B crée une opération dans sa propre catégorie', 'authenticated', :B,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id,categorie_id) values ('bbbbbbbb-0000-0000-0000-000000000002','#24 B',5,'sortie','2026-11-02','40000000-0000-0000-0000-00000000000b','c0000000-0000-0000-0000-0000000000b8')$q$);
select qa.cas('CA2 B modifie son opération vers la catégorie de A : refusé', 'authenticated', :B,
  $q$update public.transactions set categorie_id='c0000000-0000-0000-0000-000000000001' where description='#24 B'$q$, '23503');
select qa.cas('CA2 catégorie inexistante : refusée', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,categorie_id) values ('aaaaaaaa-0000-0000-0000-000000000001','#24 x',1,'sortie','2026-11-01','99999999-0000-0000-0000-000000000000')$q$, '23503');
select qa.cas('CA2 service_role ne contourne pas le contrôle', 'service_role', null,
  $q$insert into public.transactions (user_id,description,montant,type,date,categorie_id) values ('aaaaaaaa-0000-0000-0000-000000000001','#24 x',1,'sortie','2026-11-01','c0000000-0000-0000-0000-0000000000b8')$q$, '23503');

-- ───────── CA3 : une opération sans catégorie reste acceptée ─────────
select qa.cas('CA3 insertion sans catégorie (categorie_id null) : acceptée', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id,categorie_id) values ('aaaaaaaa-0000-0000-0000-000000000001','#24 sans cat',3,'sortie','2026-11-03','10000000-0000-0000-0000-00000000000a',null)$q$);
select qa.cas('CA3 modification vers « Sans catégorie » : acceptée', 'authenticated', :B,
  $q$do $x$ declare n int; begin
     update public.transactions set categorie_id = null where description='#24 B';
     get diagnostics n = row_count; if n <> 1 then raise exception '% ligne(s)', n; end if; end $x$ $q$);

-- ───────── CA4 : les écritures légitimes passent ─────────
select qa.cas('CA4 saveSoldeEntry : upsert d''un nouveau relevé sur son compte', 'authenticated', :A,
  $q$insert into public.soldes (user_id,compte_id,date,montant,note) values ('aaaaaaaa-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000a','2026-11-05',2,null)
     on conflict (compte_id,date) do update set user_id=excluded.user_id, compte_id=excluded.compte_id, date=excluded.date, montant=excluded.montant, note=excluded.note$q$);
select qa.cas('CA4 saveSoldeEntry : upsert sur une date déjà saisie remplace le relevé', 'authenticated', :A,
  $q$do $x$ begin
     insert into public.soldes (user_id,compte_id,date,montant,note) values ('aaaaaaaa-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000a','2026-11-05',3,'#24')
       on conflict (compte_id,date) do update set user_id=excluded.user_id, compte_id=excluded.compte_id, date=excluded.date, montant=excluded.montant, note=excluded.note;
     if (select montant from public.soldes where compte_id='10000000-0000-0000-0000-00000000000a' and date='2026-11-05') <> 3
       then raise exception 'relevé non remplacé'; end if; end $x$ $q$);
select qa.cas('CA4 relevé déplacé vers un autre compte de A : accepté', 'authenticated', :A,
  $q$update public.soldes set compte_id='20000000-0000-0000-0000-00000000000a' where compte_id='10000000-0000-0000-0000-00000000000a' and date='2026-11-05'$q$);
select qa.cas('CA4 saveTx : création avec sa propre catégorie', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id,categorie_id,tricount,epingle,note)
     values ('aaaaaaaa-0000-0000-0000-000000000001','#24 A',4,'sortie','2026-11-04','10000000-0000-0000-0000-00000000000a','c0000000-0000-0000-0000-000000000001','non',true,null)$q$);
select qa.cas('CA4 saveTx : modification avec sa propre catégorie', 'authenticated', :A,
  $q$do $x$ declare n int; begin
     update public.transactions set description='#24 A modif', montant=4.5, type='sortie', date='2026-11-04',
       compte_id='10000000-0000-0000-0000-00000000000a',
       categorie_id='c0000000-0000-0000-0000-0000000000a8', tricount='non', epingle=true, note=null
     where description='#24 A';
     get diagnostics n = row_count; if n <> 1 then raise exception '% ligne(s)', n; end if; end $x$ $q$);
select qa.cas('CA4 épingle et Tricount : modifiables', 'authenticated', :A,
  $q$do $x$ declare n int; begin
     update public.transactions set epingle=false where description='#24 A modif';
     update public.transactions set tricount='oui validé' where description='#24 A modif';
     get diagnostics n = row_count; if n <> 1 then raise exception '% ligne(s)', n; end if; end $x$ $q$);
select qa.cas('CA4 suppression d''une catégorie : ses opérations passent en « Sans catégorie »', 'authenticated', :A,
  $q$do $x$ begin
     insert into public.categories (id,user_id,nom) values ('c0000000-0000-0000-0000-000000000024','aaaaaaaa-0000-0000-0000-000000000001','#24 Cat');
     insert into public.transactions (user_id,description,montant,type,date,categorie_id) values ('aaaaaaaa-0000-0000-0000-000000000001','#24 cat supprimée',1,'sortie','2026-11-06','c0000000-0000-0000-0000-000000000024');
     delete from public.categories where id='c0000000-0000-0000-0000-000000000024';
     if (select categorie_id from public.transactions where description='#24 cat supprimée') is not null
       then raise exception 'catégorie non remise à null'; end if; end $x$ $q$);
select qa.cas('CA4 suppression d''un compte sans opération : ses relevés partent en cascade', 'authenticated', :A,
  $q$do $x$ begin
     delete from public.transactions where compte_id='20000000-0000-0000-0000-00000000000a';
     delete from public.comptes where id='20000000-0000-0000-0000-00000000000a';
     if exists (select 1 from public.soldes where compte_id='20000000-0000-0000-0000-00000000000a') then raise exception 'relevés orphelins'; end if; end $x$ $q$);
select qa.cas('Suppression du user A (cascade) toujours possible', 'postgres', null,
  $q$do $x$ begin delete from auth.users where id='aaaaaaaa-0000-0000-0000-000000000001'; raise exception using errcode='QA001', message='rollback volontaire'; end $x$ $q$, 'QA001');
