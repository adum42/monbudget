# Supabase : une migration, deux bases

| Environnement | Projet Supabase | `project_id` | Région | Données |
|---|---|---|---|---|
| **Prod** | `budget-app` | `artvpflfhvouyngzgqob` | `eu-central-1` | données réelles du chef de projet |
| **Test** | `monbudget-test` | `ebupazakzfbpptmlrzze` | `eu-central-1` | uniquement des données fictives |

URL de l'API de test : `https://ebupazakzfbpptmlrzze.supabase.co`. La clé `anon` / publishable est publique par nature (la sécurité repose sur la RLS) : elle est donnée dans le ticket #19. **Jamais** de clé `service_role`, de mot de passe de base ni de secret dans le repo ou les tickets.

Les deux projets sont sur le plan gratuit. Un projet gratuit inactif est mis en pause : on le relance en un clic dans le dashboard (*Restore project*).

## Procédure : une migration, deux bases

1. **Écrire** la migration dans `supabase/migrations/<AAAAMMJJHHMM>_<nom>.sql`. `<nom>` est le nom passé à `apply_migration` (snake_case, explicite : `etape1_comptes_tous_types_virements`).
2. **Appliquer sur test** : `apply_migration` avec `project_id = "ebupazakzfbpptmlrzze"`, le nom `<nom>` et le contenu **exact** du fichier.
3. Lancer `get_advisors` (sécurité et performance) **sur test**, corriger si besoin (nouvelle version du fichier, réappliquée sur test).
4. **Validation** : Quentin teste sur la preview Vercel branchée sur test, le chef de projet valide.
5. **Appliquer sur prod** : `apply_migration` avec `project_id = "artvpflfhvouyngzgqob"`, le **même nom** et le **même fichier, sans aucune modification**. Si une sauvegarde est requise (migration qui transforme des données), la faire sur prod juste avant (voir `docs/RESTAURATION.md`).
6. **Vérifier** : `list_migrations` doit donner la même liste de noms sur les deux projets (les numéros de version, horodatés à l'application, diffèrent). Lancer `get_advisors` sécurité sur prod.

Règles :

- **Toujours** indiquer explicitement le `project_id` dans chaque appel MCP Supabase (`apply_migration`, `execute_sql`, `list_tables`, `get_advisors`…). Jamais d'appel « par défaut ». Relire le `project_id` avant chaque `apply_migration`.
- On n'écrit jamais sur prod une migration qui n'a pas d'abord réussi sur test.
- Pas de correction « à la main » dans le dashboard ou par `execute_sql` : tout changement de structure passe par une migration appliquée sur les deux bases.
- Les données ne circulent jamais de prod vers test. Le jeu de données fictives de test est géré par Quentin.

### Si la migration échoue sur prod après avoir réussi sur test

1. **Ne pas réessayer en modifiant le SQL directement sur prod.** `apply_migration` s'exécute dans une transaction : en cas d'erreur, rien n'est appliqué et la migration n'apparaît pas dans `list_migrations` (le vérifier).
2. Lire l'erreur. Cause habituelle : une **donnée** de prod que test n'a pas (valeur hors d'un nouveau `check`, doublon sur un nouvel index unique, ligne orpheline…). La diagnostiquer en lecture seule (`execute_sql` avec `select`).
3. Corriger dans **une nouvelle version du fichier** (ou une migration de reprise de données séparée, si le ticket l'autorise), ajouter à test un cas de données fictives qui reproduit le problème, réappliquer sur test, refaire valider, puis appliquer sur prod.
4. Si la migration a été appliquée sur test sous l'ancienne forme, appliquer sur test une migration corrective plutôt que de réécrire l'historique, pour que les deux listes restent alignées.
5. Signaler l'incident dans le ticket (cause, correction, résultat).

## Reprise initiale du schéma sur test (#19, 29/10/2026)

Le projet test a été créé vide puis aligné sur l'état de la prod **avant #3**, par ces migrations (fichiers dans `supabase/bootstrap/`, appliqués **sur test uniquement**) :

| Ordre | Nom de migration sur test | Origine |
|---|---|---|
| 1 | `schema_initial_v1` | `docs/sauvegarde/schema-v1.sql`, sans `tricount` / `epingle` / `note` et avec les `on delete` réels de la prod (cascade sur `user_id` et `soldes.compte_id`, `set null` sur `categorie_id` et `compte_id`) |
| 2 | `add_tricount_field` | migration prod identique |
| 3 | `add_epingle_to_transactions` | migration prod, sans le `update … set epingle = true` (reprise de données sans objet sur une base vide) |
| 4 | `add_note_to_transactions` | migration prod identique |

`schema_initial_v1` n'existe pas dans `list_migrations` de la prod (le schéma y avait été créé avant l'usage des migrations) : c'est le seul écart de liste attendu entre les deux projets. Le schéma `backup_v1` n'est volontairement pas reproduit sur test.

Contrôle d'identité (29/10/2026) : empreinte md5 des catalogues de `public` (colonnes et leur ordre, types, défauts, nullabilité, contraintes, index, politiques RLS, RLS activée, triggers, fonctions, droits) **identique** sur les deux projets.
