# monbudget — dossier projet

> Base de connaissance du projet, tenue à jour par **Corentin** (coach). Dernière mise à jour : 29/10/2026.
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
| 1 | Multi-comptes : compte sur chaque transaction, solde calculé vs solde banque | `docs/maquettes/1-comptes.html` | à faire |
| 2 | Pointage et rapprochement bancaire | `docs/maquettes/2-pointage.html` | à faire |
| 3 | Cagnottes par thème | `docs/maquettes/4-cagnottes.html` | à faire |
| 4 | Suivi de l'épargne mensuelle | `docs/maquettes/3-epargne.html` | à faire |
| 5 | Budgets par catégorie avec **plafonds suggérés à partir des mois précédents** (médiane, profils économe / confort, provision pour les catégories irrégulières), récurrences, solde prévisionnel | `docs/maquettes/5-budgets.html` | à faire |
| 6 | Clôture du mois (checklist + bilan, **sans import**) | `docs/maquettes/6-cloture.html` | à faire |

Chaque étape correspond à un **milestone GitHub** du même nom. Un milestone par étape ; le sprint n'a pas de milestone, il est porté par le label `sprint-N`.

**Sprint 1** : du 29/10/2026 au 12/11/2026 à 00h00 (heure de Paris), donc jusqu'à la fin du 11/11. Tickets du sprint : label `sprint-1`.

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
| Comptes / soldes | `openCompteModal`, `saveCompte`, `openSoldeModal`, `saveSoldeEntry` (upsert sur `compte_id,date`), `getLastSolde`, `getPrevSolde` |
| Navigation | `switchTab`, `changeMonth`, `toggleViewAll` |
| Utilitaires | `fmt` (format fr-FR 2 décimales), `txOfMonth` |

État global : `currentUser`, `categories`, `transactions`, `comptes`, `soldes`, `currentMonth` (`AAAA-MM`), `viewAllMonths`.

### Base Supabase (schéma `public`)

Toutes les tables : clé `id uuid`, `user_id uuid → auth.users`, RLS activée avec une politique `ALL` « `auth.uid() = user_id` ».

| Table | Colonnes métier | Remarques |
|---|---|---|
| `transactions` | `description`, `montant numeric` (toujours positif, le sens vient de `type`), `type` ∈ {entrée, sortie, mouvement}, `categorie_id`, `date`, `compte_id` (nullable), `direction` ∈ {vers, depuis} (nullable), `tricount` ∈ {non, oui, oui validé}, `epingle bool`, `note` | `compte_id` et `direction` **existent mais ne sont pas utilisés** par l'interface. Aucune transaction n'a de compte ni n'est un mouvement. |
| `categories` | `nom`, `type` ∈ {entrée, sortie, les deux}, `couleur`, `emoji` | |
| `comptes` | `nom`, `type` ∈ {livret, investissement}, `banque`, `couleur` | Pas de compte courant possible, pas de solde initial. 3 comptes existants. |
| `soldes` | `compte_id`, `date`, `montant`, `note` | Unicité `(compte_id, date)`. Seule source des soldes de comptes aujourd'hui. |

### Dette technique connue

- `saveTx` et les autres écritures n'affichent pas les erreurs Supabase.
- Aucun test, aucune CI.
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
