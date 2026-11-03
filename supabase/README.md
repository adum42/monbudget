# Supabase : une migration, deux bases

| Environnement | Projet Supabase | `project_id` | Région | Données |
|---|---|---|---|---|
| **Prod** | `budget-app` | `artvpflfhvouyngzgqob` | `eu-central-1` | données réelles du chef de projet |
| **Test** | `monbudget-test` | `ebupazakzfbpptmlrzze` | `eu-central-1` | uniquement des données fictives |

URL de l'API de test : `https://ebupazakzfbpptmlrzze.supabase.co`. La clé `anon` / publishable est publique par nature (la sécurité repose sur la RLS) : elle est donnée dans le ticket #19. **Jamais** de clé `service_role`, de mot de passe de base ni de secret dans le repo ou les tickets.

Les deux projets sont sur le plan gratuit. Un projet gratuit inactif est mis en pause : on le relance en un clic dans le dashboard (*Restore project*).

## Auth

Configurée par le chef de projet le 29/10/2026 (inscription par email / mot de passe active sur les deux projets).

| | Test | Prod |
|---|---|---|
| *Site URL* | `http://localhost:3000` | `https://monbudget-lilac.vercel.app` |
| *Redirect URLs* | `https://*-adum.vercel.app/**`, `http://localhost:*/**` | `https://monbudget-lilac.vercel.app/**` |
| Utilisateur de test | créé par le chef de projet ; identifiants dans les secrets GitHub `TEST_EMAIL` / `TEST_PASSWORD` | — |

Aucun agent ne saisit ni ne lit de mot de passe.

## Procédure : une migration, deux bases

> **Décision du chef de projet du 02/11/2026 (#22, option 1).** L'outil MCP `apply_migration` n'est pas utilisé : le client annule automatiquement sa confirmation en 0,5 s, rien n'est exécuté. Le **chef de projet applique** chaque migration dans l'éditeur SQL du dashboard ; **Sylvie l'inscrit** dans l'historique avec une **version identique sur les deux bases, égale au préfixe `AAAAMMJJHHMM` du fichier**. Personne d'autre que le chef de projet n'écrit sur la prod. Évolution prévue après le sprint 1 : application automatique par GitHub Actions (#32).

1. **Écrire** (Sylvie) la migration dans `supabase/migrations/<AAAAMMJJHHMM>_<nom>.sql`. `<nom>` est le nom de migration (snake_case, explicite : `etape1_comptes_tous_types_virements`) ; `<AAAAMMJJHHMM>` est sa version, unique et croissante.
2. **Tester en local** (Sylvie, obligatoire) : sur un Postgres jetable, rejouer toutes les migrations de `supabase/migrations/` dans l'ordre des noms de fichiers, puis la nouvelle, avec des cas qui doivent réussir et des cas qui doivent échouer (harnais `tests/sql/` de #25 : `tests/sql/run.sh`, nouveau fichier `tests/sql/cas/ticketNN_<sujet>.sql`). **Quentin** valide (relecture du diff + rejeu local).
3. **Appliquer sur TEST** `ebupazakzfbpptmlrzze` (chef de projet) : ouvrir l'éditeur SQL du projet « monbudget-test », vérifier le nom du projet, coller le contenu **exact** du fichier **encadré par `begin;` … `commit;`** (l'éditeur ne fait pas de transaction automatique : sans cela, une erreur au milieu laisse la base à moitié migrée), exécuter.
4. **Inscrire et vérifier sur TEST** (Sylvie) : inscription dans l'historique (requête ci-dessous), structure lue dans les catalogues, `get_advisors` sécurité et performance, commentaire du ticket. **Quentin** revérifie sur TEST (écritures uniquement en transaction annulée ou sur des données préfixées `TEST` supprimées ensuite ; parcours connectés via la CI (#9) ou délégués au chef de projet sur la preview ; sans connexion, Quentin vérifie seulement le bandeau TEST et l'écran de connexion), puis commente **Validé** ou **Renvoyé**.
5. **Feu vert** du chef de projet, puis **appliquer sur PROD** `artvpflfhvouyngzgqob` : même geste qu'à l'étape 3 dans l'éditeur SQL du projet « budget-app », avec le **même fichier, sans aucune modification**. Si une sauvegarde est requise (migration qui transforme des données), le chef de projet l'exécute sur prod juste avant (voir `docs/RESTAURATION.md`).
6. **Inscrire et vérifier sur PROD** (Sylvie) : inscription avec **la même version et le même nom** qu'en test, `list_migrations` identique sur les deux projets (aux écarts historiques près, voir plus bas), empreinte des catalogues de `public` identique (requête [`empreinte_public.sql`](empreinte_public.sql), voir *Contrôle d'identité*), `get_advisors` sur prod. **Quentin** fait le même contrôle, en lecture seule.
7. **PR, puis merge** par le chef de projet. Une migration est en prod **avant** le merge du front qui en dépend.

### Inscription dans l'historique

Sur chaque base, une fois la migration appliquée (Sylvie, via `execute_sql` avec le `project_id` explicite) :

```sql
-- 1. Vérifier qu'elle n'est pas déjà inscrite
select version, name from supabase_migrations.schema_migrations where version = '<AAAAMMJJHHMM>' or name = '<nom>';
-- 2. L'inscrire : version = préfixe du fichier, name = <nom>, statements = contenu exact du fichier
insert into supabase_migrations.schema_migrations (version, name, statements)
values ('<AAAAMMJJHHMM>', '<nom>', array[$migration$<contenu exact du fichier>$migration$]);
```

C'est la seule écriture qu'un agent fait sur la prod. On ne l'inscrit pas si l'application a échoué.

Règles :

- **Toujours** désigner un projet par son rôle **et** son identifiant, et indiquer explicitement le `project_id` dans chaque appel MCP Supabase (`execute_sql`, `list_tables`, `list_migrations`, `get_advisors`…). Jamais d'appel « par défaut ». Dans le dashboard, vérifier le nom du projet ouvert avant d'exécuter.
- Les agents n'appellent pas `apply_migration`. `execute_sql` sert à lire, sauf l'inscription ci-dessus et, pour Quentin et sur TEST uniquement, les tests en transaction annulée (`begin; … rollback;`), les données préfixées `TEST` supprimées ensuite et le jeu de données fictives de #21.
- On n'applique jamais sur prod une migration qui n'a pas d'abord réussi sur test et été validée par Quentin.
- **Pas de modification hors migration enregistrée** : tout changement de structure correspond à un fichier de `supabase/migrations/` appliqué sur les deux bases et inscrit dans leur historique avec la même version.
- Les données ne circulent jamais de prod vers test. Le jeu de données fictives de test est géré par Quentin (#21).

### Si la migration échoue sur prod après avoir réussi sur test

1. **Ne pas réessayer en modifiant le SQL directement sur prod.** Grâce au `begin;` … `commit;`, une erreur annule toute la migration : le chef de projet vérifie dans l'éditeur que la transaction est bien annulée (au besoin exécuter `rollback;`), qu'aucun objet de la migration n'existe (lecture des catalogues) et Sylvie **ne l'inscrit pas** dans `schema_migrations`.
2. Lire l'erreur. Cause habituelle : une **donnée** de prod que test n'a pas (valeur hors d'un nouveau `check`, doublon sur un nouvel index unique, ligne orpheline…). La diagnostiquer en lecture seule (`execute_sql` avec `select`).
3. Corriger dans **une nouvelle migration** (ou une migration de reprise de données séparée, si le ticket l'autorise), ajouter à test un cas de données fictives qui reproduit le problème, appliquer sur test, refaire valider, puis appliquer sur prod.
4. Si la migration a déjà été appliquée sur test sous l'ancienne forme, appliquer sur test une migration corrective plutôt que de réécrire l'historique, pour que les deux listes restent alignées.
5. Signaler l'incident dans le ticket (cause, correction, résultat).

## État de la base test

Le projet test a été créé vide le 29/10/2026 (#19), aligné sur la prod d'alors, puis a reçu les migrations suivantes :

| Ordre | Nom de migration | Fichier | Remarque |
|---|---|---|---|
| 1 | `schema_initial_v1` | `supabase/bootstrap/01_schema_initial_v1.sql` | test uniquement : `docs/sauvegarde/schema-v1.sql` sans `tricount` / `epingle` / `note` et avec les `on delete` réels de la prod (cascade sur `user_id` et `soldes.compte_id`, `set null` sur `categorie_id` et `compte_id`) |
| 2 | `add_tricount_field` | `supabase/bootstrap/02_add_tricount_field.sql` | SQL prod identique |
| 3 | `add_epingle_to_transactions` | `supabase/bootstrap/03_add_epingle_to_transactions.sql` | SQL prod sans le `update … set epingle = true` |
| 4 | `add_note_to_transactions` | `supabase/bootstrap/04_add_note_to_transactions.sql` | SQL prod identique |
| 5 | `etape1_comptes_tous_types_virements` | `supabase/migrations/202610291400_etape1_comptes_tous_types_virements.sql` | #3 : appliquée sur test le 02/11/2026 (version `20261102102800`), puis sur prod (version `20261102103500`) |
| 6 | `vue_soldes_comptes` | `supabase/migrations/202611031145_vue_soldes_comptes.sql` | #5 : appliquée sur test puis sur prod le 03/11/2026, inscrite avec la version `202611031145` sur les deux bases |

Le schéma `backup_v1` n'est volontairement pas reproduit sur test.

### Écarts attendus entre les historiques de migrations

- `schema_initial_v1` n'existe que sur test (en prod, le schéma a été créé avant l'usage des migrations).
- **Écart historique accepté, non corrigé** : `etape1_comptes_tous_types_virements` (#3) a été inscrite avant la règle de version, avec `20261102102800` sur test et `20261102103500` sur prod (au lieu du préfixe `202610291400`). Les migrations `bootstrap/` de test ont aussi des versions horodatées à l'application. Toutes les migrations suivantes ont la version égale au préfixe du fichier, identique sur les deux bases.
- Le SQL enregistré pour `add_epingle_to_transactions` diffère sur test (sans la ligne `update`).

### Contrôle d'identité

Requête versionnée : [`supabase/empreinte_public.sql`](empreinte_public.sql). Lecture seule des catalogues (aucune donnée de table) ; à lancer sur chaque base avec le `project_id` explicite. Elle donne une empreinte md5 par famille d'objets du schéma `public` (colonnes et leur ordre, types, défauts, nullabilité, contraintes, index, politiques RLS, RLS activée, droits, triggers, fonctions, commentaires, séquences et vues, définition des vues) et une ligne `TOTAL_public` qui doit être **identique** sur TEST et PROD. En cas d'écart, comparer famille par famille. Les familles `extensions` et `schemas` sont affichées pour information, hors total : `schemas` diffère normalement (le schéma `backup_v1` n'existe que sur prod).

| Date | Après | `TOTAL_public` (TEST = PROD) | Objets | Requête |
|---|---|---|---|---|
| 03/11/2026 | #5 | `f4838e4be7525645aad5f0b450a43d2b` | 233 | `empreinte_public.sql` (référence pour les prochaines comparaisons) |
| 03/11/2026 | #5 | `f93b32579316a470ebbd3e28b0718402` | 233 | requête de recette de Quentin, non versionnée, non reproductible à l'identique |
| 02/11/2026 | #3 | `25d70b76f63c7462e37df3dfd80b865c` | 189 | ancienne requête, sans la famille `def_vues` |

Les empreintes ne se comparent qu'entre résultats d'une **même** requête. Si la requête évolue (nouvelle famille, autre format), la modifier dans une PR et noter la nouvelle référence dans ce tableau.

## Jeu de données de test (#21)

Script : [`supabase/seed/donnees-test.sql`](seed/donnees-test.sql). Il efface puis recrée les données de **l'utilisateur de test seulement** (les autres utilisateurs ne sont pas touchés) : 8 catégories, 4 comptes (courant par défaut, livret, investissement, espèces), 6 soldes et 35 transactions sur le mois en cours et les deux précédents, dont 7 mouvements. Tout est fictif et libellé `TEST …`. Les dates suivent le mois en cours : l'écran du mois n'est jamais vide.

**Garde-fous** : le script est un seul bloc `do` (tout ou rien) et s'arrête sans rien modifier si :
- le schéma `backup_v1` existe, c'est-à-dire si la base est la **PROD** `artvpflfhvouyngzgqob` ;
- `v_user_id` n'est pas renseigné, ou ne correspond à aucun utilisateur de la base.

**Le rejouer** (quand les données de test ont été abîmées, ou après un changement de schéma) :

1. Dashboard du projet **TEST « monbudget-test » `ebupazakzfbpptmlrzze`** : vérifier le nom du projet ouvert.
2. *Authentication* → *Users* : copier l'UID de l'utilisateur de test.
3. *SQL Editor* : coller le contenu du script, remplacer `00000000-0000-0000-0000-000000000000` de `v_user_id` par cet UID (ne pas committer l'UID), exécuter.
4. Message attendu : « Jeu de données TEST recréé : 8 catégories, 4 comptes, 6 soldes, 35 transactions dont 7 mouvements, sur 3 mois. »

Un agent peut aussi le lancer via `execute_sql` avec `project_id = ebupazakzfbpptmlrzze` (Quentin, voir les règles plus haut). Si une migration ajoute une colonne obligatoire, mettre le script à jour dans le même ticket.
