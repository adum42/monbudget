# Revenir à l'app initiale (v1, avant refonte)

Sauvegarde faite le 29/10/2026, avant la refonte multi-comptes.

| Quoi | Où |
|---|---|
| Code | branche Git `sauvegarde/v1` (commit `c592da4`, identique à `main` à cette date). La branche `sauvegarde/v1.0-avant-refonte` est un doublon au même commit, supprimable. |
| Structure de la base | `docs/sauvegarde/schema-v1.sql` |
| Données | schéma Supabase `backup_v1` : tables `categories` (19), `comptes` (3), `soldes` (5), `transactions` (58) |

Le schéma `backup_v1` n'est pas exposé par l'API Supabase : l'app ne le voit pas et il ne gêne en rien.

**Quelle base ?** Il existe deux projets Supabase : **PROD** « budget-app » (`artvpflfhvouyngzgqob`) et **TEST** « monbudget-test » (`ebupazakzfbpptmlrzze`, données fictives). La sauvegarde `backup_v1` et la restauration des données concernent **la prod uniquement** : vérifier le nom du projet dans le dashboard avant de lancer la moindre requête. La base test ne contient pas `backup_v1`.

**Reconstruire la base test** (elle ne contient que des données fictives, rien n'y est sauvegardé) : nouveau projet Supabase, puis appliquer dans l'ordre `supabase/bootstrap/01` à `04`, puis toutes les migrations de `supabase/migrations/` selon la procédure de `supabase/README.md`, refaire la configuration Auth et l'utilisateur de test (`supabase/README.md`, section *Auth*), et recharger le jeu de données fictives de #21. Si l'identifiant du projet change, mettre à jour `index.html` (#20) et la doc.

## Restaurer le code

Remettre l'ancien `index.html` sur `main` (l'historique est conservé) :

```bash
git checkout main
git checkout sauvegarde/v1 -- index.html   # remet l'ancien index.html
git commit -m "revert: retour à l'app v1"
git push                                     # Vercel redéploie automatiquement
```

Option d'urgence, encore plus rapide : dans Vercel → *Deployments*, choisir le déploiement du commit `c592da4` → *Promote to Production*. L'app revient en ligne en quelques secondes, sans toucher au repo.

## Restaurer les données

À lancer dans l'éditeur SQL du projet **PROD** « budget-app », **après** avoir restauré le code.

La requête ci-dessous fonctionne avec le schéma actuel (après #3) **sans modifier la structure** :
- `backup_v1` contient encore la colonne `transactions.direction`, supprimée de `public` par #3 : elle n'est pas recopiée (ses valeurs étaient toutes vides) ;
- les colonnes ajoutées par #3 (`comptes.solde_initial`, `date_solde_initial`, `par_defaut`, `plafond`, `transactions.compte_dest_id`) ne sont pas listées et prennent leur valeur par défaut (0, vide, faux, vide, vide) ;
- les colonnes sont toujours nommées explicitement : pas de `select *`, qui dépend de l'ordre des colonnes ;
- l'ancien code (v1) n'utilise pas `direction` et ignore les nouvelles colonnes : il fonctionne avec ce schéma.

```sql
begin;
-- Supprimer les tables ajoutées par la refonte si besoin (cagnottes, budgets, rapprochements…)
-- drop table if exists public.cagnotte_mouvements, public.cagnottes, public.budgets, public.recurrences, public.rapprochements;

-- Ordre imposé : les transactions d'abord (FK compte_id / compte_dest_id en restrict depuis #3).
delete from public.transactions;
delete from public.soldes;
delete from public.comptes;
delete from public.categories;

insert into public.categories   (id, user_id, nom, type, couleur, created_at, emoji)
  select id, user_id, nom, type, couleur, created_at, emoji from backup_v1.categories;
insert into public.comptes      (id, user_id, nom, type, banque, couleur, created_at)
  select id, user_id, nom, type, banque, couleur, created_at from backup_v1.comptes;
insert into public.soldes       (id, user_id, compte_id, date, montant, note, created_at)
  select id, user_id, compte_id, date, montant, note, created_at from backup_v1.soldes;
-- backup_v1.transactions.direction n'est pas recopiée : la colonne n'existe plus dans public.
insert into public.transactions (id, user_id, description, montant, type, categorie_id, date, created_at, compte_id, tricount, epingle, note)
  select id, user_id, description, montant, type, categorie_id, date, created_at, compte_id, tricount, epingle, note from backup_v1.transactions;
commit;
```

Les contraintes ajoutées par #3 ne bloquent pas l'insertion : tous les montants de `backup_v1.transactions` sont strictement positifs (vérifié le 29/10/2026), aucune transaction n'a de compte (le trigger `transactions_verifier_comptes` et la contrainte des mouvements n'ont donc rien à refuser) et les types de compte `livret` / `investissement` restent autorisés. Si une contrainte ajoutée par une étape ultérieure bloque l'insertion, l'adapter ou restaurer seulement les tables concernées ; ne jamais modifier le contenu de `backup_v1`.

⚠️ Une restauration des données efface tout ce qui a été saisi depuis le 29/10/2026. Pour garder les nouvelles saisies, ne restaurer que le code.

## Avant chaque nouvelle étape

Refaire une copie : branche `sauvegarde/v<n>` et schéma `backup_v<n>` (`create table backup_v<n>.<table> as table public.<table>`, puis `revoke all on schema backup_v<n> from anon, authenticated`). C'est une tâche du ticket de préparation de chaque milestone. Aucun agent n'écrit dans `sauvegarde/*` ni `backup_v*`.

## Supprimer la sauvegarde (plus tard, quand la refonte est stable)

```sql
drop schema backup_v1 cascade;
```
