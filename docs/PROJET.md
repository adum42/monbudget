# monbudget — dossier projet

> Base de connaissance du projet, tenue à jour par **Corentin** (coach). Dernière mise à jour : 04/11/2026.
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
| 1 | Multi-comptes : compte sur chaque transaction, solde calculé vs solde banque | `docs/maquettes/1-comptes.html` | en cours : structure (#3), vue des soldes (#5), comptes au 30/09 (#4), modale transaction (#6) et cartes comptes (#8) livrés ; filtre par compte (#7) et validation de l'étape (#10) à venir |
| 2 | Pointage et rapprochement bancaire | `docs/maquettes/2-pointage.html` | à faire |
| 3 | Cagnottes par thème | `docs/maquettes/4-cagnottes.html` | à faire |
| 4 | Suivi de l'épargne mensuelle | `docs/maquettes/3-epargne.html` | à faire |
| 5 | Budgets par catégorie avec **plafonds suggérés à partir des mois précédents** (médiane, profils économe / confort, provision pour les catégories irrégulières), récurrences, solde prévisionnel | `docs/maquettes/5-budgets.html` | à faire |
| 6 | Clôture du mois (checklist + bilan, **sans import**) | `docs/maquettes/6-cloture.html` | à faire |

Chaque étape correspond à un **milestone GitHub** du même nom. Un milestone par étape ; le sprint n'a pas de milestone, il est porté par le label `sprint-N`.

**Sprint 1** : du 29/10/2026 au 12/11/2026 à 00h00 (heure de Paris), donc jusqu'à la fin du 11/11. Tickets du sprint : label `sprint-1`.

Ordre de traitement du sprint 1 (mis à jour le 04/11/2026 ; livrés : #2, #3, #4, #5, #6, #8, #9, #17, #18, #19, #20, #21, #22, #25, #30, #43, #45) :

| Ordre | Ticket | Agent | Dépend de |
|---|---|---|---|
| — | #9 Socle de tests Playwright et CI GitHub Actions | Quentin | **livré le 04/11** (PR #57) |
| 1 | #44 Croix ✕ des catégories qui supprime la mauvaise catégorie | Fabien | — |
| 2 | #49 Échappement HTML : catégories, listes déroulantes, historique des soldes, top 5 | Fabien | #44 (même bloc de `renderCategories`, branches successives) |

#8 (cartes comptes) est livré le 03/11 (PR #52, sans migration) ; le label `sprint-1` lui a été ajouté le même jour.

Bugs du 03/11 (front, `taille:S`, sans migration) : #45 date du jour en UTC et #43 échappement HTML de la liste des transactions sont **livrés** (PR #47 et #48). Restent ouverts, **intégrés au sprint 1** (décision du chef de projet, 03/11) : #44 croix ✕ des catégories et #49 échappement HTML des catégories, listes déroulantes, historique des soldes et top 5. Les deux touchent `renderCategories` : faire #44 d'abord, puis #49 sur `main` à jour (jamais en parallèle). L'échappement des cartes comptes a été fait par #8.

La ressaisie par le chef de projet des transactions depuis le 01/10 sur la prod est reportée (03/11) ; elle ne bloque aucun ticket.

Depuis #8, le chef de projet peut modifier ses comptes depuis l'app (type `courant` proposé, plafond et couleur pour tous les types) : la consigne « ne pas modifier un compte avant #8 » est levée.

## 3. État actuel de l'application

### Écrans (onglets)

| Onglet | Contenu |
|---|---|
| Transactions | métriques du mois (hors mouvements), boutons « + Entrée », « − Sortie » et « ⇄ Mouvement entre comptes », liste filtrable (type dont « Mouvements », catégorie, tri date / montant ↑↓), recherche texte (description + note), « Tout voir » (tous les mois), épingle cliquable, suivi Tricount ; nom du compte sous la description (« Depuis → Vers » pour un mouvement) ; les mouvements sont listés avec un badge « Mouvement » (#6) |
| Comptes | patrimoine total (**somme des soldes calculés**), une carte par compte (#8) : solde calculé lu dans `v_soldes_comptes`, dernier solde banque et sa date, écart, voyant, plafond s'il est renseigné ; boutons ✏️ et « Saisir un solde » ; graphique d'évolution (courbes des relevés saisis et « Total patrimoine ») |
| Catégories | CRUD des catégories avec sélecteur d'emoji |
| Statistiques | 3 KPIs (sorties, entrées, taux d'épargne vs mois précédent), barres horizontales par catégorie, évolution 6 mois, top 5 catégories (mouvements exclus partout) |

Sélecteur de mois en en-tête. Authentification Supabase (connexion / inscription).

### Modale transaction (#6)

Champs : description, montant, date, type (**Entrée / Sortie / Mouvement** ; les trois boutons de type ne s'affichent qu'en modification, une création part du bouton choisi dans l'onglet), compte, catégorie, Tricount (`non` / `oui` / `oui validé`), note, épinglé (vrai par défaut).

- **Entrée / sortie** : liste « Compte » pré-remplie avec le compte par défaut. Une nouvelle transaction doit avoir un compte ; une ancienne transaction sans compte reste modifiable avec « Aucun compte ».
- **Mouvement** : listes « Depuis » (pré-remplie avec le compte par défaut) et « Vers » ; catégorie et Tricount masqués ; enregistré sans catégorie et avec Tricount `non`. Passer d'un mouvement à une entrée ou une sortie reprend « Depuis » comme compte et vide `compte_dest_id`.
- **Validation avant envoi** : description, montant (vide, illisible, ≤ 0, < 0,01 ou ≥ 10^10 refusés), date, compte, « Depuis » ≠ « Vers ». Rien n'est envoyé tant qu'une règle échoue.
- **Erreurs** : toute erreur Supabase est affichée en haut de la modale avec son code (`messageErreurSupabase`), la modale reste ouverte. Les erreurs de suppression, d'épingle et de Tricount sont aussi affichées.

Actions : enregistrer, dupliquer (date du jour), supprimer avec confirmation en 2 temps.
Raccourcis : `Échap` ferme les modales, `N` ouvre une nouvelle transaction. La description reçoit le focus 100 ms après l'ouverture.

### Cartes comptes et voyant (#8)

`loadComptes` lit `comptes`, `soldes` et `v_soldes_comptes` (`select('*')`) ; une erreur de chargement est affichée dans l'onglet. Chaque carte montre le **solde calculé** (en gros), le dernier solde banque et sa date, l'**écart** (solde banque − solde calculé à la date du relevé) et un **voyant**. Le **patrimoine total** est la somme des soldes calculés (calcul en centimes entiers, `totalPatrimoine`).

Règles du voyant (validées par le chef de projet le 03/11/2026), appliquées dans cet ordre :

1. Aucun relevé saisi → « Aucun relevé ».
2. Relevé de 31 jours ou plus → « ⏱ N jours », **même s'il y a un écart**.
3. Relevé antérieur au solde initial (écart non calculable) → « Relevé à saisir ».
4. Écart ≠ 0 → « ⚠ écart ».
5. Écart nul et relevé de 0 à 14 jours → « ✓ rapproché » (vert).
6. Écart nul et relevé de 15 à 30 jours → « ✓ il y a N j » (bleu).

Un relevé daté dans le futur compte comme 0 jour.

Tout texte saisi des cartes passe par `esc()` ; les boutons ✏️ et « Saisir un solde » utilisent `data-edit-compte-id` / `data-solde-compte-id` + `addEventListener` (plus d'`onclick` concaténé).

### Modale compte (#8)

Champs : nom, banque, type (**4 types** avec libellés : Compte courant, Livret d'épargne, Investissement, Espèces), solde initial et sa date (par défaut la date du jour locale, `dateLocaleISO()`), compte par défaut, **plafond et couleur pour tous les types**. Le nom reçoit le focus 100 ms après l'ouverture (`#modal-c-nom`).

- **Validation avant envoi** (`validerSaisieCompte`) : rien n'est envoyé tant qu'une règle échoue.
- **Compte par défaut** : changé en **deux requêtes** (retrait sur l'ancien, puis pose sur le nouveau) ; si la seconde échoue, l'ancien défaut est remis et l'erreur affichée.
- **Suppression** en deux temps ; un compte qui porte des opérations est refusé (`23503`) avec le message « Suppression impossible : ce compte porte des opérations… », modale ouverte.
- **Erreurs** : toute erreur Supabase de `saveCompte` / `deleteCompteFromModal` est affichée avec son code (`messageErreurCompte`, qui réutilise `messageErreurSupabase`), la saisie est conservée et la modale reste ouverte.

### Organisation du code (`index.html`)

| Bloc | Fonctions principales |
|---|---|
| Données | `loadAll`, `loadCategories`, `loadTransactions` (jointure `categories(nom,emoji)` ; en cas d'erreur, message dans la liste via `erreurChargementTx`), `loadComptes` (charge aussi `soldes`) |
| Rendu | `renderAll`, `renderMetrics`, `renderTransactions`, `renderCategories`, `renderComptes`, `renderChartComptes`, `renderStatsKpis`, `renderCharts` |
| Transactions : fonctions pures (#6) | bloc « FONCTIONS PURES (#6) » : `lireMontant`, `compteParDefaut`, `validerSaisieTx`, `construireLigneTx`, `messageErreurSupabase`, `libelleCompteTx`, constante `MONTANT_MAX`. Sans DOM ni réseau, testées par `tests/front/` |
| Transactions : modale | `openTxModal` → `ouvrirModaleTx`, `lireSaisieTx`, `saveTx`, `setTxType`, `setTricount`, `dupTx`, `askDeleteTx`, `deleteTxFromModal`, `resetDeleteConfirm`, `afficherErreurTx`, `effacerErreurTx`, `optionsComptes` |
| Comptes : fonctions pures (#8) | bloc « FONCTIONS PURES COMPTES (#8) » : `libelleTypeCompte`, `arrondiCentimes`, `ecartCompte`, `voyantCompte`, `totalPatrimoine`, `couleurCompte`, `formatDateFr`, `validerSaisieCompte`, `construireLigneCompte`, `compteDefautARetirer`, `messageErreurCompte`. Sans DOM ni réseau, testées par `tests/front/` |
| Comptes / soldes | `openCompteModal`, `lireSaisieCompte`, `saveCompte`, `askDeleteCompte`, `deleteCompteFromModal`, `closeCompteModal`, `afficherErreurCompte`, `effacerErreurCompte`, `rechargerComptes`, `openSoldeModal`, `saveSoldeEntry` (upsert sur `compte_id,date`), `deleteSoldeEntry`, `renderSoldeHistory`, `getLastSolde`, `getPrevSolde` |
| Navigation | `switchTab`, `changeMonth`, `toggleViewAll` |
| Environnement | `choisirEnvironnement`, `ENV`, `DOMAINES_PROD` (#20) |
| Utilitaires | `fmt` (format fr-FR 2 décimales), `esc` (échappement HTML : liste des transactions depuis #43, cartes comptes depuis #8 ; reste à faire : #49), `dateLocaleISO` (date du jour dans le fuseau local, bloc « DATE DU JOUR : FONCTION PURE (#45) » ; ne plus utiliser `toISOString` pour « aujourd'hui »), `txOfMonth` |

État global : `currentUser`, `categories`, `transactions`, `comptes`, `soldes`, `soldesComptes` (lignes de `v_soldes_comptes`, #8), `currentMonth` (`AAAA-MM`), `viewAllMonths`.

### Environnements

| Rôle | Projet Supabase | `project_id` | Utilisé par | Données |
|---|---|---|---|---|
| **PROD** | « budget-app » | `artvpflfhvouyngzgqob` | `https://monbudget-lilac.vercel.app` | réelles |
| **TEST** | « monbudget-test » | `ebupazakzfbpptmlrzze` | previews Vercel, `localhost` | fictives |

- Aiguillage (#20, livré) : `choisirEnvironnement(location.hostname)` dans `index.html` renvoie `prod` pour un domaine de la liste blanche `DOMAINES_PROD` (`monbudget-lilac.vercel.app`), `test` sinon ; en test, bandeau « Environnement de TEST ».
- Circuit d'un ticket avec migration (#22) : test local (Postgres jetable, `tests/sql/run.sh`) → application sur TEST par le chef de projet → inscription et vérification par Sylvie → recette de Quentin → feu vert → application sur PROD par le chef de projet → inscription et vérification → PR → merge. Détail : `CLAUDE.md` et `supabase/README.md`.
- Seul le chef de projet écrit sur la prod ; les agents n'y font que des lectures, plus l'inscription des migrations dans l'historique.
- Accès navigateur de Quentin (#17, #18) : permanent, mais uniquement sur une preview Vercel ou `localhost` (donc TEST), après contrôle du bandeau « Environnement de TEST » et du log console ; jamais sur un domaine de `DOMAINES_PROD`. Ses données de test sont préfixées `TEST QA` (le jeu de données de #21 est préfixé `TEST` et n'est pas modifié). Règles : `.claude/agents/quentin.md`.

### Base Supabase (schéma `public`)

Schéma identique sur PROD et TEST (empreinte des catalogues comparée après chaque migration).

Toutes les tables : clé `id uuid`, `user_id uuid → auth.users`, RLS activée avec une politique `ALL` « `auth.uid() = user_id` ».

| Table | Colonnes métier | Remarques |
|---|---|---|
| `transactions` | `description`, `montant numeric(12,2)` (strictement positif, `check montant > 0` ; le sens vient de `type`), `type` ∈ {entrée, sortie, mouvement}, `categorie_id`, `date`, `compte_id` (nullable ; compte source d'un mouvement), `compte_dest_id` (nullable ; compte destination d'un mouvement), `tricount` ∈ {non, oui, oui validé}, `epingle bool`, `note` | Contrainte `transactions_mouvement_comptes_check` : un `mouvement` a `compte_id` et `compte_dest_id` renseignés et différents ; une entrée ou une sortie n'a pas de `compte_dest_id`. FK `compte_id` et `compte_dest_id` en `on delete restrict`, indexées. Trigger `transactions_verifier_comptes` (avant insertion ou modification, `security invoker`, `search_path` vide) : les comptes référencés doivent appartenir au `user_id` de la transaction, sinon erreur `23503`. Colonne `direction` **supprimée** (#3). Utilisés par l'interface depuis #6. En prod, les 58 transactions d'origine ont été purgées le 03/11 (#4, copie dans `backup_v1.transactions`). |
| `categories` | `nom`, `type` ∈ {entrée, sortie, les deux}, `couleur`, `emoji` | |
| `comptes` | `nom`, `type` ∈ {courant, livret, investissement, especes} (défaut `courant`), `banque`, `couleur`, `solde_initial numeric(12,2)` (défaut 0, **peut être négatif**), `date_solde_initial date`, `par_defaut bool` (défaut faux), `plafond numeric(12,2)` (nullable, `> 0` si renseigné) | Index unique partiel `comptes_un_par_defaut_par_user` : un seul compte par défaut par utilisateur, quel que soit son type. Toutes les colonnes sont éditables depuis la modale compte depuis #8. En prod (#4, 03/11) : **7 comptes** avec leur solde initial au soir du 30/09/2026 (3 `courant` dont le compte par défaut, 3 `livret`, 1 `investissement`), `plafond` vide et couleur par défaut, à renseigner par le chef de projet depuis l'app ; les 3 anciens comptes et leurs 5 soldes banque ont été supprimés. |
| `soldes` | `compte_id`, `date`, `montant`, `note` | Unicité `(compte_id, date)`. FK `compte_id` en `cascade`. Soldes banque saisis à la main (relevés). |

Vue `v_soldes_comptes` (#5, migration `202611031145_vue_soldes_comptes.sql`, en prod le 03/11) : une ligne par compte de l'utilisateur, `security_invoker = on` (soumise à la RLS de l'utilisateur qui l'interroge).

| Colonne | Contenu |
|---|---|
| `compte_id`, `user_id`, `nom`, `type`, `solde_initial`, `date_solde_initial` | repris du compte |
| `solde_calcule` | solde initial + entrées − sorties − mouvements sortants + mouvements entrants, pour les transactions datées à partir de `date_solde_initial` (incluse) |
| `dernier_solde_banque`, `date_dernier_solde_banque` | dernière ligne de `soldes` du compte |
| `solde_calcule_a_date_banque` | solde calculé arrêté à la date du dernier solde banque (incluse) ; `null` si ce relevé est antérieur à `date_solde_initial` |
| `ecart` | `dernier_solde_banque − solde_calcule_a_date_banque` (même règle du `null`) |
| `nb_jours_depuis_releve` | jours écoulés depuis le dernier relevé, calculé en UTC (accepté le 03/11) |

Lue par l'interface depuis #8 (`sb.from('v_soldes_comptes').select('*')` dans `loadComptes`).

Migrations : fichiers `supabase/migrations/<AAAAMMJJHHMM>_<nom>.sql`, appliqués par le chef de projet dans l'éditeur SQL du dashboard, puis inscrits dans `supabase_migrations.schema_migrations` par Sylvie avec la version = préfixe du fichier, identique sur les deux bases (#22). Exception historique acceptée : `etape1_comptes_tous_types_virements` (#3), appliquée le 02/11/2026, est inscrite avec `20261102102800` sur test et `20261102103500` sur prod.

### Tests et CI (#25 livré le 03/11/2026, #9 livré le 04/11/2026)

Mode d'emploi complet (lancer en local, lire un échec, écrire un test) : `tests/README.md`.

- `tests/sql/` : sur un Postgres jetable, `run.sh` rejoue `supabase/bootstrap/` puis **toutes** les migrations de `supabase/migrations/` (ordre des noms) sur des données fictives, puis les cas de `tests/sql/cas/` (127 cas au 03/11 : #3, #5 et non-régression des requêtes de `index.html`, dont 11 ajoutés par #8 : vue, `saveCompte`, bascule du compte par défaut, `23505`, `23514`). Mode d'emploi : `tests/sql/README.md`.
- Chaque nouveau ticket de base ajoute son fichier `tests/sql/cas/ticketNN_<sujet>.sql` ; chaque nouvelle requête `sb.from(...)` du front est ajoutée à `cas/front_non_regression.sql`.
- `tests/front/` : tests unitaires Node, sans dépendance, des fonctions pures de `index.html` extraites telles quelles entre leurs marqueurs : `ticket06_fonctions_tx.test.js` (#6, 47 cas), `ticket08_comptes.test.js` (#8, 85 cas), `ticket45_date_locale.test.js` (#45, 20 cas, avec `TZ=Europe/Paris`). Tous lancés par `cd tests && npm run test:unitaires`. Le bloc #6 s'arrête au début du bloc #45 : un nouveau bloc de fonctions pures doit avoir un marqueur de début **et** de fin, comme le bloc #8.
- `tests/e2e/` (#9) : Playwright (versions épinglées dans `tests/package.json`), `index.html` servi en local sur `127.0.0.1` (donc TEST), fuseau `Europe/Paris`.
  - **Sans connexion** (projets `bureau-1280` et `mobile-390`, 20 tests) : CDN servis depuis `tests/node_modules`, faux Supabase en mémoire (`e2e/outils.js`) qui enregistre les écritures et peut renvoyer une erreur Postgres, horloge figée au 04/11/2026 10 h ; tout appel hors TEST et toute erreur console non attendue font échouer le test. Parcours : démarrage et bandeau TEST, écran de connexion, créer puis supprimer une transaction, changer de mois, erreur de la base affichée, fonctions pures appelées dans la page, ouverture juste après minuit.
  - **Connectés** (projet `connecte`, 3 tests) : vraie base TEST `ebupazakzfbpptmlrzze` avec l'utilisateur de test (secrets `TEST_EMAIL` / `TEST_PASSWORD`, jamais lus par un agent) ; connexion, créer puis supprimer une transaction `TEST QA e2e …` (supprimée même en cas d'échec), changer de mois. Ignorés sans secrets. Sans trace ni capture, et sans rapport publié en CI : une trace Playwright ou l'instantané d'échec contiennent le mot de passe en clair, et le repo est public.
  - Un nouveau parcours s'ajoute sur le modèle de `e2e/transactions.spec.js`. Dans une modale, attendre le focus automatique (100 ms après l'ouverture : description de la modale transaction, `#modal-c-nom` de la modale compte) avant de remplir.
- GitHub Actions `.github/workflows/tests.yml`, à chaque PR et push sur `main` : `tests-sql` (Postgres 17, sans secret), `tests-front` (unitaires), `tests-e2e` (Playwright sans connexion, rapport publié en artefact en cas d'échec ; puis connecté, sans rapport).
- `main` est protégée : merge uniquement par PR, avec les checks `tests-sql`, `tests-front` et `tests-e2e` verts (les deux derniers depuis le 04/11/2026).
- Recette navigateur manuelle de Quentin (preview ou `localhost`, contrôle du bandeau) : toujours possible pour ce que les tests automatiques ne couvrent pas.

### Dette technique connue

- Erreurs Supabase non affichées : réglé pour les transactions (#6) et les comptes (#8). Restent silencieuses les écritures des catégories (`saveCat`, `deleteCatFromModal` : suppression traitée par #44) et des soldes banque (`saveSoldeEntry`, `deleteSoldeEntry` : pas de ticket, relevé par Quentin le 03/11).
- Textes saisis insérés sans échappement HTML (liste des transactions corrigée par #43, cartes comptes par #8) : catégories, listes déroulantes, historique des soldes et top 5 (#49).
- Deux « patrimoine » différents dans l'onglet Comptes (relevé par Quentin, #8) : le « Patrimoine total » du haut est la somme des **soldes calculés**, la courbe « Total patrimoine » du graphique est la somme des **derniers relevés** saisis à chaque date (`renderChartComptes`). Même nom, chiffres possiblement différents. Pas de ticket.
- Page ouverte pendant le passage de minuit : la modale propose la nouvelle date mais l'en-tête garde l'ancien mois jusqu'au rechargement (préexistant, pas de ticket ; la date du jour elle-même est corrigée par #45).
- Erreur de chargement des transactions : la liste l'affiche, mais les métriques gardent les données précédentes (non bloquant, pas de ticket).
- Aucune icône déclarée : 404 sur `/favicon.ico` dans la console (cosmétique).
- Affichage à 390 px (#30) : nom de catégorie très long coupé dans « Sorties par catégorie », « € » seul à la ligne sur le patrimoine total (cosmétique, toujours présent après #8 ; pas de défilement horizontal).
- Pas de contrôle d'appartenance sur `soldes.compte_id` ni `transactions.categorie_id` (la RLS ne filtre pas les lignes référencées par une clé étrangère) : #24.
- Migrations appliquées à la main (automatisation prévue après le sprint 1 : #32).
- Juste après la connexion, l'écran principal s'affiche avant la fin du chargement des données : une modale transaction ouverte dans l'intervalle a des listes de comptes vides (trouvé par #9) : #58.

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
| 03/11/2026 | Accès navigateur de Quentin permanent mais limité à TEST : previews et `localhost` seulement, contrôle du bandeau « Environnement de TEST » avant toute action, prod interdite même en lecture (contrôle de la prod en SQL lecture seule uniquement) ; ses données de test sont préfixées `TEST QA` (#18) | tester l'app réellement sans jamais toucher aux données réelles, et sans abîmer le jeu de données de #21 |
| 03/11/2026 | Sprint 1 : #5 traité avant #4 ; si la charge déborde, on sort #9 en premier | #5 ne dépend de rien alors que #4 attend la liste des comptes au 30/09 |
| 03/11/2026 | Solde initial de chaque compte = solde **au soir du 30/09/2026** ; seules les transactions datées **à partir du 01/10/2026** sont saisies | sinon double comptage dans `v_soldes_comptes` |
| 03/11/2026 | `nb_jours_depuis_releve` de `v_soldes_comptes` reste calculé en UTC | écart d'au plus un jour, sans enjeu |
| 03/11/2026 | Comptes de prod (#4) : 3 comptes `courant`, dont le compte par défaut ; plafonds et couleurs non renseignés, ajoutés par le chef de projet après #8, qui doit proposer plafond et couleur pour tous les types ; ne pas modifier un compte depuis l'app avant #8 (consigne levée : #8 livré le 03/11) | la modale compte actuelle ne connaît ni le type `courant` ni le plafond |
| 03/11/2026 | Nouvelle transaction : compte obligatoire ; une ancienne transaction sans compte reste modifiable avec « Aucun compte » (#6) | toutes les nouvelles opérations alimentent le solde calculé, sans bloquer l'historique |
| 03/11/2026 | Les mouvements restent **visibles dans la liste** (badge « Mouvement », filtre « Mouvements ») et toujours **exclus des métriques et des statistiques** (#6) | voir les virements sans fausser le budget |
| 03/11/2026 | Échappement HTML des cartes comptes intégré à #8 (`esc()` + `data-*-id`, plus d'`onclick` concaténé) | l'écran était refait ; les boutons cassaient sur une apostrophe |
| 03/11/2026 | Règles du voyant des cartes comptes, dans l'ordre : aucun relevé → « Aucun relevé » ; relevé ≥ 31 j → « ⏱ N jours » même avec écart ; relevé antérieur au solde initial → « Relevé à saisir » ; écart ≠ 0 → « ⚠ écart » ; écart 0 et 0–14 j → « ✓ rapproché » (vert) ; écart 0 et 15–30 j → « ✓ il y a N j » (bleu) ; relevé futur = 0 j (#8, proposition de Fabien validée) | un relevé trop ancien ne permet plus de conclure ; distinguer « concordant récent » et « concordant ancien » |
| 03/11/2026 | Patrimoine total de l'onglet Comptes = somme des **soldes calculés** (#8) | refléter les opérations saisies, pas seulement les relevés |
| 03/11/2026 | #44 et #49 intégrés au sprint 1 (PR #51) ; #8 reçoit le label `sprint-1` | bugs courts, même écran ; #8 était déjà traité dans le sprint |
| 04/11/2026 | Carte « Top 5 catégories de dépenses » laissée masquée quand le mois affiché n'a aucune sortie (comportement de `renderStatsKpis` depuis la session 2) ; #49 ne change que l'échappement | comportement voulu, pas un bug |
| 04/11/2026 | Checks `tests-front` et `tests-e2e` obligatoires sur `main`, en plus de `tests-sql` (#9) | une PR qui casse un parcours ou une fonction pure ne peut plus être mergée |
| 04/11/2026 | Tests connectés en CI sans trace, capture ni rapport publié (#9) | le repo est public et une trace contient la saisie du mot de passe |
| 03/11/2026 | Les soldes des comptes suivent les opérations (entrée = crédit, sortie = débit, mouvement = débit de « Depuis » et crédit de « Vers ») pour voir l'écart avec le solde réel : calcul par `v_soldes_comptes` (#5), affichage par #8, pas de nouveau ticket | besoin déjà couvert |

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
