# Supabase : une migration, deux bases

| Environnement | Projet Supabase | `project_id` | Région | Données |
|---|---|---|---|---|
| **Prod** | `budget-app` | `artvpflfhvouyngzgqob` | `eu-central-1` | données réelles du chef de projet |
| **Test** | `monbudget-test` | `ebupazakzfbpptmlrzze` | `eu-central-1` | uniquement des données fictives |

URL de l'API de test : `https://ebupazakzfbpptmlrzze.supabase.co`. La clé `anon` / publishable est publique par nature (la sécurité repose sur la RLS) : elle est donnée dans le ticket #19. **Jamais** de clé `service_role`, de mot de passe de base ni de secret dans le repo ou les tickets.

Les deux projets sont sur le plan gratuit. Un projet gratuit inactif est mis en pause : on le relance en un clic dans le dashboard (*Restore project*).

## Auth

Configurée par le chef de projet le 02/11/2026 (inscription par email / mot de passe active sur les deux projets).

| | Test | Prod |
|---|---|---|
| *Site URL* | `http://localhost:3000` | `https://monbudget-lilac.vercel.app` |
| *Redirect URLs* | `https://*-adum.vercel.app/**`, `http://localhost:*/**` | `https://monbudget-lilac.vercel.app` |
| Utilisateur de test | créé par le chef de projet ; identifiants dans les secrets GitHub `TEST_EMAIL` / `TEST_PASSWORD` | — |

Aucun agent ne saisit ni ne lit de mot de passe.

## Procédure : une migration, deux bases

> **Mode d'application provisoire (depuis le 02/11/2026).** L'outil MCP `apply_migration` est inutilisable : le client annule automatiquement sa confirmation en 0,5 s (depuis un agent comme depuis la session principale), rien n'est exécuté. En attendant la procédure officielle, qui sera fixée par **#22**, la migration est appliquée **par le chef de projet dans l'éditeur SQL du dashboard**, puis **inscrite par l'agent** dans `supabase_migrations.schema_migrations`. Proposition de Corentin dans #22 : même numéro de version sur les deux bases, égal au préfixe du fichier.

1. **Écrire** la migration dans `supabase/migrations/<AAAAMMJJHHMM>_<nom>.sql`. `<nom>` est le nom de migration (snake_case, explicite : `etape1_comptes_tous_types_virements`).
2. **Appliquer sur test** (`ebupazakzfbpptmlrzze`) : le chef de projet ouvre l'éditeur SQL du projet **test**, colle le contenu **exact** du fichier **encadré par `begin;` … `commit;`** (l'éditeur ne fait pas de transaction automatique : sans cela, une erreur au milieu laisse la base à moitié migrée), et l'exécute. L'agent inscrit ensuite la migration dans `supabase_migrations.schema_migrations` du projet test (`version`, `name` = `<nom>`, `statements`), selon les règles fixées par #22.
3. Lancer `get_advisors` (sécurité et performance) **sur test**, corriger si besoin (nouvelle migration, appliquée sur test).
4. **Validation** : Quentin teste sur la preview Vercel branchée sur test, le chef de projet valide.
5. **Appliquer sur prod** (`artvpflfhvouyngzgqob`) : même procédure qu'à l'étape 2, dans l'éditeur SQL du projet **prod**, avec le **même fichier, sans aucune modification**, encadré par `begin;` … `commit;`, puis inscription dans `supabase_migrations.schema_migrations` de la prod avec le **même nom**. Si une sauvegarde est requise (migration qui transforme des données), la faire sur prod juste avant (voir `docs/RESTAURATION.md`).
6. **Vérifier** : `list_migrations` doit donner la même liste de noms sur les deux projets (aux écarts attendus près, voir plus bas), et la comparaison des catalogues de `public` doit être identique. Lancer `get_advisors` sécurité sur prod.

Règles :

- **Toujours** indiquer explicitement le `project_id` dans chaque appel MCP Supabase (`execute_sql`, `list_tables`, `list_migrations`, `get_advisors`…). Jamais d'appel « par défaut ». Dans le dashboard, vérifier le nom du projet ouvert avant d'exécuter.
- On n'applique jamais sur prod une migration qui n'a pas d'abord réussi sur test.
- **Pas de modification hors migration enregistrée** : tout changement de structure correspond à un fichier de `supabase/migrations/` appliqué sur les deux bases et inscrit dans leur historique (en attendant les règles de #22).
- Les données ne circulent jamais de prod vers test. Le jeu de données fictives de test est géré par Quentin.

### Si la migration échoue sur prod après avoir réussi sur test

1. **Ne pas réessayer en modifiant le SQL directement sur prod.** Grâce au `begin;` … `commit;`, une erreur annule toute la migration : vérifier dans l'éditeur que la transaction est bien annulée (au besoin exécuter `rollback;`), qu'aucun objet de la migration n'existe (lecture des catalogues) et **ne pas** l'inscrire dans `schema_migrations`.
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

Le schéma `backup_v1` n'est volontairement pas reproduit sur test.

### Écarts attendus entre les historiques de migrations

- `schema_initial_v1` n'existe que sur test (en prod, le schéma a été créé avant l'usage des migrations).
- Les numéros de version diffèrent entre les deux projets (horodatés à l'application), en attendant la règle de #22.
- Le SQL enregistré pour `add_epingle_to_transactions` diffère sur test (sans la ligne `update`).

### Contrôle d'identité

Au 02/11/2026, après #3 : empreinte md5 des catalogues de `public` (colonnes et leur ordre, types, défauts, nullabilité, contraintes, index, politiques RLS, RLS activée, triggers, fonctions, droits) **identique** sur les deux projets : `25d70b76f63c7462e37df3dfd80b865c` (189 objets).
