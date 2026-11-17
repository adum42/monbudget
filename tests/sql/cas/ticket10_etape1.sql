-- Tests du ticket #10 : validation de l'étape 1 (multi-comptes), côté base.
-- Le scénario du ticket rejoué en SQL, sur la vue v_soldes_comptes (#5, recréée par #68) :
--   1. créer un compte courant (et un livret pour le virement) ;
--   2. saisir une dépense : le solde calculé baisse ;
--   3. saisir un solde banque égal au solde calculé : écart nul, relevé du jour (voyant vert côté écran) ;
--   4. saisir un virement interne en deux opérations (sortie + entrée, catégorie « Mouvement de compte ») :
--      les deux soldes bougent, le patrimoine (somme des soldes calculés) ne bouge pas, et
--      entrées − sorties de la catégorie valent 0 (indicateur #70) ;
--   5. non-régression : isolement entre utilisateurs (RLS), contrôle d'appartenance (#24),
--      suppression d'un compte qui porte des opérations refusée (#3).
-- Les calculs côté écran (voyant, patrimoine, indicateur, sous-total) sont testés par
-- tests/front/ticket10_etape1.test.js et tests/e2e/etape1.spec.js.
--
-- Utilisateurs : A = aaaaaaaa-…-01, B = bbbbbbbb-…-02 (voir tests/sql/socle/10_donnees.sql).
-- « Virement interne » de A (c0…a8) est cochée « Mouvement de compte » par la migration #68.
-- Comptes créés ici (A) : f1… « Courant #10 » (1 000 au 31/10/2026), f2… « Livret #10 » (200 au 31/10/2026).
-- Le relevé est daté du jour (current_date) : nb_jours_depuis_releve = 0, comme une saisie du jour.
-- Les autres dates sont fixes (31/10 et 02/11/2026) : le scénario suppose current_date postérieur
-- au 02/11/2026, ce qui est le cas depuis l'écriture de ces cas (17/11/2026).
-- Attention : les cas qui réussissent modifient la base pour les cas suivants (l'ordre compte).

\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set B '''bbbbbbbb-0000-0000-0000-000000000002'''

-- ───────── 1. Créer un compte courant ─────────
select qa.cas('Créer un compte courant (type par défaut courant) et un livret', 'authenticated', :A,
  $q$insert into public.comptes (id,user_id,nom,solde_initial,date_solde_initial) values
     ('f1000000-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001','Courant #10',1000,'2026-10-31');
     insert into public.comptes (id,user_id,nom,type,solde_initial,date_solde_initial) values
     ('f2000000-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001','Livret #10','livret',200,'2026-10-31')$q$);
select qa.cas('Le compte créé sans type est un compte courant', 'authenticated', :A,
  $q$do $x$ begin
     if (select type from public.comptes where id='f1000000-0000-0000-0000-00000000000a') <> 'courant'
       then raise exception 'type = %', (select type from public.comptes where id='f1000000-0000-0000-0000-00000000000a'); end if; end $x$ $q$);
select qa.cas('Compte neuf : solde calculé = solde initial (1 000), aucun relevé', 'authenticated', :A,
  $q$do $x$ declare l record; begin
     select * into l from public.v_soldes_comptes where compte_id='f1000000-0000-0000-0000-00000000000a';
     if l.solde_calcule is distinct from 1000 or l.dernier_solde_banque is not null or l.ecart is not null
       then raise exception 'solde %, relevé %, écart %', l.solde_calcule, l.dernier_solde_banque, l.ecart; end if; end $x$ $q$);

-- ───────── 2. Saisir une dépense ─────────
select qa.cas('Dépense de 42,50 sur le compte courant', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id,categorie_id) values
     ('aaaaaaaa-0000-0000-0000-000000000001','#10 dépense',42.50,'sortie','2026-11-02',
      'f1000000-0000-0000-0000-00000000000a','c0000000-0000-0000-0000-000000000001')$q$);
select qa.cas('Après la dépense : solde calculé = 957,50', 'authenticated', :A,
  $q$do $x$ declare v numeric; begin
     select solde_calcule into v from public.v_soldes_comptes where compte_id='f1000000-0000-0000-0000-00000000000a';
     if v is distinct from 957.50 then raise exception 'solde_calcule = %', v; end if; end $x$ $q$);
select qa.cas('Une opération datée avant le solde initial n''entre pas dans le solde', 'authenticated', :A,
  $q$do $x$ declare v numeric; begin
     insert into public.transactions (user_id,description,montant,type,date,compte_id) values
       ('aaaaaaaa-0000-0000-0000-000000000001','#10 avant le solde initial',999,'sortie','2026-10-30','f1000000-0000-0000-0000-00000000000a');
     select solde_calcule into v from public.v_soldes_comptes where compte_id='f1000000-0000-0000-0000-00000000000a';
     if v is distinct from 957.50 then raise exception 'solde_calcule = %', v; end if;
     delete from public.transactions where description='#10 avant le solde initial'; end $x$ $q$);

-- ───────── 3. Saisir un solde banque égal ─────────
select qa.cas('Relevé du jour égal au solde calculé (957,50)', 'authenticated', :A,
  $q$insert into public.soldes (user_id,compte_id,date,montant) values
     ('aaaaaaaa-0000-0000-0000-000000000001','f1000000-0000-0000-0000-00000000000a',current_date,957.50)$q$);
select qa.cas('Relevé égal : écart 0, relevé de 0 jour (voyant « ✓ rapproché » côté écran)', 'authenticated', :A,
  $q$do $x$ declare l record; begin
     select * into l from public.v_soldes_comptes where compte_id='f1000000-0000-0000-0000-00000000000a';
     if l.dernier_solde_banque is distinct from 957.50 or l.solde_calcule_a_date_banque is distinct from 957.50
        or l.ecart is distinct from 0 or l.nb_jours_depuis_releve is distinct from 0
       then raise exception 'banque %, calculé à date %, écart %, jours %',
         l.dernier_solde_banque, l.solde_calcule_a_date_banque, l.ecart, l.nb_jours_depuis_releve; end if; end $x$ $q$);
select qa.cas('Patrimoine avant le virement : 957,50 + 200 = 1 157,50', 'authenticated', :A,
  $q$do $x$ declare v numeric; begin
     select sum(solde_calcule) into v from public.v_soldes_comptes
     where compte_id in ('f1000000-0000-0000-0000-00000000000a','f2000000-0000-0000-0000-00000000000a');
     if v is distinct from 1157.50 then raise exception 'patrimoine = %', v; end if; end $x$ $q$);

-- ───────── 4. Virement interne en deux opérations ─────────
select qa.cas('Virement de 100 : sortie du courant + entrée sur le livret, catégorie « Mouvement de compte »', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id,categorie_id) values
     ('aaaaaaaa-0000-0000-0000-000000000001','#10 virement',100,'sortie',current_date,
      'f1000000-0000-0000-0000-00000000000a','c0000000-0000-0000-0000-0000000000a8'),
     ('aaaaaaaa-0000-0000-0000-000000000001','#10 virement',100,'entrée',current_date,
      'f2000000-0000-0000-0000-00000000000a','c0000000-0000-0000-0000-0000000000a8')$q$);
select qa.cas('Les deux soldes bougent : courant 857,50, livret 300', 'authenticated', :A,
  $q$do $x$ declare c numeric; l numeric; begin
     select solde_calcule into c from public.v_soldes_comptes where compte_id='f1000000-0000-0000-0000-00000000000a';
     select solde_calcule into l from public.v_soldes_comptes where compte_id='f2000000-0000-0000-0000-00000000000a';
     if c is distinct from 857.50 or l is distinct from 300 then raise exception 'courant %, livret %', c, l; end if; end $x$ $q$);
select qa.cas('Le patrimoine ne bouge pas avec le virement (1 157,50)', 'authenticated', :A,
  $q$do $x$ declare v numeric; begin
     select sum(solde_calcule) into v from public.v_soldes_comptes
     where compte_id in ('f1000000-0000-0000-0000-00000000000a','f2000000-0000-0000-0000-00000000000a');
     if v is distinct from 1157.50 then raise exception 'patrimoine = %', v; end if; end $x$ $q$);
select qa.cas('Virement daté du jour du relevé : compté à la date du relevé, écart +100 tant que le relevé n''est pas corrigé', 'authenticated', :A,
  $q$do $x$ declare l record; begin
     select * into l from public.v_soldes_comptes where compte_id='f1000000-0000-0000-0000-00000000000a';
     -- Le relevé est du jour et le virement aussi : le solde calculé à la date du relevé l'inclut.
     -- Le relevé de 957,50 ne correspond donc plus : l'écart devient +100 (la banque n'a pas encore le virement).
     if l.solde_calcule_a_date_banque is distinct from 857.50 or l.ecart is distinct from 100
       then raise exception 'calculé à date %, écart %', l.solde_calcule_a_date_banque, l.ecart; end if; end $x$ $q$);
select qa.cas('Relevé corrigé à 857,50 (même date : remplace l''ancien) -> écart 0', 'authenticated', :A,
  $q$do $x$ declare l record; begin
     insert into public.soldes (user_id,compte_id,date,montant) values
       ('aaaaaaaa-0000-0000-0000-000000000001','f1000000-0000-0000-0000-00000000000a',current_date,857.50)
     on conflict (compte_id,date) do update set montant=excluded.montant;
     select * into l from public.v_soldes_comptes where compte_id='f1000000-0000-0000-0000-00000000000a';
     if l.dernier_solde_banque is distinct from 857.50 or l.ecart is distinct from 0
       then raise exception 'banque %, écart %', l.dernier_solde_banque, l.ecart; end if;
     if (select count(*) from public.soldes where compte_id='f1000000-0000-0000-0000-00000000000a') <> 1
       then raise exception 'un seul relevé attendu pour cette date'; end if; end $x$ $q$);
select qa.cas('Indicateur #70 : entrées − sorties de la catégorie cochée = 0', 'authenticated', :A,
  $q$do $x$ declare v numeric; begin
     select coalesce(sum(case t.type when 'entrée' then t.montant else -t.montant end),0) into v
     from public.transactions t join public.categories c on c.id=t.categorie_id
     where c.mouvement_compte and t.description='#10 virement';
     if v is distinct from 0 then raise exception 'total = %', v; end if; end $x$ $q$);
select qa.cas('Une seule catégorie cochée « Mouvement de compte » chez A, et c''est « Virement interne »', 'authenticated', :A,
  $q$do $x$ declare n int; nom text; begin
     select count(*), min(categories.nom) into n, nom from public.categories where mouvement_compte;
     if n <> 1 or nom <> 'Virement interne' then raise exception '% cochée(s) : %', n, nom; end if; end $x$ $q$);
select qa.cas('Le type mouvement n''existe plus (#68) : refusé', 'authenticated', :A,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id) values
     ('aaaaaaaa-0000-0000-0000-000000000001','#10 mouvement',10,'mouvement',current_date,'f1000000-0000-0000-0000-00000000000a')$q$,
  '23514');

-- ───────── 5. Non-régression : isolement et appartenance ─────────
select qa.cas('B ne voit ni les comptes ni les opérations de #10', 'authenticated', :B,
  $q$do $x$ begin
     if exists (select 1 from public.v_soldes_comptes where compte_id in ('f1000000-0000-0000-0000-00000000000a','f2000000-0000-0000-0000-00000000000a'))
        or exists (select 1 from public.transactions where description like '#10 %')
        or exists (select 1 from public.soldes where compte_id='f1000000-0000-0000-0000-00000000000a')
       then raise exception 'données de A visibles par B'; end if; end $x$ $q$);
select qa.cas('B ne peut pas saisir une opération sur le compte de A (#3)', 'authenticated', :B,
  $q$insert into public.transactions (user_id,description,montant,type,date,compte_id) values
     ('bbbbbbbb-0000-0000-0000-000000000002','#10 intrus',1,'sortie',current_date,'f1000000-0000-0000-0000-00000000000a')$q$,
  '23503');
select qa.cas('B ne peut pas saisir un relevé sur le compte de A (#24)', 'authenticated', :B,
  $q$insert into public.soldes (user_id,compte_id,date,montant) values
     ('bbbbbbbb-0000-0000-0000-000000000002','f1000000-0000-0000-0000-00000000000a','2026-11-01',1)$q$,
  '23503');
select qa.cas('B ne peut pas utiliser la catégorie « Virement interne » de A (#24)', 'authenticated', :B,
  $q$insert into public.transactions (user_id,description,montant,type,date,categorie_id) values
     ('bbbbbbbb-0000-0000-0000-000000000002','#10 intrus',1,'sortie',current_date,'c0000000-0000-0000-0000-0000000000a8')$q$,
  '23503');
select qa.cas('Supprimer le compte courant qui porte des opérations : refusé (FK restrict)', 'authenticated', :A,
  $q$delete from public.comptes where id='f1000000-0000-0000-0000-00000000000a'$q$,
  '23503');
select qa.cas('Nettoyage comme le ferait l''app : opérations, puis comptes (relevés supprimés en cascade)', 'authenticated', :A,
  $q$do $x$ begin
     delete from public.transactions where description like '#10 %';
     delete from public.comptes where id in ('f1000000-0000-0000-0000-00000000000a','f2000000-0000-0000-0000-00000000000a');
     if exists (select 1 from public.soldes where compte_id='f1000000-0000-0000-0000-00000000000a')
       then raise exception 'relevé resté après la suppression du compte'; end if; end $x$ $q$);
