-- Non-régression du front : chaque requête de index.html (appels `sb.from(...)`), rejouée en SQL
-- telle que l'API Supabase l'exécute, avec l'utilisateur A connecté.
-- But : une migration ne doit pas casser une requête de l'interface actuelle.
-- Quand le front ajoute ou modifie une requête, ajouter ou modifier le cas correspondant ici.
-- Le numéro de ligne cité est indicatif (index.html au 03/11/2026).

\set A '''aaaaaaaa-0000-0000-0000-000000000001'''

-- ───────── Chargement : loadAll() ─────────
select qa.cas('loadCategories : select * order by nom (l.857)', 'authenticated', :A,
  $q$select * from public.categories order by nom$q$);
select qa.cas('loadTransactions : select *, categories(nom,emoji) order by date desc (l.861)', 'authenticated', :A,
  $q$select t.*, (select json_build_object('nom',c.nom,'emoji',c.emoji) from public.categories c where c.id=t.categorie_id) as categories
     from public.transactions t order by date desc$q$);
select qa.cas('loadComptes : comptes order by nom (l.865)', 'authenticated', :A,
  $q$select * from public.comptes order by nom$q$);
select qa.cas('loadComptes : soldes order by date desc (l.867)', 'authenticated', :A,
  $q$select * from public.soldes order by date desc$q$);
-- #8 : loadComptes lit aussi la vue, sb.from('v_soldes_comptes').select('*') (sans tri, sans filtre : la RLS filtre)
select qa.cas('#8 loadComptes : v_soldes_comptes select *', 'authenticated', :A,
  $q$select * from public.v_soldes_comptes$q$);
select qa.cas('#8 loadComptes : la vue ne renvoie que les 3 comptes de A, avec les colonnes lues par le front', 'authenticated', :A,
  $q$do $x$ begin
     if (select count(*) from public.v_soldes_comptes) <> 3 then raise exception 'nombre de lignes'; end if;
     if exists (select 1 from public.v_soldes_comptes where user_id <> 'aaaaaaaa-0000-0000-0000-000000000001') then raise exception 'ligne de B visible'; end if;
     perform compte_id, solde_calcule, dernier_solde_banque, date_dernier_solde_banque, ecart, nb_jours_depuis_releve from public.v_soldes_comptes;
     if (select json_typeof(to_json(solde_calcule)) from public.v_soldes_comptes limit 1) <> 'number' then raise exception 'solde_calcule pas un nombre'; end if;
     end $x$$q$);

-- ───────── Transactions : saveTx(), deleteTx(), boutons de la liste ─────────
select qa.cas('saveTx insert entrée sans compte (l.657)', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,categorie_id,date,tricount,epingle,note)
     values ('aaaaaaaa-0000-0000-0000-000000000001','Salaire',2288.18,'entrée',null,'2026-10-01','non',true,null)$q$);
select qa.cas('saveTx insert sortie avec catégorie et note (l.657)', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,categorie_id,date,tricount,epingle,note)
     values ('aaaaaaaa-0000-0000-0000-000000000001','Courses',2.4,'sortie','c0000000-0000-0000-0000-000000000001','2026-10-02','oui',false,'note')$q$);
select qa.cas('saveTx update d''une tx existante (l.655)', 'authenticated', :A,
  $q$update public.transactions set description='tx 5 modif',montant=12.5,type='sortie',categorie_id=null,date='2026-09-05',tricount='oui validé',epingle=true,note=null
     where id=(select id from public.transactions where description='tx 5')$q$);
select qa.cas('saveTx update : sortie -> entrée', 'authenticated', :A,
  $q$update public.transactions set type='entrée' where id=(select id from public.transactions where description='tx 6')$q$);
select qa.cas('saveTx montant négatif : refusé (message affiché par le front depuis #6)', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,categorie_id,date,tricount,epingle,note)
     values ('aaaaaaaa-0000-0000-0000-000000000001','x',-12,'sortie',null,'2026-10-01','non',true,null)$q$, '23514');
select qa.cas('saveTx montant 1e10 : refusé (dépassement)', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,categorie_id,date,tricount,epingle,note)
     values ('aaaaaaaa-0000-0000-0000-000000000001','x',1e10,'sortie',null,'2026-10-01','non',true,null)$q$, '22003');
select qa.cas('saveTx update vers montant négatif : refusé', 'authenticated', :A,
  $q$update public.transactions set montant=-3 where id=(select id from public.transactions where description='tx 7')$q$, '23514');
-- saveTx() depuis #6 : la ligne envoyée porte compte_id (+ compte_dest_id pour un mouvement)
select qa.cas('#6 saveTx insert sortie sur un compte', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id,compte_dest_id,categorie_id,tricount,epingle,note)
     values ('aaaaaaaa-0000-0000-0000-000000000001','Courses #6',12.5,'sortie','2026-10-03','10000000-0000-0000-0000-00000000000a',null,'c0000000-0000-0000-0000-000000000001','non',true,null)$q$);
select qa.cas('#6 saveTx insert mouvement Livret A -> Livret DD (sans catégorie)', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id,compte_dest_id,categorie_id,tricount,epingle,note)
     values ('aaaaaaaa-0000-0000-0000-000000000001','Mouvement #6',100,'mouvement','2026-10-04','10000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-00000000000a',null,'non',true,null)$q$);
select qa.cas('#6 saveTx mouvement même compte Depuis/Vers : refusé', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id,compte_dest_id,categorie_id,tricount,epingle,note)
     values ('aaaaaaaa-0000-0000-0000-000000000001','x',10,'mouvement','2026-10-04','10000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-00000000000a',null,'non',true,null)$q$, '23514');
select qa.cas('#6 saveTx update mouvement -> sortie (compte_dest_id remis à null)', 'authenticated', :A,
  $q$update public.transactions set description='Mouvement #6 devenu sortie',montant=100,type='sortie',date='2026-10-04',compte_id='10000000-0000-0000-0000-00000000000a',compte_dest_id=null,categorie_id=null,tricount='non',epingle=true,note=null
     where description='Mouvement #6'$q$);
select qa.cas('#6 saveTx update sortie -> mouvement', 'authenticated', :A,
  $q$update public.transactions set type='mouvement',compte_id='10000000-0000-0000-0000-00000000000a',compte_dest_id='30000000-0000-0000-0000-00000000000a',categorie_id=null,tricount='non'
     where description='Mouvement #6 devenu sortie'$q$);
select qa.cas('#6 saveTx update ancienne tx en gardant « Aucun compte »', 'authenticated', :A,
  $q$update public.transactions set description='tx 11 modif',montant=3,type='sortie',date='2026-09-11',compte_id=null,compte_dest_id=null,categorie_id=null,tricount='non',epingle=false,note=null
     where description='tx 11'$q$);
select qa.cas('Épingler depuis la liste (l.965)', 'authenticated', :A,
  $q$update public.transactions set epingle=true where id=(select id from public.transactions where description='tx 8')$q$);
select qa.cas('Valider le Tricount depuis la liste (l.975)', 'authenticated', :A,
  $q$update public.transactions set tricount='oui validé' where id=(select id from public.transactions where description='tx 8')$q$);
select qa.cas('Supprimer une transaction (l.671)', 'authenticated', :A,
  $q$delete from public.transactions where id=(select id from public.transactions where description='tx 9')$q$);

-- ───────── Catégories : saveCat(), deleteCat() ─────────
select qa.cas('saveCat insert (l.726)', 'authenticated', :A,
  $q$insert into public.categories (user_id,nom,type,emoji) values ('aaaaaaaa-0000-0000-0000-000000000001','Loisirs','les deux','🎭')$q$);
select qa.cas('saveCat update (l.724)', 'authenticated', :A,
  $q$update public.categories set nom='Courses bis',emoji='🛒' where id='c0000000-0000-0000-0000-000000000001'$q$);
select qa.cas('deleteCat d''une catégorie utilisée : accepté, transactions gardées sans catégorie (l.732)', 'authenticated', :A,
  $q$do $x$ begin delete from public.categories where id='c0000000-0000-0000-0000-000000000001';
     if exists (select 1 from public.transactions where categorie_id='c0000000-0000-0000-0000-000000000001') then raise exception 'catégorie encore référencée'; end if;
     if (select count(*) from public.transactions where description like 'tx %') < 50 then raise exception 'transactions supprimées'; end if; end $x$$q$);

-- ───────── Comptes : saveCompte(), deleteCompteFromModal() ─────────
select qa.cas('saveCompte insert livret (l.759)', 'authenticated', :A,
  $q$insert into public.comptes (user_id,nom,banque,type,couleur) values ('aaaaaaaa-0000-0000-0000-000000000001','LEP','','livret','#5B6EF5')$q$);
select qa.cas('saveCompte update (l.757)', 'authenticated', :A,
  $q$update public.comptes set nom='Livret A bis',banque='BNP',type='livret',couleur='#000000' where id='10000000-0000-0000-0000-00000000000a'$q$);
select qa.cas('deleteCompte sans opération, soldes en cascade (l.765)', 'authenticated', :A,
  $q$delete from public.comptes where id='20000000-0000-0000-0000-00000000000a'$q$);
select qa.cas('deleteCompte avec opération : refusé (message affiché par le front depuis #8)', 'authenticated', :A,
  $q$do $x$ begin update public.transactions set compte_id='30000000-0000-0000-0000-00000000000a' where description='tx 10';
     delete from public.comptes where id='30000000-0000-0000-0000-00000000000a'; end $x$$q$, '23503');

-- #8 : saveCompte envoie toutes les colonnes de la modale ; compte par défaut changé en deux requêtes
select qa.cas('#8 saveCompte insert courant complet, par défaut (aucun défaut existant)', 'authenticated', :A,
  $q$insert into public.comptes (user_id,nom,banque,type,couleur,solde_initial,date_solde_initial,plafond,par_defaut)
     values ('aaaaaaaa-0000-0000-0000-000000000001','TEST QA L''épargne <b>&</b>','Banque <i>fictive</i>','courant','#14B8A6',-35.5,'2026-09-30',null,true)$q$);
select qa.cas('#8 saveCompte insert especes, plafond renseigné', 'authenticated', :A,
  $q$insert into public.comptes (user_id,nom,banque,type,couleur,solde_initial,date_solde_initial,plafond,par_defaut)
     values ('aaaaaaaa-0000-0000-0000-000000000001','Espèces QA','','especes','#5B6EF5',40,'2026-09-30',500,false)$q$);
select qa.cas('#8 saveCompte update investissement avec plafond', 'authenticated', :A,
  $q$update public.comptes set nom='Bitcoin',banque='',type='investissement',couleur='#8B5CF6',solde_initial=4950,date_solde_initial='2026-09-30',plafond=10000,par_defaut=false
     where id='30000000-0000-0000-0000-00000000000a'$q$);
select qa.cas('#8 changer de défaut en UNE requête : refusé (pourquoi le front en fait deux)', 'authenticated', :A,
  $q$update public.comptes set nom='Livret A bis',banque='BNP',type='livret',couleur='#000000',solde_initial=0,date_solde_initial=null,plafond=22950,par_defaut=true
     where id='10000000-0000-0000-0000-00000000000a'$q$, '23505');
select qa.cas('#8 changer de défaut en DEUX requêtes : un seul compte par défaut ensuite', 'authenticated', :A,
  $q$do $x$ begin
     update public.comptes set par_defaut=false where id=(select id from public.comptes where nom='TEST QA L''épargne <b>&</b>');
     update public.comptes set nom='Livret A bis',banque='BNP',type='livret',couleur='#000000',solde_initial=0,date_solde_initial=null,plafond=22950,par_defaut=true
       where id='10000000-0000-0000-0000-00000000000a';
     if (select count(*) from public.comptes where par_defaut) <> 1 then raise exception 'pas exactement un compte par défaut'; end if;
     if not (select par_defaut from public.comptes where id='10000000-0000-0000-0000-00000000000a') then raise exception 'mauvais compte par défaut'; end if;
     end $x$$q$);
select qa.cas('#8 nouveau compte par défaut en deux requêtes (retrait puis insert)', 'authenticated', :A,
  $q$do $x$ begin
     update public.comptes set par_defaut=false where id='10000000-0000-0000-0000-00000000000a';
     insert into public.comptes (user_id,nom,banque,type,couleur,solde_initial,date_solde_initial,plafond,par_defaut)
       values ('aaaaaaaa-0000-0000-0000-000000000001','Courant QA 2','','courant','#5B6EF5',0,'2026-09-30',null,true);
     if (select count(*) from public.comptes where par_defaut) <> 1 then raise exception 'pas exactement un compte par défaut'; end if;
     end $x$$q$);
select qa.cas('#8 saveCompte type vide : refusé (message affiché par le front)', 'authenticated', :A,
  $q$update public.comptes set type='' where id='10000000-0000-0000-0000-00000000000a'$q$, '23514');
select qa.cas('#8 saveCompte plafond 0 : refusé (le front le bloque avant envoi)', 'authenticated', :A,
  $q$update public.comptes set plafond=0 where id='10000000-0000-0000-0000-00000000000a'$q$, '23514');
select qa.cas('#8 la vue suit les nouveaux comptes : solde calculé = solde initial sans opération', 'authenticated', :A,
  $q$do $x$ begin
     if (select solde_calcule from public.v_soldes_comptes where nom='TEST QA L''épargne <b>&</b>') <> -35.5 then raise exception 'solde calculé'; end if;
     if (select dernier_solde_banque from public.v_soldes_comptes where nom='Espèces QA') is not null then raise exception 'relevé inattendu'; end if;
     end $x$$q$);

-- ───────── Soldes : saveSoldeEntry() (upsert), deleteSoldeEntry() ─────────
select qa.cas('saveSoldeEntry upsert onConflict compte_id,date : nouveau (l.787)', 'authenticated', :A,
  $q$insert into public.soldes (user_id,compte_id,date,montant,note) values ('aaaaaaaa-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000a','2026-10-31',160,'')
     on conflict (compte_id,date) do update set user_id=excluded.user_id,compte_id=excluded.compte_id,date=excluded.date,montant=excluded.montant,note=excluded.note$q$);
select qa.cas('saveSoldeEntry upsert : même date, mise à jour (l.787)', 'authenticated', :A,
  $q$do $x$ begin insert into public.soldes (user_id,compte_id,date,montant,note) values ('aaaaaaaa-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000a','2026-10-31',170,'corrigé')
     on conflict (compte_id,date) do update set user_id=excluded.user_id,compte_id=excluded.compte_id,date=excluded.date,montant=excluded.montant,note=excluded.note;
     if (select montant from public.soldes where compte_id='10000000-0000-0000-0000-00000000000a' and date='2026-10-31') <> 170 then raise exception 'upsert'; end if; end $x$$q$);
select qa.cas('deleteSoldeEntry par id (l.795)', 'authenticated', :A,
  $q$delete from public.soldes where id=(select id from public.soldes where compte_id='10000000-0000-0000-0000-00000000000a' and date='2026-08-31')$q$);

-- ───────── Statistiques ─────────
-- Calculées côté JS à partir de loadTransactions, en excluant les mouvements.
-- On vérifie que montant reste sérialisé en nombre JSON (le JS fait des additions dessus).
select qa.cas('Stats : somme du mois hors mouvements', 'authenticated', :A,
  $q$select type, sum(montant) from public.transactions where type<>'mouvement' and to_char(date,'YYYY-MM')='2026-10' group by type$q$);
select qa.cas('montant sérialisé en nombre JSON', 'authenticated', :A,
  $q$do $x$ begin if (select json_typeof(to_json(montant)) from public.transactions limit 1) <> 'number' then raise exception 'pas un nombre'; end if; end $x$$q$);

-- ───────── Contrôles de sécurité complémentaires ─────────
select qa.cas('A ne peut pas donner son compte à B (comptes.user_id, RLS)', 'authenticated', :A,
  $q$update public.comptes set user_id='bbbbbbbb-0000-0000-0000-000000000002' where id='10000000-0000-0000-0000-00000000000a'$q$, '42501');
select qa.cas('Appel direct de la fonction trigger impossible', 'authenticated', :A,
  $q$select public.transactions_verifier_comptes()$q$, '0A000');
