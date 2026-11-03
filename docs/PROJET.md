# monbudget — dossier projet

> Base de connaissance du projet, tenue à jour par **Corentin** (coach). Dernière mise à jour : 02/11/2026.
> Elle décrit l'app **telle qu'elle est réellement** (code et base vérifiés), pas telle qu'on l'imagine.

## 1. Vision

Passer d'un carnet de dépenses à une app de gestion budgétaire complète :

- suivre **tous les comptes** (courants, livrets, espèces) et leurs soldes ;
- **pointer** chaque opération et **rapprocher** avec le solde de la banque, pour être certain que tout est saisi ;
- suivre l'**épargne mise de côté chaque mois** ;
- épargner **par thème** (cagnottes : apport appartement, Noël, vacances…) ;
- piloter le mois avec des **budgets par catégorie** et des **opérations récurrentes**.

Hors périmètre (décision du 29/10/2026) : **import bancaire CSV/OFX**.

## 2. Feuille de route

| Étape | Fonctionnalité | Maquette | État |
|---|---|---|---|
| 1 | Multi-comptes : compte sur chaque transaction, solde calculé vs solde banque | `docs/maquettes/1-comptes.html` | en cours : structure de base livrée (#3), écrans à venir |
| 2 | Pointage et rapprochement bancaire | `docs/maquettes/2-pointage.html` | à faire |
| 3 | Cagnottes par thème | `docs/maquettes/4-cagnottes.html` | à faire |
| 4 | Suivi de l'épargne mensuelle | `docs/maquettes/3-epargne.html` | à faire |
| 5 | Budgets par catégorie avec **plafonds suggérés à partir des mois précédents** (médiane, profils économe / confort, provision pour les catégories irrégulières), récurrences, solde prévisionnel | `docs/maquettes/5-budgets.html` | à faire |
| 6 | Clôture du mois (checklist + bilan, **sans import**) | `docs/maquettes/6-cloture.html` | à faire |

Chaque étape correspond à un **milestone GitHub** du même nom. Un milestone par étape ; le sprint n'a pas de milestone, il est porté par le label `sprint-N`.

**Sprint 1** : du 29/10/2026 au 12/11/2026 à 00h00 (heure de Paris), donc jusqu'à la fin du 11/11. Tickets du sprint : label `sprint-1`.

Ordre de traitement du sprint 1 (mis à jour le 03/11/2026 ; livrés : #2, #3, #19, #20, #21, #22, #25, #30) :

| Ordre | Ticket | Agent | Dépend de |
|---|---|---|---|
| 1 | #17 puis #18 Accès navigateur de Quentin, limité à l'environnement de test | Corentin | ordinateur du chef de projet allumé pour le test réel |
| 2 | #5 Vue `v_soldes_comptes` : solde calculé vs solde banque | Sylvie | — |
| 3 | #4 Repartir de zéro : purger les transactions et créer les comptes au 30/09 | Sylvie écrit le SQL, le chef de projet l'exécute | liste des comptes et soldes au 30/09 fournie par le chef de projet |
| 4 | #6 Compte et virements dans la modale transaction | Fabien | #4 ; débloque la ressaisie par le chef de projet des opérations depuis le 01/10 |
| 5 | #9 Socle de tests Playwright et CI GitHub Actions | Quentin | secrets `TEST_EMAIL` / `TEST_PASSWORD` (existants selon le chef de projet, 03/11) ; job séparé à ajouter dans `.github/workflows/tests.yml` |

#5 passe avant #4 (décision du chef de projet, 03/11) : elle ne dépend de rien, alors que #4 attend la liste des comptes et soldes au 30/09.

Si la charge déborde, on sort du sprint #5 en premier, puis #9.

Les comptes de type `courant` créés par #4 ne doivent pas être modifiés via l'interface avant #8 (la modale compte ne propose pas ce type).

## 3. État actuel de l'application

### Écrans (onglets)

| Onglet | Contenu |
|---|---|
| Transactions | métriques du mois, liste filtrable (type, catégorie, tri date / montant ↑↓), recherche texte (description + note), « Tout voir » (tous les mois), épingle cliquable, suivi Tricount |
| Comptes | patrimoine total, une carte par compte avec **dernier solde saisi à la main** et évolution, graphique d'évolution |
| Catégories | CRUD des catégories avec sélecteur d'emoji |
| Statistiques | 3 KPIs (sorties, entrées, taux d'épargne vs mois précédent), barres horizontales par catégorie, évolution 6 mois, top 5 catégories |

Sélecteur de mois en en-tête. Authentification Supabase (connexion / inscription).

### Modale transaction

Champs : description, montant, date, type (**Entrée / Sortie uniquement**, le type `mouvement` n'est pas proposé), catégorie, Tricount (`non` / `oui` / `oui validé`), note, épinglé (vrai par défaut).
Actions : enregistrer, dupliquer (date du jour), supprimer avec confirmation en 2 temps.
Raccourcis : `Échap` ferme les modales, `N` ouvre une nouvelle transaction.

### Organisation du code (`index.html`)

| Bloc | Fonctions principales |
|---|---|
| Données | `loadAll`, `loadCategories`, `loadTransactions` (jointure `categories(nom,emoji)`), `loadComptes` (charge aussi `soldes`) |
| Rendu | `renderAll`, `renderMetrics`, `renderTransactions`, `renderCategories`, `renderComptes`, `renderChartComptes`, `renderStatsKpis`, `renderCharts` |
| Transactions | `openTxModal`, `saveTx`, `setTxType`, `setTricount`, `dupTx`, `askDeleteTx`, `deleteTxFromModal`, `resetDeleteConfirm` |
| Comptes / soldes | `openCompteModal`, `saveCompte`, `deleteCompteFromModal`, `openSoldeModal`, `saveSoldeEntry` (upsert sur `compte_id,date`), `getLastSolde`, `getPrevSolde` |
| Navigation | `switchTab`, `changeMonth`, `toggleViewAll` |
| Utilitaires | `fmt` (format fr-FR 2 décimales), `txOfMonth` |

État global : `currentUser`, `categories`, `transactions`, `comptes`, `soldes`, `currentMonth` (`AAAA-MM`), `viewAllMonths`.

### Environnements

| Rôle | Projet Supabase | `project_id` | Utilisé par | Données |
|---|---|---|---|---|
| **PROD** | « budget-app » | `artvpflfhvouyngzgqob` | `https://monbudget-lilac.vercel.app` | réelles |
| **TEST** | « monbudget-test » | `ebupazakzfbpptmlrzze` | previews Vercel, `localhost` | fictives |

- Aiguillage (#20, livré) : `choisirEnvironnement(location.hostname)` dans `index.html` renvoie `prod` pour un domaine de la liste blanche `DOMAINES_PROD` (`monbudget-lilac.vercel.app`), `test` sinon ; en test, bandeau « Environnement de TEST ».
- Circuit d'un ticket avec migration (#22) : test local (Postgres jetable, `tests/sql/run.sh`) → application sur TEST par le chef de projet → inscription et vérification par Sylvie → recette de Quentin → feu vert → application sur PROD par le chef de projet → inscription et vérification → PR → merge. Détail : `CLAUDE.md` et `supabase/README.md`.
- Seul le chef de projet écrit sur la prod ; les agents n'y font que des lectures, plus l'inscription des migrations dans l'historique.

### Base Supabase (schéma `public`)

Schéma identique sur PROD et TEST (empreinte des catalogues comparée après chaque migration).

Toutes les tables : clé `id uuid`, `user_id uuid → auth.users`, RLS activée avec une politique `ALL` « `auth.uid() = user_id` ».

| Table | Colonnes métier | Remarques |
|---|---|---|
| `transactions` | `description`, `montant numeric(12,2)` (strictement positif, `check montant > 0` ; le sens vient de `type`), `type` ∈ {entrée, sortie, mouvement}, `categorie_id`, `date`, `compte_id` (nullable ; compte source d'un mouvement), `compte_dest_id` (nullable ; compte destination d'un mouvement), `tricount` ∈ {non, oui, oui validé}, `epingle bool`, `note` | Contrainte `transactions_mouvement_comptes_check` : un `mouvement` a `compte_id` et `compte_dest_id` renseignés et différents ; une entrée ou une sortie n'a pas de `compte_dest_id`. FK `compte_id` et `compte_dest_id` en `on delete restrict`, indexées. Trigger `transactions_verifier_comptes` (avant insertion ou modification, `security invoker`, `search_path` vide) : les comptes référencés doivent appartenir au `user_id` de la transaction, sinon erreur `23503`. Colonne `direction` **supprimée** (#3). L'interface n'utilise encore ni `compte_id` ni `compte_dest_id` (#6) ; aucune transaction n'a de compte ni n'est un mouvement. |
| `categories` | `nom`, `type` ∈ {entrée, sortie, les deux}, `couleur`, `emoji` | |
| `comptes` | `nom`, `type` ∈ {courant, livret, investissement, especes} (défaut `courant`), `banque`, `couleur`, `solde_initial numeric(12,2)` (défaut 0, **peut être négatif**), `date_solde_initial date`, `par_defaut bool` (défaut faux), `plafond numeric(12,2)` (nullable, `> 0` si renseigné) | Index unique partiel `comptes_un_par_defaut_par_user` : un seul compte par défaut par utilisateur, quel que soit son type. La modale de compte ne propose encore que `livret` et `investissement`, et n'utilise pas les nouvelles colonnes (#8). 3 comptes existants. |
| `soldes` | `compte_id`, `date`, `montant`, `note` | Unicité `(compte_id, date)`. FK `compte_id` en `cascade`. Seule source des soldes de comptes aujourd'hui. |

Migrations : fichiers `supabase/migrations/<AAAAMMJJHHMM>_<nom>.sql`, appliqués par le chef de projet dans l'éditeur SQL du dashboard, puis inscrits dans `supabase_migrations.schema_migrations` par Sylvie avec la version = préfixe du fichier, identique sur les deux bases (#22). Exception historique acceptée : `etape1_comptes_tous_types_virements` (#3), appliquée le 02/11/2026, est inscrite avec `20261102102800` sur test et `20261102103500` sur prod.

### Tests et CI (#25, livré le 03/11/2026)

- `tests/sql/` : sur un Postgres jetable, `run.sh` rejoue `supabase/bootstrap/` puis **toutes** les migrations de `supabase/migrations/` (ordre des noms) sur des données fictives, puis les cas de `tests/sql/cas/` (80 cas : #3 et non-régression des requêtes de `index.html`). Mode d'emploi : `tests/sql/README.md`.
- Chaque nouveau ticket de base ajoute son fichier `tests/sql/cas/ticketNN_<sujet>.sql` ; chaque nouvelle requête `sb.from(...)` du front est ajoutée à `cas/front_non_regression.sql`.
- GitHub Actions `.github/workflows/tests.yml`, job `tests-sql` (Postgres 17, sans secret) à chaque PR et push sur `main`.
- `main` est protégée (03/11/2026) : merge uniquement par PR, avec le check `tests-sql` vert.

### Dette technique connue

- `saveTx`, `saveCompte`, `deleteCompteFromModal` et les autres écritures n'affichent pas les erreurs Supabase. Depuis #3, la base refuse des écritures (montant ≤ 0, compte d'un autre utilisateur, suppression d'un compte qui porte des opérations, second compte par défaut…) : sans affichage, l'échec est silencieux. Traité par #6 (transactions) et #8 (comptes).
- Pas de contrôle d'appartenance sur `soldes.compte_id` ni `transactions.categorie_id` (la RLS ne filtre pas les lignes référencées par une clé étrangère) : #24.
- Pas encore de tests navigateur (Playwright, #9). Migrations appliquées à la main (automatisation prévue après le sprint 1 : #32).
- Le total du patrimoine additionne les derniers soldes saisis, quelle que soit leur date.

## 4. Décisions

| Date | Décision | Raison |
|---|---|---|
| — | Graphique camembert remplacé par barres horizontales | lisibilité, choisi après 3 aperçus |
| — | Top 5 = cumul par catégorie | plus utile que les 5 plus grosses opérations |
| — | Nouvelle transaction épinglée par défaut | choix du chef de projet |
| — | Les mouvements sont exclus de toutes les stats | ce sont des virements internes |
| 29/10/2026 | Pas d'import bancaire | choix du chef de projet |
| 29/10/2026 | Équipe : coach, supabase, front, qa ; backlog dans GitHub Issues | voir `CLAUDE.md` |
| 29/10/2026 | Les agents ont un prénom : Corentin (coach), Sylvie (supabase), Fabien (front), Quentin (qa) ; labels et préfixes de tickets inchangés | plus simple à appeler, voir `CLAUDE.md` |
| 29/10/2026 | Sauvegarde v1 avant refonte (branche `sauvegarde/v1`, schéma `backup_v1`) ; une sauvegarde avant chaque étape | retour arrière rapide, voir `docs/RESTAURATION.md` |
| 29/10/2026 | Virement = une seule transaction `mouvement` avec `compte_id` (source) et `compte_dest_id` (destination) ; `direction` abandonnée (#2, option A) | une ligne = un virement, pas de demi-virement possible |
| 29/10/2026 | Compte « Compte courant » (Hello bank) = compte par défaut ; tous les comptes du chef de projet sont créés à l'étape 1 (#2) | suivre tous les comptes |
| 29/10/2026 | On repart de zéro : chaque compte a un solde initial au 30/09/2026, les 58 transactions d'origine sont supprimées (conservées dans `backup_v1`) et le chef de projet ressaisit les opérations depuis le 01/10/2026 après #6 (#2) | données saisies d'emblée avec comptes et virements, et jeu de test réel |
| 29/10/2026 | Les montants (soldes, solde initial) ne sont jamais écrits dans le repo ni dans les tickets | données personnelles |
| 29/10/2026 | On ne supprime jamais un compte qui porte des opérations (FK `on delete restrict`) ; « supprimer » est réservé aux comptes créés par erreur ; un compte fermé sera **clôturé** (#15, #16) | garder l'historique des opérations (#3) |
| 29/10/2026 | Chaque utilisateur est indépendant : une transaction ne référence que des comptes de son propre utilisateur, garanti en base par le trigger `transactions_verifier_comptes` ; un virement vers une autre personne est saisi par chacun (sortie chez l'un, entrée chez l'autre) | une clé étrangère ne passe pas par la RLS (#3) |
| 29/10/2026 | `transactions.montant` en `numeric(12,2)` et strictement positif ; `comptes.solde_initial` peut être négatif (compte à découvert), seule exception à la règle des montants positifs | le sens vient du `type` ; un solde n'est pas un flux (#3) |
| 29/10/2026 | Environnement de test séparé (option A) : projet TEST « monbudget-test » `ebupazakzfbpptmlrzze` au schéma identique à la prod, données fictives ; previews et local aiguillés sur test (#19, #20) | ne plus tester sur les données réelles |
| 29/10/2026 | Type de compte par défaut `courant` ; le compte par défaut peut être de n'importe quel type, un seul par utilisateur ; changer de compte par défaut se fait en deux requêtes côté front (retirer l'ancien puis poser le nouveau, sinon erreur `23505`) (#8) | au plus simple (#3) |
| 02/11/2026 | Migrations appliquées par le chef de projet dans l'éditeur SQL du dashboard (`begin; … commit;`), d'abord sur TEST puis sur PROD après validation de Quentin et feu vert ; Sylvie les inscrit dans l'historique avec la version = préfixe du fichier, identique sur les deux bases ; les agents n'utilisent plus `apply_migration` (#22, option 1) | `apply_migration` est annulé automatiquement par le client ; une seule personne écrit sur la prod |
| 02/11/2026 | Après le sprint 1 : application automatique des migrations par GitHub Actions (`supabase db push`), sur TEST à la PR et sur PROD au merge (option 3, #32) | supprimer le geste manuel et les erreurs de version |
| 03/11/2026 | Protection de `main` : merge uniquement par PR, check `tests-sql` obligatoire (sans approbation requise, contournement admin possible en urgence) | une PR qui casse une migration ou une requête du front ne peut plus être mergée par erreur |

Décisions en attente : voir les tickets labellisés `decision`.

## 5. Glossaire

- **Solde calculé** : solde initial du compte (à sa date de solde initial) + somme des transactions rattachées à ce compte depuis cette date, mouvements entrants et sortants compris.
- **Solde banque** : solde lu sur le relevé, saisi dans `soldes`.
- **Écart** : solde banque − solde calculé (ou − solde pointé pendant un rapprochement).
- **Pointer** : cocher une opération vue sur le relevé.
- **Rapprocher** : valider qu'à une date donnée, solde pointé = solde banque ; les opérations concernées sont alors verrouillées.
- **Mouvement** : virement entre deux comptes de l'utilisateur, neutre pour les stats.
- **Plafond suggéré** : limite mensuelle proposée pour une catégorie à partir de ses dépenses des 3 ou 6 mois précédents (médiane par défaut). Indicatif sous 3 mois d'historique ; pour une catégorie irrégulière, on propose une provision égale à la moyenne.
- **Cagnotte** : objectif d'épargne virtuel (montant, date cible) adossé à un ou plusieurs comptes épargne.
