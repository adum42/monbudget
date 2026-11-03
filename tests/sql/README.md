# Tests SQL des migrations (#25)

Ces tests vérifient que la base fait ce qu'on attend d'elle **après toutes les migrations** : ce qui doit être accepté l'est, ce qui doit être refusé l'est **pour la bonne raison** (contrainte, RLS, trigger…). Ils tournent sur un **Postgres jetable** : aucun projet Supabase, aucune donnée réelle, aucun secret.

Ils sont lancés automatiquement par GitHub Actions (job `tests-sql` de `.github/workflows/tests.yml`) à chaque pull request et après chaque merge sur `main`. Une PR dont le job est rouge ne doit pas être mergée.

## Ce que fait `run.sh`

Pour **chaque** fichier de `cas/`, sur une base **neuve** (les fichiers ne dépendent pas les uns des autres) :

| Étape | Fichier | Rôle |
|---|---|---|
| 1 | `socle/00_supabase.sql` | Ce que Supabase fournit d'office : rôles `anon` / `authenticated` / `service_role`, table `auth.users` réduite, fonction `auth.uid()`, droits par défaut |
| 2 | `supabase/bootstrap/*.sql` | Le schéma de la prod **avant** les migrations versionnées |
| 3 | `socle/10_donnees.sql` | Données fictives : utilisateurs `a@test` (A) et `b@test` (B), leurs comptes, 58 transactions, des soldes |
| 4 | `supabase/migrations/*.sql` | **Toutes** les migrations, dans l'ordre alphabétique des noms (donc chronologique grâce au préfixe `AAAAMMJJHHMM`), chacune dans une transaction comme en prod |
| 5 | `socle/20_harnais.sql` | La fonction `qa.cas(...)` et la table `qa.resultats` |
| 6 | `cas/<fichier>.sql` | Les cas de test |

Les données sont chargées **avant** les migrations : une migration qui échouerait sur une base déjà remplie (nouvelle contrainte violée par une ligne existante…) fait échouer le job, comme elle échouerait en prod.

**Ajouter une migration** dans `supabase/migrations/` suffit pour qu'elle soit rejouée : rien à changer dans le workflow ni dans `run.sh`.

## Lancer en local

Il faut un Postgres 15 à 17 et un utilisateur superutilisateur. Le plus simple, avec Docker :

```bash
docker run -d --name pg-tests -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:17
PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres tests/sql/run.sh
```

Un seul fichier : `tests/sql/run.sh cas/ticket03_comptes_virements.sql`.

`run.sh` détruit et recrée la base `monbudget_tests` (nom modifiable avec `BASE_TESTS`) : **ne jamais** lui donner l'adresse d'une vraie base.

## Écrire un cas

Un cas = un appel à `qa.cas` dans un fichier de `cas/` :

```sql
select qa.cas(
  'Montant négatif refusé',                    -- 1. ce qu'on vérifie, lisible dans le log
  'authenticated',                             -- 2. qui fait la requête
  'aaaaaaaa-0000-0000-0000-000000000001',      -- 3. utilisateur connecté (A), null si personne
  $q$insert into public.transactions (user_id,description,montant,type,date)
     values ('aaaaaaaa-0000-0000-0000-000000000001','x',-12,'sortie','2026-10-01')$q$,  -- 4. la requête
  '23514'                                      -- 5. résultat attendu
);
```

1. **Rôle** (2e argument) : `authenticated` (utilisateur connecté), `anon` (visiteur non connecté), `service_role` (clé serveur, ignore la RLS) ou `postgres` (administrateur, pour lire les catalogues).
2. **Résultat attendu** (5e argument) : `'ok'` (par défaut, on peut l'omettre) si la requête doit passer, sinon le **code d'erreur Postgres** (SQLSTATE) qu'elle doit produire :

| Code | Signification | Exemple |
|---|---|---|
| `23514` | contrainte `check` violée | montant négatif, mouvement sans destination |
| `23503` | clé étrangère, ou compte d'un autre utilisateur (trigger) | supprimer un compte qui porte des opérations |
| `23505` | doublon sur un index unique | deux comptes par défaut |
| `42501` | refusé par la RLS | A modifie une ligne pour la donner à B |
| `22003` | nombre trop grand | montant de 10 milliards |

   Préciser le code, et pas seulement « ça doit échouer », c'est ce qui prouve que la requête est refusée **pour la bonne raison**.
3. **Vérifier une valeur** : écrire un bloc `do` qui lève une exception si la valeur est fausse ; le cas attendu est alors `'ok'`.

   ```sql
   select qa.cas('Type par défaut = courant', 'authenticated', 'aaaaaaaa-0000-0000-0000-000000000001',
     $q$do $x$ begin
          insert into public.comptes (user_id,nom) values ('aaaaaaaa-0000-0000-0000-000000000001','Sans type');
          if (select type from public.comptes where nom='Sans type') <> 'courant' then raise exception 'type par défaut faux'; end if;
        end $x$ $q$);
   ```
4. **L'ordre compte** : un cas qui réussit laisse ses effets (ligne créée, supprimée…) pour les cas suivants du même fichier. Un cas qui échoue n'a aucun effet.

Pour un nouveau ticket de base de données, créer `cas/ticketNN_<sujet>.sql` (Sylvie écrit les cas avec sa migration, Quentin les relit). Quand le front ajoute ou modifie une requête `sb.from(...)`, mettre à jour `cas/front_non_regression.sql`.

## Lire un échec

Dans le log du job (onglet *Checks* de la PR, puis `tests-sql`), chaque cas a une ligne `OK` ou `KO`. Les échecs sont repris à la fin de chaque fichier, avec le code attendu, le code obtenu et le message de Postgres :

```
KO   27  Montant négatif refusé
── Échecs (1) :
  #27 Montant négatif refusé
      attendu : 23514   obtenu : ok   (1 ligne(s))
```

Ici la requête est **passée** (`obtenu : ok`) alors qu'elle devait être refusée par une contrainte `check` : la contrainte `montant > 0` a disparu. Les échecs apparaissent aussi en annotations rouges dans l'onglet *Files changed* de la PR.

Deux autres situations possibles :

- **`KO  erreur SQL dans supabase/migrations/… :`** suivi du message de Postgres : la migration elle-même ne s'applique pas (faute de frappe, objet inexistant, donnée existante qui viole une nouvelle contrainte). Les cas de ce fichier ne sont pas lancés.
- **`KO  erreur SQL dans tests/sql/cas/… :`** : le fichier de tests est mal écrit (guillemets, `$q$` non fermé…).

## Limites

- Le schéma `auth` est réduit à l'essentiel : un cas qui dépendrait d'autres colonnes de `auth.users` ou d'autres fonctions Supabase doit d'abord les ajouter dans `socle/00_supabase.sql`.
- Ces tests vérifient la base, pas l'écran : les parcours dans le navigateur sont couverts par les tests Playwright (#9).
- Les cas `ÉCART #24` de `cas/ticket03_comptes_virements.sql` décrivent un trou de sécurité **connu et accepté pour l'instant** (solde ou catégorie rattachés à un objet d'un autre utilisateur) : quand #24 sera livré, leur attendu passera de `'ok'` à `'23503'`.
