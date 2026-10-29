# Revenir à l'app initiale (v1, avant refonte)

Sauvegarde faite le 29/10/2026, avant la refonte multi-comptes.

| Quoi | Où |
|---|---|
| Code | branche Git `sauvegarde/v1` (commit `c592da4`, identique à `main` à cette date). La branche `sauvegarde/v1.0-avant-refonte` est un doublon au même commit, supprimable. |
| Structure de la base | `docs/sauvegarde/schema-v1.sql` |
| Données | schéma Supabase `backup_v1` : tables `categories` (19), `comptes` (3), `soldes` (5), `transactions` (58) |

Le schéma `backup_v1` n'est pas exposé par l'API Supabase : l'app ne le voit pas et il ne gêne en rien.

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

À lancer dans l'éditeur SQL Supabase, **après** avoir restauré le code (l'ancien code ne connaît pas les nouvelles colonnes, mais il les ignore sans problème).

```sql
begin;
-- Supprimer les tables ajoutées par la refonte si besoin (cagnottes, budgets, rapprochements…)
-- drop table if exists public.cagnotte_mouvements, public.cagnottes, public.budgets, public.recurrences, public.rapprochements;

delete from public.transactions;
delete from public.soldes;
delete from public.comptes;
delete from public.categories;

insert into public.categories   (select * from backup_v1.categories);
insert into public.comptes      (id, user_id, nom, type, banque, couleur, created_at)
  select id, user_id, nom, type, banque, couleur, created_at from backup_v1.comptes;
insert into public.soldes       (select * from backup_v1.soldes);
insert into public.transactions (id, user_id, description, montant, type, categorie_id, date, created_at, compte_id, direction, tricount, epingle, note)
  select id, user_id, description, montant, type, categorie_id, date, created_at, compte_id, direction, tricount, epingle, note from backup_v1.transactions;
commit;
```

Si des contraintes ajoutées par la refonte bloquent l'insertion (par exemple un `type` de compte restreint), les supprimer avant, ou restaurer seulement les tables concernées.

⚠️ Une restauration des données efface tout ce qui a été saisi depuis le 29/10/2026. Pour garder les nouvelles saisies, ne restaurer que le code.

## Avant chaque nouvelle étape

Refaire une copie : branche `sauvegarde/v<n>` et schéma `backup_v<n>` (`create table backup_v<n>.<table> as table public.<table>`, puis `revoke all on schema backup_v<n> from anon, authenticated`). C'est une tâche du ticket de préparation de chaque milestone. Aucun agent n'écrit dans `sauvegarde/*` ni `backup_v*`.

## Supprimer la sauvegarde (plus tard, quand la refonte est stable)

```sql
drop schema backup_v1 cascade;
```
