# monbudget — dossier projet

> Base de connaissance du projet, tenue à jour par **Corentin** (coach). Dernière mise à jour : 17/11/2026.
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
| 1 | Multi-comptes : compte sur chaque transaction, solde calculé vs solde banque | `docs/maquettes/1-comptes.html` | en cours : structure (#3), vue des soldes (#5), comptes au 30/09 (#4), modale transaction (#6), cartes comptes (#8), soldes recalculés après chaque saisie (#66) et catégorie « Mouvement de compte » en base (#68, en prod le 16/11), carte compte « Depuis le relevé » (#82, 16/11) et retrait des mouvements côté écran (#69, en prod le 16/11, recette manuelle reportée dans #10) livrés ; indicateur « Mouvements de compte » (#70, en prod le 16/11, recette manuelle reportée dans #10) et contrôle d'appartenance des relevés et des catégories en base (#24, migration `202611161500`, en prod le 16/11) livrés ; fenêtres qui ne se ferment plus au clic extérieur (#71, 16/11), croix ✕ de la recherche (#77, 16/11) et boutons de saisie inactifs pendant le chargement (#58, 17/11) et bouton unique « + Nouvelle opération » avec modale colorée (#73, 17/11) livrés ; lignes de la liste allégées (#74, 17/11) et pastille à la couleur du compte (#76, 17/11) livrées ; filtre par compte et sous-total de la liste (#72, 17/11) livré ; suppression de `compte_dest_id` (#86, débloqué), emojis des catégories (#78) et validation de l'étape (#10) à venir |
| 2 | Pointage et rapprochement bancaire | `docs/maquettes/2-pointage.html` | à faire |
| 3 | Cagnottes par thème | `docs/maquettes/4-cagnottes.html` | à faire |
| 4 | Suivi de l'épargne mensuelle | `docs/maquettes/3-epargne.html` | à faire |
| 5 | Budgets par catégorie avec **plafonds suggérés à partir des mois précédents** (médiane, profils économe / confort, provision pour les catégories irrégulières), récurrences, solde prévisionnel | `docs/maquettes/5-budgets.html` | à faire |
| 6 | Clôture du mois (checklist + bilan, **sans import**) | `docs/maquettes/6-cloture.html` | à faire |

Chaque étape correspond à un **milestone GitHub** du même nom. Un milestone par étape ; le sprint n'a pas de milestone, il est porté par le label `sprint-N`.

**Sprint 1** : prévu du 29/10/2026 au 11/11/2026 ; **clos en avance le 05/11/2026**, tous ses tickets livrés. Tickets du sprint : label `sprint-1`.

**Sprint 2** : prévu du 06/11 au 19/11/2026 ; **démarré le 16/11/2026, prolongé jusqu'au 20/11/2026 inclus** (jusqu'au 21/11 à 00h00, heure de Paris). Objectif : **terminer l'étape 1 et la valider en prod**. Tickets du sprint : label `sprint-2` (20 tickets depuis le 17/11, ordre ci-dessous dans « Backlog du 05/11 »). Le 17/11, #89, #86 et #100 sont ajoutés au sprint (décision du chef de projet, sprint en avance) ; ordre de fin de sprint : #78 → #54 → #56 → #89 → #86 → #10 → #100. En cas de débordement, on sort dans l'ordre #100, #89, #56, #54.

Ordre de traitement du sprint 1 (mis à jour le 04/11/2026 ; livrés : #2, #3, #4, #5, #6, #8, #9, #17, #18, #19, #20, #21, #22, #25, #30, #43, #44, #45, #49, #55) :

| Ordre | Ticket | Agent | Dépend de |
|---|---|---|---|
| — | #9 Socle de tests Playwright et CI GitHub Actions | Quentin | **livré le 04/11** (PR #57) |
| — | #44 Croix ✕ des catégories qui supprime la mauvaise catégorie | Fabien | **livré le 04/11** (PR #60) |
| — | #49 Échappement HTML : catégories, listes déroulantes, historique des soldes, top 5 | Fabien | **livré le 04/11** (PR #62) |
| — | #55 Soldes banque : erreurs de `saveSoldeEntry` / `deleteSoldeEntry` et confirmation de la croix ✕ (intégré au sprint le 04/11) | Fabien | **livré le 04/11** (PR #64) |

Tous les tickets du label `sprint-1` sont livrés, y compris #55, intégré le 04/11 en supplément. #54 et #58 sont intégrés au sprint 2.

#8 (cartes comptes) est livré le 03/11 (PR #52, sans migration) ; le label `sprint-1` lui a été ajouté le même jour.

Bugs du 03/11 (front, `taille:S`, sans migration) : #45 date du jour en UTC et #43 échappement HTML de la liste des transactions sont **livrés** (PR #47 et #48). **Intégrés au sprint 1** (décision du chef de projet, 03/11) : #44 croix ✕ des catégories, **livré le 04/11** (PR #60, sans migration), et #49 échappement HTML des catégories, listes déroulantes, historique des soldes et top 5, **livré le 04/11** (PR #62, sans migration), fait après #44 sur `main` à jour. L'échappement des cartes comptes a été fait par #8.

#66 (soldes des comptes non mis à jour après une saisie) est **livré le 05/11** (PR #67, sans migration) : `saveTx()` et `deleteTxFromModal()` rechargent transactions **et** comptes (`rechargerApresTx`).

Le chef de projet a commencé sa saisie sur la prod **au 01/11/2026**, avec les soldes initiaux de ses comptes **au 31/10/2026** (05/11).

**Backlog du 05/11/2026 = sprint 2** (label `sprint-2`) — ordre conseillé :

| Ordre | Ticket | Agent | Dépend de |
|---|---|---|---|
| 1 | #68 Catégorie « Mouvement de compte » et retrait du type `mouvement` | Sylvie | **livré le 16/11** (PR #84, migration `202611161145` sur TEST et PROD) |
| 2 | #69 Retirer les mouvements et exclure des stats la catégorie « Mouvement de compte » | Fabien | **livré le 16/11** (PR #88, sans migration ; mergé **sans recette manuelle** sur la preview, reportée dans #10) |
| 3 | #70 Indicateur « Mouvements de compte » en tête de la liste des transactions | Fabien | **livré le 16/11** (PR #91, sans migration ; mergé **sans recette manuelle** sur la preview, reportée dans #10) |
| avant #10 | #86 Supprimer `compte_dest_id` (colonne, FK, index, trigger, contrainte) — ajouté au sprint 2 le 17/11 ; migration à appliquer sur TEST puis PROD | Sylvie | #69 en prod : **débloqué le 16/11** |
| en parallèle de #68 | #71 (**livré le 16/11**, PR #94) les fenêtres ne se ferment plus au clic extérieur · #77 (**livré le 16/11**, PR #95) croix ✕ de la recherche · #72 (**livré le 17/11**, PR #107, sans migration) filtre par compte et sous-total · #58 (**livré le 17/11**, PR #98) modale ouverte avant la fin du chargement · #82 (**livré le 16/11**, PR #85) carte compte : opérations depuis le relevé et solde attendu | Fabien | — |
| après #69 | #80 mise à jour de `CLAUDE.md` (règle des mouvements), Corentin · #73 bouton unique « Nouvelle opération » et modale colorée (**livré le 17/11**, PR #102, sans migration) · #74 alléger les lignes de la liste (**livré le 17/11**, PR #101, sans migration) · #76 pastille couleur du compte (**livré le 17/11**, PR #105, sans migration) | Fabien | #69 |
| ensuite | #78 emojis des catégories · #54 libellé du graphique des comptes · #56 « € » à 390 px · #24 contrôle d'appartenance (**livré le 16/11**, PR #96, migration `202611161500` sur TEST et PROD) | Fabien / Sylvie | — |
| avant #10 | #89 Stabiliser `soldes.spec.js` (attendre le focus du Montant avant de saisir) — ajouté au sprint 2 le 17/11 | Quentin | — |
| fin | #10 Validation de l'étape 1 (mise à jour le 05/11), **inclut la recette manuelle de #69, #70, #72, #73, #74 et #76** (en prod, décision du 17/11) | Quentin | tout le jalon |
| après #10 | #100 Statistiques : histogramme de l'épargne sur 6 mois (jalon Étape 4, ne bloque pas #10) — ajouté au sprint 2 le 17/11 | Fabien | — |

**#69 mergé sans recette manuelle (16/11).** PR #88 validée par Quentin (relecture, recette locale, CI verte, y compris les 3 tests connectés sur TEST), puis mergée le 16/11 sans les 3 parcours manuels sur la preview (navigateurs injoignables depuis la session de Quentin). Ces parcours sont à faire dans **#10**, en prod ou sur une preview : 1) plus de bouton Mouvement, filtre de type = Tous / Entrées / Sorties, en modification seulement « + Entrée » / « − Sortie » ; 2) une sortie et une entrée du même montant dans la catégorie « Mouvement de compte » sont visibles dans la liste, ne changent ni les métriques du mois, ni les KPIs, ni les graphiques, ni le top 5, et modifient les soldes des deux comptes ; 3) cocher « Mouvement de compte » sur une autre catégorie affiche le message, l'exclusion suit, puis recocher la catégorie d'origine. Suggestions non bloquantes de Quentin à reprendre : `estMouvementDeCompte` n'est appelée que par les tests (une seule règle à un seul endroit) ; retour arrière de `saveCat` à couvrir dans `mouvement-compte.spec.js`.

**#70 mergé sans recette manuelle (16/11).** PR #91 (CI verte : 30 cas unitaires, 7 parcours e2e à 1280 et 390 px) mergée le 16/11 sans les parcours manuels sur la preview ; le chef de projet testera ensuite, quitte à ouvrir des tickets de correction. Parcours à faire dans **#10** : 1) badge présent en tête de la liste des transactions, vert s'il n'y a aucune opération « Mouvement de compte » dans le mois ; 2) une sortie de 100 € seule → rouge « −100,00 € », puis l'entrée de 100 € sur un autre compte → vert « 0,00 € » ; 3) modifier l'entrée à 90 € → « −10,00 € », la supprimer → « −100,00 € », sans recharger la page ; 4) virement parti le 31 d'un mois et arrivé le 2 du suivant → rouge sur chacun des deux mois, vert en « Tout voir » ; 5) pas de badge dans Statistiques ; lisible à 390 px, sans défilement horizontal.

**#74 mergé sans recette manuelle (17/11).** PR #101 (CI verte : 5 parcours e2e à 1280 et 390 px) mergée sans recette sur la preview : le chef de projet ne fait plus de recette sur la preview pour l'instant (décision du 17/11), la vérification se fera en prod à la fin, dans **#10**. Parcours : 1) aucune ligne n'affiche « Entrée » ni « Sortie » à droite ; une entrée affiche « +X € » en vert, une sortie « -X € » en rouge ; 2) une opération hors Tricount n'affiche plus aucune mention Tricount ; « Valider Tricount » (cliquable) et « ✅ Validé » s'affichent toujours ; 3) le filtre « Hors tricount » ne garde que les opérations hors Tricount ; 4) à 390 px, montants calés à droite, sans défilement horizontal.

**#76 mergé sans recette manuelle (17/11).** PR #105 (CI verte : 10 cas unitaires, 7 parcours e2e à 1280 et 390 px) mergée sans recette sur la preview (décision du 17/11) ; vérification en prod, dans **#10**. Parcours : 1) plus aucun 🏦 dans la liste, chaque ligne affiche « ● Nom du compte » ; 2) la pastille a la couleur du compte (sans couleur valide : bleu par défaut) ; 3) changer la couleur d'un compte (onglet Comptes, ✏️) change la pastille de ses transactions, sans recharger la page ; 4) lisible à 390 px, sans défilement horizontal.

**#72 mergé sans recette manuelle (17/11).** PR #107 (CI verte : 35 cas unitaires, 9 parcours e2e à 1280 et 390 px) mergée sans recette sur la preview (décision du 17/11) ; vérification en prod, dans **#10**. Parcours : 1) choisir un compte n'affiche que ses opérations, « Tous les comptes » les remet toutes ; 2) combiné avec type, catégorie, recherche et « Tout voir », le sous-total correspond toujours aux lignes affichées ; 3) sans filtre catégorie, un virement interne n'entre pas dans les montants du sous-total, avec le filtre sur « Mouvement de compte » il y entre ; 4) la barre Entrées / Sorties / Solde du mois et le badge « Mouvements de compte » ne bougent pas quand on filtre ; 5) à 390 px, filtres et sous-total lisibles, sans défilement horizontal.

#7 (filtre par compte) est fermé, remplacé par #72 ; #75 (« Hors Tricount ») est fusionné dans #74.

Depuis #8, le chef de projet peut modifier ses comptes depuis l'app (type `courant` proposé, plafond et couleur pour tous les types) : la consigne « ne pas modifier un compte avant #8 » est levée.

## 3. État actuel de l'application

### Écrans (onglets)

| Onglet | Contenu |
|---|---|
| Transactions | métriques du mois (hors catégorie « Mouvement de compte », #69), indicateur « Mouvements de compte » en tête de la liste (#70, voir ci-dessous), bouton unique « + Nouvelle opération » (#73, ouvre la modale sur Sortie), liste filtrable (type Tous / Entrées / Sorties, catégorie, Tricount, épingle, compte (#72), tri date / montant ↑↓) avec une ligne de sous-total des opérations affichées (#72, voir ci-dessous), recherche texte (description + note) avec une croix ✕ pour l'effacer (#77, voir ci-dessous), « Tout voir » (tous les mois), épingle cliquable, suivi Tricount ; nom du compte précédé d'une pastille à sa couleur sous la description (#76) ; les opérations de la catégorie « Mouvement de compte » sont listées comme les autres (montant signé et coloré, #74). Plus aucun bouton, type, filtre ni badge « Mouvement » depuis #69 |
| Comptes | patrimoine total (**somme des soldes calculés**), une carte par compte (#8) : solde calculé lu dans `v_soldes_comptes`, dernier solde banque et sa date, écart, voyant, plafond s'il est renseigné, ligne « Depuis le relevé » (#82, voir ci-dessous) ; boutons ✏️ et « Saisir un solde » (fenêtre des relevés, voir #55 ci-dessous) ; graphique d'évolution (courbes des relevés saisis et « Total patrimoine ») |
| Catégories | CRUD des catégories avec sélecteur d'emoji ; suppression avec confirmation (#44, voir ci-dessous) ; bouton ✏️ en `data-cat-id` + `addEventListener` (#49) ; case « ⇄ Mouvement de compte » et mention dans la liste (#69) |
| Statistiques | 3 KPIs (sorties, entrées, taux d'épargne vs mois précédent), barres horizontales par catégorie, évolution 6 mois, top 5 catégories (catégorie « Mouvement de compte » exclue partout, `txPourStats`, #69) |

Sélecteur de mois en en-tête. Authentification Supabase (connexion / inscription).

### Modale transaction (#6)

Champs : type (**− Sortie | + Entrée**, sélecteur toujours visible depuis #73, Sortie présélectionnée en création), description, montant, date, compte, catégorie, Tricount (`non` / `oui` / `oui validé`), note, épinglé (vrai par défaut).

- **Apparence selon le type** (#73, livré le 17/11, PR #102) : classe `type-sortie` / `type-entree` sur `#tx-modal`. Titre « − Nouvelle sortie » / « + Nouvelle entrée » en création et en duplication, « − Modifier la sortie » / « + Modifier l'entrée » en modification, en rouge (`--red`) ou vert (`--green`) ; segment actif du sélecteur sur fond pâle (`aria-pressed`) ; montant précédé de « − » ou « + » (`#tx-montant-signe`) et coloré ; bouton « Enregistrer la sortie » / « Enregistrer l'entrée » (`#tx-modal-save`) rouge ou vert. Le signe est seulement visuel : le montant envoyé reste positif, le sens vient de `type`. Changer de type (`setTxType` → `majApparenceTx`) ne vide aucun champ ; la liste des catégories reste complète quel que soit le type. `resetDeleteConfirm`, qui reconstruit le pied, réapplique l'apparence.
- **Entrée / sortie** : liste « Compte » pré-remplie avec le compte par défaut. Une nouvelle transaction doit avoir un compte ; une ancienne transaction sans compte reste modifiable avec « Aucun compte ».
- **Virement interne** (depuis #69) : deux opérations saisies séparément, une sortie sur le compte de départ et une entrée sur le compte d'arrivée, dans la catégorie cochée « Mouvement de compte ». Plus de type Mouvement ni de listes « Depuis » / « Vers » ; `compte_dest_id` n'est plus envoyée (`construireLigneTx`).
- **Validation avant envoi** : description, montant (vide, illisible, ≤ 0, < 0,01 ou ≥ 10^10 refusés), date, compte. Rien n'est envoyé tant qu'une règle échoue.
- **Erreurs** : toute erreur Supabase est affichée en haut de la modale avec son code (`messageErreurSupabase`), la modale reste ouverte. Les erreurs de suppression, d'épingle et de Tricount sont aussi affichées.

Actions : enregistrer, dupliquer (date du jour), supprimer avec confirmation en 2 temps.
Raccourcis : `Échap` ferme les modales, `N` ouvre une nouvelle transaction, toujours sur Sortie (#73). La description reçoit le focus 100 ms après l'ouverture.

Les 4 fenêtres (transaction, catégorie, compte, solde) **ne se ferment plus au clic à l'extérieur** (#71, livré le 16/11, PR #94) : seulement par « Annuler » (« Fermer » pour les soldes), la croix ✕ ou `Échap`.

### Lignes de la liste des transactions (#74)

Chaque ligne affiche à gauche l'épingle, la description, le compte, la date et la catégorie, la note ; à droite, le **montant signé et coloré** (« +X € » vert pour une entrée, « -X € » rouge pour une sortie), toujours en dernier, calé à droite. Plus de badge « Entrée » / « Sortie » ni de mention « Hors Tricount » (#74, livré le 17/11, PR #101) : seule une opération Tricount affiche, avant le montant, « Valider Tricount » (`oui`, bouton `data-tc-id`) ou « ✅ Validé » (`oui validé`). Le filtre « Hors tricount », la modale et la barre de filtres sont inchangés. Classes CSS `badge-in`, `badge-out` et `btn-tricount-non` supprimées.

**Pastille du compte (#76, livré le 17/11, PR #105).** Sous la description, le nom du compte est précédé d'une **pastille ronde de 8 px** (`.pastille-compte`, `aria-hidden="true"`) à la couleur du compte, à la place du 🏦. La couleur passe uniquement par `couleurCompte()` (`#RRGGBB` valide, sinon `#5B6EF5`) : une valeur piégée en base n'est jamais injectée dans le `style`. Le nom reste échappé (`esc`). Transaction sans compte : ni pastille ni nom ; compte introuvable : « ? » avec la couleur par défaut. Changer la couleur d'un compte change la pastille de ses transactions sans recharger la page. Fonction pure `pastilleCompteTx(tx, comptes)` (renvoie `{libelle, couleur}` ou `null`), qui réutilise `libelleCompteTx`. Hors périmètre : les autres écrans (cartes comptes, modale).

### Filtre par compte et sous-total (#72)

Livré le 17/11 (PR #107, sans migration).

- **Filtre compte** : liste `#f-compte` en fin de barre de filtres, « Tous les comptes » par défaut puis chaque compte, dans l'ordre et avec le libellé de la modale transaction (nom échappé). Elle se combine avec type, catégorie, Tricount, épingle, recherche et « Tout voir ». Une opération sans compte n'apparaît que sous « Tous les comptes ». Remplie à chaque `loadComptes` (`majFiltreCompte`) ; si le compte choisi a disparu, retour à « Tous les comptes ».
- **Ligne de sous-total** (`#tx-sous-total`, entre la barre de filtres et la liste) : « N opérations · +X € · −Y € » (singulier pour une opération ; entrées en vert, sorties en rouge), sur exactement les lignes affichées : tous les filtres et la période (mois affiché, ou tout l'historique en « Tout voir ») ; le tri n'a pas d'effet. Les opérations de la catégorie « Mouvement de compte » comptent dans N mais sont exclues des montants (`txPourStats`), **sauf** si le filtre catégorie la sélectionne. Montants calculés en centimes entiers. Masquée sans ligne affichée ou si le chargement des transactions a échoué. Recalculée à chaque `renderTransactions` (filtres, recherche, mois, « Tout voir », création, modification, suppression).
- **Inchangés** : la barre `#metrics` (sur tous les onglets) et l'indicateur « Mouvements de compte » (#70) ignorent les filtres (décision du 05/11).
- Les listes de filtres sont bornées en largeur (`#f-compte` : 220 px au plus) : un nom de compte très long ne crée pas de défilement horizontal à 390 px.
- Hors périmètre : ouvrir la liste filtrée depuis une carte de l'onglet Comptes (gardé pour plus tard, sans ticket).

### Recherche des transactions (#77)

Croix ✕ à droite du champ de recherche (`#tx-search-clear`, `aria-label` « Effacer la recherche », zone de clic 32 × 32 px), visible seulement quand le champ contient du texte (`majCroixRecherche`, appelée par `renderTransactions`). Un clic (`effacerRecherche`) vide le champ, réaffiche la liste et remet le focus dans le champ, sans toucher aux autres filtres ni à « Tout voir ». Livré le 16/11 (PR #95). Hors périmètre : effacement par `Échap`.

### Chargement des données (#58)

Après la connexion, `onAuthStateChange` affiche l'écran principal puis appelle `chargerDonnees()`, qui encadre `loadAll()` par un compteur `chargementsEnCours` (remis à jour dans un `finally`). Tant qu'un chargement est en cours, les boutons marqués `data-saisie` (« + Nouvelle opération » depuis #73, « + Nouveau compte », « + Nouvelle catégorie ») sont inactifs, avec l'infobulle « Chargement des données en cours… », et la touche `N` ne fait rien ; `openTxModal` refuse aussi une création. Ils redeviennent utilisables à la fin, **même si une lecture échoue** (l'erreur s'affiche comme avant). « Saisir un solde » et le clic sur une transaction ne sont pas concernés (cartes et liste absentes avant le chargement). Livré le 17/11 (PR #98).

### Indicateur « Mouvements de compte » (#70)

- Badge en tête de la carte « Historique » de l'onglet Transactions (`#mvt-compte-indicateur`, sous le titre, avant la recherche), **uniquement** dans cet onglet.
- Valeur : entrées − sorties de la catégorie cochée « Mouvement de compte », calculées en centimes entiers, sur le **mois affiché**, ou sur **tout l'historique** en « Tout voir ». Il **ignore les filtres** et la recherche de la liste.
- Total nul : badge vert « ✓ Mouvements de compte : 0,00 € ». Sinon : badge rouge avec l'écart signé (« ✗ Mouvements de compte : −150,00 € » ou « +… »). Aucune catégorie cochée, ou erreur de chargement des transactions : badge masqué. Une infobulle rappelle le calcul et la période.
- Recalculé à chaque rendu de la liste (`renderIndicateurMouvements`, appelée par `renderTransactions`) : création, modification, suppression, changement de mois, « Tout voir », changement de catégorie cochée, sans recharger la page.
- Non traité (hors périmètre) : détail des virements non appariés.

### Fenêtre catégorie et suppression (#44)

- **Croix ✕ de la liste** : `data-del-cat-id` + `addEventListener` (plus d'`onclick` concaténé) → `demanderSuppressionCat(id)` ouvre la fenêtre catégorie en **mode confirmation compact** (classe `suppression`, seul le pied est visible) : « Supprimer la catégorie <emoji> <nom> ? Les transactions liées passeront en « Sans catégorie ». », boutons **Annuler** (focus par défaut, 100 ms après l'ouverture) et **Confirmer la suppression**. La confirmation nomme toujours la catégorie de la ligne cliquée. « Annuler » ferme la fenêtre.
- **Bouton « Supprimer » de la fenêtre** (après ✏️) : même confirmation, en 2 temps comme pour une transaction (`askDeleteCat`) ; « Annuler » revient à la fenêtre (`annulerSuppressionCat`).
- **Erreur de la base** à la suppression : affichée en haut de la fenêtre avec son code (« Suppression impossible : » + `messageErreurSupabase`, zone `#cat-modal-error`), la fenêtre reste ouverte et la catégorie est conservée.
- **Après suppression** : rechargement des catégories et des transactions ; les transactions de la catégorie apparaissent aussitôt en « Sans catégorie » (FK `on delete set null`).
- **Fermeture** : toutes les fermetures (✕, Annuler, Échap ; plus de fermeture au clic à l'extérieur depuis #71) passent par `closeCatModal()`, qui remet `editingCatId` à `null`.
- **Erreurs à la création et à la modification** (depuis #69) : `saveCat` et `loadCategories` vérifient `error` ; message avec son code en haut de la fenêtre, bouton désactivé pendant l'envoi.

### Catégorie « Mouvement de compte » (#69)

- **Case « ⇄ Mouvement de compte »** dans la fenêtre catégorie (`#modal-cat-mvt`). Une seule catégorie cochée par utilisateur (index unique partiel de #68). La catégorie cochée porte la mention « ⇄ Mouvement de compte » dans la liste.
- **Changer de catégorie cochée** : cocher la case sur une autre catégorie affiche aussitôt « <ancienne> ne sera plus la catégorie Mouvement de compte. » ; à l'enregistrement, deux requêtes (décocher l'ancienne, puis enregistrer la nouvelle, sinon `23505`), avec retour arrière si la seconde échoue ; puis « <ancienne> n'est plus la catégorie Mouvement de compte. » au-dessus de la liste.
- **Exclusion** : les opérations de la catégorie cochée sont visibles dans la liste et comptent dans les soldes des comptes (`v_soldes_comptes`), mais sont exclues de la barre Entrées / Sorties / Solde du mois, des 3 KPIs (mois précédent compris), du graphique par catégorie, de l'évolution 6 mois et du top 5, par une fonction unique, `txPourStats(transactions, categories)`. Elle lit la liste des catégories : changer la catégorie cochée change l'exclusion sans recharger les transactions.
- Aucune catégorie cochée : rien n'est exclu.

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

**Ligne « Depuis le relevé »** (#82, livré le 16/11, PR #85) : dès qu'au moins une opération du compte est datée **strictement après** le dernier relevé (et à partir du solde initial), la carte affiche sous « Écart » la ligne « Depuis le relevé (N opération(s)) » avec le montant net signé (`solde_calcule − solde_calcule_a_date_banque`, + vert, − rouge), et le libellé sous le gros chiffre devient « Solde attendu en banque ». Une opération du jour du relevé n'est pas comptée (elle est incluse dans le relevé). Avec un relevé ancien (« ⏱ N jours ») la ligne s'affiche ; avec « Aucun relevé » ou « Relevé à saisir », ou sans opération après le relevé, la carte est inchangée. Voyant, écart et patrimoine total ne changent pas. Fonction pure `opsDepuisReleve(ligne, transactions)` (bloc #8), qui ne lit que `compte_id` depuis #69.

Tout texte saisi des cartes passe par `esc()` ; les boutons ✏️ et « Saisir un solde » utilisent `data-edit-compte-id` / `data-solde-compte-id` + `addEventListener` (plus d'`onclick` concaténé).

### Modale compte (#8)

Champs : nom, banque, type (**4 types** avec libellés : Compte courant, Livret d'épargne, Investissement, Espèces), solde initial et sa date (par défaut la date du jour locale, `dateLocaleISO()`), compte par défaut, **plafond et couleur pour tous les types**. Le nom reçoit le focus 100 ms après l'ouverture (`#modal-c-nom`).

- **Validation avant envoi** (`validerSaisieCompte`) : rien n'est envoyé tant qu'une règle échoue.
- **Compte par défaut** : changé en **deux requêtes** (retrait sur l'ancien, puis pose sur le nouveau) ; si la seconde échoue, l'ancien défaut est remis et l'erreur affichée.
- **Suppression** en deux temps ; un compte qui porte des opérations est refusé (`23503`) avec le message « Suppression impossible : ce compte porte des opérations… », modale ouverte.
- **Erreurs** : toute erreur Supabase de `saveCompte` / `deleteCompteFromModal` est affichée avec son code (`messageErreurCompte`, qui réutilise `messageErreurSupabase`), la saisie est conservée et la modale reste ouverte.

### Fenêtre « Saisir un solde » (#55)

- Saisie d'un relevé (montant, date, note) : **un seul relevé par compte et par date** ; enregistrer à une date déjà saisie remplace l'ancien relevé, sans message (upsert sur `compte_id,date`, décision du 04/11). Le montant peut être nul ou négatif (découvert) ; il est arrondi au centime.
- **Saisie invalide** (montant vide ou illisible, date vide) : message en haut de la fenêtre (`#solde-modal-error`), aucune requête envoyée.
- **Erreur de la base** à l'enregistrement ou à la suppression (ou coupure réseau) : message avec son code (« Relevé non enregistré : » / « Relevé non supprimé : » + `messageErreurSupabase`), la fenêtre reste ouverte et la saisie est conservée ; le relevé n'est pas supprimé. `console.error('[monbudget] saveSoldeEntry|deleteSoldeEntry', …)`. Le message disparaît au succès suivant et à la réouverture.
- **Croix ✕ de l'historique** (`data-del-solde-id` + `addEventListener`, #49) → `demanderSuppressionSolde(id)` : le pied de la fenêtre affiche « Supprimer le relevé du JJ/MM/AAAA (montant €) ? », **Annuler** (focus) et **Confirmer la suppression** ; la ligne visée est encadrée (classe `a-supprimer`). Une seule confirmation à la fois : la croix d'une autre ligne la remplace. Après une erreur, la confirmation reste proposée.
- **Fermeture** : ✕, « Fermer » et Échap passent par `closeSoldeModal()` (plus de fermeture au clic à l'extérieur depuis #71), qui efface le message et la confirmation. Le focus automatique du montant (100 ms après l'ouverture) n'est pas posé si une confirmation a été ouverte entre-temps.

### Organisation du code (`index.html`)

| Bloc | Fonctions principales |
|---|---|
| Données | `chargerDonnees` (#58 : encadre `loadAll` et met à jour les boutons de saisie par `majBoutonsSaisie`), `loadAll`, `loadCategories`, `loadTransactions` (jointure `categories(nom,emoji)` ; en cas d'erreur, message dans la liste via `erreurChargementTx`), `loadComptes` (charge aussi `soldes`) |
| Rendu | `renderAll`, `renderMetrics`, `renderTransactions`, `renderCategories`, `renderComptes`, `renderChartComptes`, `renderStatsKpis`, `renderCharts` |
| Transactions : fonctions pures (#6) | bloc « FONCTIONS PURES (#6) » : `lireMontant`, `compteParDefaut`, `validerSaisieTx`, `construireLigneTx`, `messageErreurSupabase`, `libelleCompteTx`, constante `MONTANT_MAX`. Sans DOM ni réseau, testées par `tests/front/` |
| Transactions : fonctions pures de la modale (#73) | bloc « DÉBUT / FIN FONCTIONS PURES MODALE TRANSACTION (#73) », juste après `// ── MODAL TX` (après le bloc #45, dont il ne fait pas partie) : `apparenceModaleTx(type, mode)` (titre, couleur, signe, classe, libellé du bouton ; tout type autre que `entrée` est présenté comme une sortie), constante `TYPE_NOUVELLE_TX` (`sortie`). Sans DOM ni réseau, testées par `tests/front/` |
| Transactions : modale | `openTxModal` → `ouvrirModaleTx` (mode `nouveau` / `duplication` / `edition`, gardé dans `modeTxModal`), `lireSaisieTx`, `saveTx`, `setTxType`, `majApparenceTx` (#73), `setTricount`, `dupTx`, `askDeleteTx`, `deleteTxFromModal`, `resetDeleteConfirm`, `afficherErreurTx`, `effacerErreurTx`, `optionsComptes` |
| Indicateur Mouvements de compte : fonctions pures (#70) | bloc « DÉBUT / FIN FONCTIONS PURES INDICATEUR MOUVEMENTS DE COMPTE (#70) », juste après le bloc #69 (réutilise `categorieMouvementCompte`) : `totalMouvementsCompte` (`null` sans catégorie cochée), `badgeMouvementsCompte`. Rendu : `renderIndicateurMouvements`. Sans DOM ni réseau, testées par `tests/front/` |
| Mouvement de compte : fonctions pures (#69) | bloc « DÉBUT / FIN FONCTIONS PURES MOUVEMENT DE COMPTE (#69) », juste après le bloc #6 : `categorieMouvementCompte`, `estMouvementDeCompte` (utilisée seulement par les tests pour l'instant), `txPourStats`, `categorieMouvementARetirer`, `messageMouvementCompteRetire`. Sans DOM ni réseau, testées par `tests/front/` |
| Comptes : fonctions pures (#8) | bloc « FONCTIONS PURES COMPTES (#8) » : `libelleTypeCompte`, `arrondiCentimes`, `ecartCompte`, `voyantCompte`, `totalPatrimoine`, `couleurCompte`, `formatDateFr`, `validerSaisieCompte`, `construireLigneCompte`, `compteDefautARetirer`, `messageErreurCompte`, `opsDepuisReleve` (#82). Sans DOM ni réseau, testées par `tests/front/` |
| Comptes / soldes | `openCompteModal`, `lireSaisieCompte`, `saveCompte`, `askDeleteCompte`, `deleteCompteFromModal`, `closeCompteModal`, `afficherErreurCompte`, `effacerErreurCompte`, `rechargerComptes`, `openSoldeModal`, `closeSoldeModal`, `saveSoldeEntry` (upsert sur `compte_id,date`), `demanderSuppressionSolde`, `deleteSoldeEntry` (relevé en attente : `soldeASupprimerId`), `resetSoldeFooter`, `afficherErreurSolde`, `effacerErreurSolde`, `renderSoldeHistory` (croix ✕ en `data-del-solde-id` + `addEventListener`, #49), `getLastSolde`, `getPrevSolde` |
| Soldes banque : fonctions pures (#55) | bloc « DÉBUT / FIN FONCTIONS PURES SOLDES BANQUE (#55) », juste après le bloc #8 : `validerSaisieSolde`, `trouverSolde`, `messageSuppressionSolde` (utilisent `lireMontant`, `MONTANT_MAX` de #6 et `formatDateFr`, `arrondiCentimes` de #8). Sans DOM ni réseau, testées par `tests/front/` |
| Pastille du compte : fonction pure (#76) | bloc « DÉBUT / FIN FONCTIONS PURES PASTILLE COMPTE (#76) », juste après le bloc #55 : `pastilleCompteTx` (utilise `libelleCompteTx` du bloc #6 et `couleurCompte` du bloc #8). Sans DOM ni réseau, testée par `tests/front/` |
| Catégories : fonctions pures (#44) | bloc « DÉBUT / FIN FONCTIONS PURES CATÉGORIES (#44) », juste avant `// ── MODAL CAT` : `trouverCategorie`, `messageSuppressionCategorie`. Sans DOM ni réseau, testées par `tests/front/` |
| Catégories : fenêtre | `openCatModal`, `saveCat`, `demanderSuppressionCat` (croix ✕), `askDeleteCat`, `annulerSuppressionCat`, `deleteCatFromModal`, `closeCatModal`, `resetCatFooter`, `afficherErreurCat`, `effacerErreurCat` |
| Filtres et sous-total : fonctions pures (#72) | bloc « DÉBUT / FIN FONCTIONS PURES FILTRES ET SOUS-TOTAL (#72) », juste après le bloc #70 : `filtrerTransactions` (période et tous les filtres de la liste, remplace les filtres en ligne de `renderTransactions`), `sousTotalTransactions`, `texteSousTotal`, `valeurFiltreCompte` (utilisent `categorieMouvementCompte` et `txPourStats` du bloc #69). Rendu : `renderSousTotal`, `majFiltreCompte`. Sans DOM ni réseau, testées par `tests/front/` |
| Chargement : fonctions pures (#58) | bloc « DÉBUT / FIN FONCTIONS PURES CHARGEMENT (#58) », juste après le bloc #72 : `saisieBloquee`, `etatBoutonsSaisie`, `raccourciNouvelleTxPossible` (touche `N`), constante `TITRE_CHARGEMENT`. Sans DOM ni réseau, testées par `tests/front/` |
| Navigation | `switchTab`, `changeMonth`, `toggleViewAll`, `majCroixRecherche`, `effacerRecherche` (#77) |
| Environnement | `choisirEnvironnement`, `ENV`, `DOMAINES_PROD` (#20) |
| Utilitaires | `fmt` (format fr-FR 2 décimales), `esc` (échappement HTML de tout texte saisi : liste des transactions (#43), cartes comptes (#8), liste des catégories, listes déroulantes `#modal-tx-cat` et `#f-cat`, historique des soldes et top 5 (#49) ; plus aucun `onclick` construit avec une donnée saisie, seules les grilles d'émojis gardent un `onclick` sur des valeurs constantes du code), `dateLocaleISO` (date du jour dans le fuseau local, bloc « DATE DU JOUR : FONCTION PURE (#45) » ; ne plus utiliser `toISOString` pour « aujourd'hui »), `txOfMonth` |

État global : `currentUser`, `categories`, `editingCatId` (catégorie ouverte dans la fenêtre, `null` à la fermeture), `transactions`, `comptes`, `soldes`, `soldesComptes` (lignes de `v_soldes_comptes`, #8), `currentMonth` (`AAAA-MM`), `viewAllMonths`, `chargementsEnCours` (chargements en cours, #58).

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
| `transactions` | `description`, `montant numeric(12,2)` (strictement positif, `check montant > 0` ; le sens vient de `type`), `type` ∈ {entrée, sortie} (`transactions_type_check`, `mouvement` retiré par #68), `categorie_id`, `date`, `compte_id` (nullable), `compte_dest_id` (**obsolète**, toujours null, plus envoyée par le front depuis #69, suppression par #86), `tricount` ∈ {non, oui, oui validé}, `epingle bool`, `note` | Depuis #68 : un virement interne = une sortie sur le compte de départ + une entrée sur le compte d'arrivée, dans la catégorie cochée « Mouvement de compte » ; contrainte `transactions_compte_dest_id_vide_check` (`compte_dest_id is null`), `transactions_mouvement_comptes_check` supprimée. FK `compte_id` et `compte_dest_id` en `on delete restrict`, indexées (`transactions_compte_dest_id_idx` supprimé avec la colonne par #86). Trigger `transactions_verifier_comptes` (avant insertion ou modification de `compte_id`, `compte_dest_id`, `user_id`, `security invoker`, `search_path` vide) : les comptes référencés doivent appartenir au `user_id` de la transaction, sinon erreur `23503` (la mention de `compte_dest_id` disparaît avec #86). Trigger `transactions_verifier_categorie` (#24, avant insertion ou modification de `categorie_id`, `user_id`, `security invoker`, `search_path` vide) : la catégorie, si elle est renseignée, doit appartenir au `user_id` de la transaction, sinon erreur `23503` « La catégorie de cette opération n'existe pas ou appartient à un autre utilisateur. » ; `categorie_id` null accepté (y compris la remise à null par `on delete set null`). Colonne `direction` **supprimée** (#3). Utilisés par l'interface depuis #6. En prod, les 58 transactions d'origine ont été purgées le 03/11 (#4, copie dans `backup_v1.transactions`). |
| `categories` | `nom`, `type` ∈ {entrée, sortie, les deux}, `couleur`, `emoji`, `mouvement_compte bool` (défaut faux, #68) | Index unique partiel `categories_un_mouvement_compte_par_user` : au plus une catégorie « Mouvement de compte » par utilisateur ; changer de catégorie cochée se fait en deux requêtes (décocher l'ancienne puis cocher la nouvelle, sinon `23505`). La migration #68 a coché « Virement interne » (nom comparé sans casse ni espaces) et l'a passée en `les deux`. En prod : « Virement interne » cochée, seule cochée. Lue par `loadCategories` (`select *`) ; exclusion des statistiques par le front (#69). |
| `comptes` | `nom`, `type` ∈ {courant, livret, investissement, especes} (défaut `courant`), `banque`, `couleur`, `solde_initial numeric(12,2)` (défaut 0, **peut être négatif**), `date_solde_initial date`, `par_defaut bool` (défaut faux), `plafond numeric(12,2)` (nullable, `> 0` si renseigné) | Index unique partiel `comptes_un_par_defaut_par_user` : un seul compte par défaut par utilisateur, quel que soit son type. Toutes les colonnes sont éditables depuis la modale compte depuis #8. En prod (#4, 03/11) : **7 comptes** avec leur solde initial au soir du 30/09/2026, ramené par le chef de projet au **31/10/2026** (05/11) (3 `courant` dont le compte par défaut, 3 `livret`, 1 `investissement`), `plafond` vide et couleur par défaut, à renseigner par le chef de projet depuis l'app ; les 3 anciens comptes et leurs 5 soldes banque ont été supprimés. |
| `soldes` | `compte_id`, `date`, `montant`, `note` | Unicité `(compte_id, date)`. FK `compte_id` en `cascade`. Soldes banque saisis à la main (relevés). Trigger `soldes_verifier_compte` (#24, avant insertion ou modification de `compte_id`, `user_id`, `security invoker`, `search_path` vide) : le compte du relevé doit appartenir au `user_id` du relevé, sinon erreur `23503` « Le compte de ce relevé n'existe pas ou appartient à un autre utilisateur. » ; il passe avant la détection du conflit, donc un upsert `(compte_id, date)` sur le compte d'un autre est refusé aussi. |

Vue `v_soldes_comptes` (#5, migration `202611031145_vue_soldes_comptes.sql`, en prod le 03/11 ; recréée par #68, migration `202611161145_mouvement_de_compte.sql`, en prod le 16/11, mêmes colonnes) : une ligne par compte de l'utilisateur, `security_invoker = on` (soumise à la RLS de l'utilisateur qui l'interroge).

| Colonne | Contenu |
|---|---|
| `compte_id`, `user_id`, `nom`, `type`, `solde_initial`, `date_solde_initial` | repris du compte |
| `solde_calcule` | solde initial + entrées − sorties du compte (`compte_id`), pour les transactions datées à partir de `date_solde_initial` (incluse) ; un virement interne compte donc en sortie sur le compte de départ et en entrée sur le compte d'arrivée. Plus aucune branche `mouvement` ni lecture de `compte_dest_id` depuis #68 |
| `dernier_solde_banque`, `date_dernier_solde_banque` | dernière ligne de `soldes` du compte |
| `solde_calcule_a_date_banque` | solde calculé arrêté à la date du dernier solde banque (incluse) ; `null` si ce relevé est antérieur à `date_solde_initial` |
| `ecart` | `dernier_solde_banque − solde_calcule_a_date_banque` (même règle du `null`) |
| `nb_jours_depuis_releve` | jours écoulés depuis le dernier relevé, calculé en UTC (accepté le 03/11) |

Lue par l'interface depuis #8 (`sb.from('v_soldes_comptes').select('*')` dans `loadComptes`).

Migrations : fichiers `supabase/migrations/<AAAAMMJJHHMM>_<nom>.sql`, appliqués par le chef de projet dans l'éditeur SQL du dashboard, puis inscrits dans `supabase_migrations.schema_migrations` par Sylvie avec la version = préfixe du fichier, identique sur les deux bases (#22). Exception historique acceptée : `etape1_comptes_tous_types_virements` (#3), appliquée le 02/11/2026, est inscrite avec `20261102102800` sur test et `20261102103500` sur prod. Dernière migration : `202611161500_controle_appartenance.sql` (#24), appliquée sur TEST puis PROD le 16/11, version `202611161500` sur les deux bases ; elle s'interrompt si une ligne existante viole déjà la règle (garde-fou). Empreinte du schéma `public` après #24 : `supabase/README.md`, *Contrôle d'identité*.

### Tests et CI (#25 livré le 03/11/2026, #9 livré le 04/11/2026)

Mode d'emploi complet (lancer en local, lire un échec, écrire un test) : `tests/README.md`.

- `tests/sql/` : sur un Postgres jetable, `run.sh` rejoue `supabase/bootstrap/` puis **toutes** les migrations de `supabase/migrations/` (ordre des noms) sur des données fictives, puis les cas de `tests/sql/cas/` (**187 cas au 16/11 sur 5 fichiers** : `ticket03_comptes_virements.sql`, `ticket05_vue_soldes_comptes.sql`, `ticket68_mouvement_de_compte.sql`, `ticket24_controle_appartenance.sql` (#24, 28 cas : refus du compte ou de la catégorie d'un autre utilisateur en insertion, upsert et modification, catégorie null, écritures légitimes du front) et `front_non_regression.sql` (requêtes de `index.html`, dont 11 ajoutés par #8) ; depuis #24, les cas « ÉCART #24 » de `ticket03` attendent `23503` et le cas de la vue de `ticket05` pose son relevé mal rattaché trigger désactivé). Mode d'emploi : `tests/sql/README.md`.
- Chaque nouveau ticket de base ajoute son fichier `tests/sql/cas/ticketNN_<sujet>.sql` ; chaque nouvelle requête `sb.from(...)` du front est ajoutée à `cas/front_non_regression.sql`.
- `tests/front/` : tests unitaires Node, sans dépendance, des fonctions pures de `index.html` extraites telles quelles entre leurs marqueurs : `ticket06_fonctions_tx.test.js` (#6, 47 cas), `ticket08_comptes.test.js` (#8, 85 cas), `ticket45_date_locale.test.js` (#45, 20 cas, avec `TZ=Europe/Paris`), `ticket44_categories.test.js` (#44, 16 cas), `ticket55_soldes.test.js` (#55, 30 cas), `ticket82_depuis_releve.test.js` (#82, 23 cas), `ticket69_mouvement_compte.test.js` (#69, 31 cas ; cas « mouvement » de `ticket06` et `ticket82` réécrits en sortie + entrée), `ticket70_indicateur_mouvements.test.js` (#70, 30 cas), `ticket58_chargement.test.js` (#58, 14 cas), `ticket73_modale_tx.test.js` (#73, 20 cas), `ticket76_pastille_compte.test.js` (#76, 10 cas), `ticket72_filtres_sous_total.test.js` (#72, 35 cas). 361 cas au 17/11. Tous lancés par `cd tests && npm run test:unitaires`. Le bloc #6 s'arrête au début du bloc #45 : un nouveau bloc de fonctions pures doit avoir un marqueur de début **et** de fin, comme le bloc #8.
- `tests/e2e/` (#9) : Playwright (versions épinglées dans `tests/package.json`), `index.html` servi en local sur `127.0.0.1` (donc TEST), fuseau `Europe/Paris`.
  - **Sans connexion** (projets `bureau-1280` et `mobile-390`) : CDN servis depuis `tests/node_modules`, faux Supabase en mémoire (`e2e/outils.js`) qui enregistre les écritures et peut renvoyer une erreur Postgres, horloge figée au 04/11/2026 10 h ; tout appel hors TEST et toute erreur console non attendue font échouer le test. Parcours : démarrage et bandeau TEST, écran de connexion, créer puis supprimer une transaction, changer de mois, erreur de la base affichée, fonctions pures appelées dans la page, ouverture juste après minuit ; suppression de catégorie (`e2e/categories.spec.js`, #44 : 9 parcours à 1280 et 390 px, un par critère d'acceptation plus la non-régression création / modification) ; échappement HTML (`e2e/echappement.spec.js`, #49 : 5 parcours à 1280 et 390 px, noms de catégories et note de solde piégés, crayon d'une catégorie avec apostrophe, filtre et affectation, croix du bon solde, rendu inchangé sans caractère spécial) ; soldes banque (`e2e/soldes.spec.js`, #55 : 7 parcours à 1280 et 390 px, erreur de la base et coupure réseau à l'enregistrement, saisie invalide sans requête, confirmation de la croix ✕, erreur à la suppression, croix cliquée juste après l'ouverture, confirmation visible sans défilement horizontal). Ajoutés le 16/11 : carte compte « Depuis le relevé » (`e2e/depuis-releve.spec.js`, #82 : 6 parcours) catégorie « Mouvement de compte » (`e2e/mouvement-compte.spec.js`, #69 : 8 parcours) et indicateur « Mouvements de compte » (`e2e/indicateur-mouvements.spec.js`, #70 : 7 parcours) ; ajouté le 17/11 : lignes allégées (`e2e/lignes-transactions.spec.js`, #74 : 5 parcours, sans badge de type ni mention hors Tricount, « Valider Tricount » cliquable, filtre Tricount, montant calé à droite) ; `soldes-comptes.spec.js` réécrit avec un virement en sortie + entrée. Ajouté le 17/11 : bouton unique et modale colorée (`e2e/nouvelle-operation.spec.js`, #73 : 9 parcours, un par critère d'acceptation, plus correction du type en modification, duplication, annulation d'une suppression, erreur de la base et absence de défilement horizontal) ; les parcours qui cliquaient sur « + Entrée d'argent » / « − Sortie d'argent » passent par `nouvelleOperation(page, type)` de `e2e/outils.js`. Ajouté le 17/11 : filtre par compte et sous-total (`e2e/filtre-compte.spec.js`, #72 : 9 parcours, ordre des comptes, filtre seul et combiné, sous-total avec et sans filtre sur « Mouvement de compte », sous-total masqué, `#metrics` et indicateur #70 inchangés, mise à jour après création, nom de compte piégé, compte disparu, absence de défilement horizontal). Au 17/11 en local, `main` à jour : **210 réussis, 3 ignorés** (connectés, sans secrets).
  - Fausse base (`e2e/outils.js`) : tables actuelles, filtres `eq`, 3 catégories (`c1` 🛒, `c2` 🎮, et `cv` « TEST QA Virement interne » cochée `mouvement_compte`, #69), `on delete set null` sur `transactions.categorie_id` (#44), vue des soldes sans `compte_dest_id`, refus `23514` d'un type autre qu'entrée / sortie et `23505` d'une 2ᵉ catégorie cochée (#68). Elle ne reproduit pas `transactions_compte_dest_id_vide_check` (sans enjeu, disparaît avec #86). Elle ignore `order` : pour vérifier qu'une action vise la bonne ligne, ne pas placer la ligne ciblée en premier dans la table (piège vu sur #49).
  - **Connectés** (projet `connecte`, 3 tests) : vraie base TEST `ebupazakzfbpptmlrzze` avec l'utilisateur de test (secrets `TEST_EMAIL` / `TEST_PASSWORD`, jamais lus par un agent) ; connexion, créer puis supprimer une transaction `TEST QA e2e …` (supprimée même en cas d'échec), changer de mois. Ignorés sans secrets. Sans trace ni capture, et sans rapport publié en CI : une trace Playwright ou l'instantané d'échec contiennent le mot de passe en clair, et le repo est public.
  - Un nouveau parcours s'ajoute sur le modèle de `e2e/transactions.spec.js` ou `e2e/categories.spec.js`. Pour créer une opération, utiliser `nouvelleOperation(page, 'sortie' | 'entrée')` (#73) : elle clique « + Nouvelle opération », attend le focus de la description, puis bascule sur « + Entrée » si besoin. Dans une modale, attendre le focus automatique (100 ms après l'ouverture : description de la modale transaction, `#modal-c-nom` de la modale compte, `#modal-cat-nom` de la fenêtre catégorie, « Annuler » de la confirmation ouverte par la croix ✕) avant de remplir. Un comportement lié à un délai de l'app (`setTimeout`) se teste par un parcours déterministe (actions groupées dans un seul `evaluate`, puis attente au-delà du délai) : la CI, plus rapide, a fait échouer sur #55 un test qui passait en local.
- GitHub Actions `.github/workflows/tests.yml`, à chaque PR et push sur `main` : `tests-sql` (Postgres 17, sans secret), `tests-front` (unitaires), `tests-e2e` (Playwright sans connexion, rapport publié en artefact en cas d'échec ; puis connecté, sans rapport).
- `main` est protégée : merge uniquement par PR, avec les checks `tests-sql`, `tests-front` et `tests-e2e` verts (les deux derniers depuis le 04/11/2026).
- Recette navigateur manuelle de Quentin (preview ou `localhost`, contrôle du bandeau) : toujours possible pour ce que les tests automatiques ne couvrent pas.

### Dette technique connue

- Erreurs Supabase non affichées : réglé pour les transactions (#6) et les comptes (#8). Suppression de catégorie réglée par #44. Soldes banque réglés par #55. Création et modification des catégories (`saveCat`) réglées par #69.
- Deux « patrimoine » différents dans l'onglet Comptes (relevé par Quentin, #8) : le « Patrimoine total » du haut est la somme des **soldes calculés**, la courbe « Total patrimoine » du graphique est la somme des **derniers relevés** saisis à chaque date (`renderChartComptes`). Même nom, chiffres possiblement différents : #54.
- Page ouverte pendant le passage de minuit : la modale propose la nouvelle date mais l'en-tête garde l'ancien mois jusqu'au rechargement (préexistant, pas de ticket ; la date du jour elle-même est corrigée par #45).
- Erreur de chargement des transactions : la liste l'affiche, mais les métriques gardent les données précédentes (non bloquant, pas de ticket).
- `Échap` ne ferme aucune modale quand le focus est dans un champ (règle globale du raccourci clavier ; ex. champ « Nom » de la fenêtre catégorie). Pas de ticket, signalé par Fabien sur #44.
- Test e2e instable (17/11, PR #102) : `soldes.spec.js` « montant vide ou date vide » a échoué une fois en CI à 1280 px (note du relevé vide juste après la saisie), puis est passé à la relance, sans changement de code ; il réussit en local. Hypothèse : saisie faite avant la fin de l'initialisation de la fenêtre « Saisir un solde ». La relance des checks est bloquée par le proxy en session cloud : relance par un commit vide sur la branche. Pas de ticket, petit ticket `[qa]` à proposer au chef de projet.
- Aucune icône déclarée : 404 sur `/favicon.ico` dans la console (cosmétique).
- Affichage à 390 px (#30) : nom de catégorie très long coupé dans « Sorties par catégorie », « € » seul à la ligne sur le patrimoine total (cosmétique, toujours présent après #8 : #56 ; pas de défilement horizontal).
- `messageErreurSupabase` traduit tout `23503` par « un compte choisi est introuvable ou n'est pas à vous », y compris quand c'est la **catégorie** qui est refusée par le trigger `transactions_verifier_categorie` (#24). Constat de Quentin sur #24 ; pas de ticket, petit ticket `[front]` à proposer au chef de projet.
- Migrations appliquées à la main (automatisation prévue après le sprint 1 : #32).
- Recherche du sélecteur d'emoji des catégories inopérante : saisir un mot affiche tous les emojis (aucun mot-clé) : #78.

## 4. Décisions

| Date | Décision | Raison |
|---|---|---|
| — | Graphique camembert remplacé par barres horizontales | lisibilité, choisi après 3 aperçus |
| — | Top 5 = cumul par catégorie | plus utile que les 5 plus grosses opérations |
| — | Nouvelle transaction épinglée par défaut | choix du chef de projet |
| — | Les mouvements sont exclus de toutes les stats **Remplacée le 05/11/2026.** | ce sont des virements internes |
| 29/10/2026 | Pas d'import bancaire | choix du chef de projet |
| 29/10/2026 | Équipe : coach, supabase, front, qa ; backlog dans GitHub Issues | voir `CLAUDE.md` |
| 29/10/2026 | Les agents ont un prénom : Corentin (coach), Sylvie (supabase), Fabien (front), Quentin (qa) ; labels et préfixes de tickets inchangés | plus simple à appeler, voir `CLAUDE.md` |
| 29/10/2026 | Sauvegarde v1 avant refonte (branche `sauvegarde/v1`, schéma `backup_v1`) ; une sauvegarde avant chaque étape | retour arrière rapide, voir `docs/RESTAURATION.md` |
| 29/10/2026 | Virement = une seule transaction `mouvement` avec `compte_id` (source) et `compte_dest_id` (destination) ; `direction` abandonnée (#2, option A) **Remplacée le 05/11/2026.** | une ligne = un virement, pas de demi-virement possible |
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
| 03/11/2026 | Solde initial de chaque compte = solde **au soir du 30/09/2026** ; seules les transactions datées **à partir du 01/10/2026** sont saisies **Remplacée le 05/11/2026.** | sinon double comptage dans `v_soldes_comptes` |
| 03/11/2026 | `nb_jours_depuis_releve` de `v_soldes_comptes` reste calculé en UTC | écart d'au plus un jour, sans enjeu |
| 03/11/2026 | Comptes de prod (#4) : 3 comptes `courant`, dont le compte par défaut ; plafonds et couleurs non renseignés, ajoutés par le chef de projet après #8, qui doit proposer plafond et couleur pour tous les types ; ne pas modifier un compte depuis l'app avant #8 (consigne levée : #8 livré le 03/11) | la modale compte actuelle ne connaît ni le type `courant` ni le plafond |
| 03/11/2026 | Nouvelle transaction : compte obligatoire ; une ancienne transaction sans compte reste modifiable avec « Aucun compte » (#6) | toutes les nouvelles opérations alimentent le solde calculé, sans bloquer l'historique |
| 03/11/2026 | Les mouvements restent **visibles dans la liste** (badge « Mouvement », filtre « Mouvements ») et toujours **exclus des métriques et des statistiques** (#6) **Remplacée le 05/11/2026.** | voir les virements sans fausser le budget |
| 03/11/2026 | Échappement HTML des cartes comptes intégré à #8 (`esc()` + `data-*-id`, plus d'`onclick` concaténé) | l'écran était refait ; les boutons cassaient sur une apostrophe |
| 03/11/2026 | Règles du voyant des cartes comptes, dans l'ordre : aucun relevé → « Aucun relevé » ; relevé ≥ 31 j → « ⏱ N jours » même avec écart ; relevé antérieur au solde initial → « Relevé à saisir » ; écart ≠ 0 → « ⚠ écart » ; écart 0 et 0–14 j → « ✓ rapproché » (vert) ; écart 0 et 15–30 j → « ✓ il y a N j » (bleu) ; relevé futur = 0 j (#8, proposition de Fabien validée) | un relevé trop ancien ne permet plus de conclure ; distinguer « concordant récent » et « concordant ancien » |
| 03/11/2026 | Patrimoine total de l'onglet Comptes = somme des **soldes calculés** (#8) | refléter les opérations saisies, pas seulement les relevés |
| 03/11/2026 | #44 et #49 intégrés au sprint 1 (PR #51) ; #8 reçoit le label `sprint-1` | bugs courts, même écran ; #8 était déjà traité dans le sprint |
| 04/11/2026 | Carte « Top 5 catégories de dépenses » laissée masquée quand le mois affiché n'a aucune sortie (comportement de `renderStatsKpis` depuis la session 2) ; #49 ne change que l'échappement | comportement voulu, pas un bug |
| 04/11/2026 | Checks `tests-front` et `tests-e2e` obligatoires sur `main`, en plus de `tests-sql` (#9) | une PR qui casse un parcours ou une fonction pure ne peut plus être mergée |
| 04/11/2026 | Tests connectés en CI sans trace, capture ni rapport publié (#9) | le repo est public et une trace contient la saisie du mot de passe |
| 04/11/2026 | Suppression de catégorie : la croix ✕ ouvre la fenêtre catégorie en mode confirmation compact (pas de nouvelle modale) ; « Annuler » ferme la fenêtre si on vient de la croix, revient à l'édition si on vient du bouton « Supprimer » (#44) | une seule fenêtre à maintenir, même confirmation en 2 temps que les transactions |
| 04/11/2026 | #55 (erreurs des soldes banque) intégré au sprint 1 en supplément, avec une confirmation en 2 temps sur la croix ✕ de l'historique des soldes | relevés au cœur du voyant des comptes ; même confirmation que pour les transactions et les catégories |
| 04/11/2026 | Un seul relevé par compte et par date : enregistrer à une date déjà saisie remplace l'ancien relevé, sans message (upsert sur `compte_id,date`) | comportement existant, conservé |
| 03/11/2026 | Les soldes des comptes suivent les opérations (entrée = crédit, sortie = débit, mouvement = débit de « Depuis » et crédit de « Vers », **partie mouvement remplacée le 05/11/2026**) pour voir l'écart avec le solde réel : calcul par `v_soldes_comptes` (#5), affichage par #8, pas de nouveau ticket | besoin déjà couvert |
| 05/11/2026 | **Abandon du type `mouvement`** : un virement interne se saisit en une **sortie** sur le compte de départ et une **entrée** sur le compte d'arrivée. Une catégorie par utilisateur peut être cochée **« Mouvement de compte »** (`categories.mouvement_compte`, index unique partiel ; cochée sur « Virement interne » par la migration) : ses opérations sont visibles dans la liste, comptent dans les soldes et sont **exclues des métriques et des statistiques**. Pas de case générique « exclure des statistiques ». Remplace les décisions « mouvements exclus des stats », 29/10 (#2, option A) et 03/11 (#6) (#68, #69) | avec un seul mouvement « Depuis → Vers », on voyait mal de quel compte vers quel compte |
| 05/11/2026 | Indicateur **« Mouvements de compte »** = entrées − sorties de la catégorie cochée, attendu à **0** ; badge vert « ✓ 0,00 € » ou rouge avec l'écart ; uniquement en tête de la liste des transactions (pas dans Statistiques), sur le mois affiché ou tout l'historique en « Tout voir » ; il ignore les filtres (#70) | repérer un virement saisi à moitié ou avec un mauvais montant |
| 05/11/2026 | Soldes initiaux des comptes de prod **au 31/10/2026**, transactions saisies **à partir du 01/11/2026** (remplace la décision du 03/11 sur le 30/09) | choix du chef de projet |
| 05/11/2026 | La barre Entrées / Sorties / Solde du mois (`#metrics`), commune à tous les onglets, ne suit **aucun** filtre ; les totaux de ce qui est affiché vont dans une ligne de sous-total de la carte « Historique » qui suit tous les filtres et « Tout voir » ; la catégorie « Mouvement de compte » y est exclue sauf si on filtre dessus (#72) | ne pas changer le sens d'indicateurs visibles partout |
| 05/11/2026 | Les 4 modales ne se ferment plus au clic à l'extérieur, seulement par Annuler, ✕ ou Échap (#71) | ne plus perdre une saisie en cours |
| 05/11/2026 | Un seul bouton « + Nouvelle opération » qui ouvre la modale sur **Sortie** ; sélecteur − Sortie / + Entrée visible dès la création ; modale rouge ou verte, montant précédé de − ou + ; toutes les catégories proposées quel que soit le type (#73, maquettes validées) | les sorties sont bien plus fréquentes, éviter le mauvais bouton |
| 05/11/2026 | Lignes de la liste des transactions allégées : plus de badge « Entrée » / « Sortie » (le montant signé et coloré suffit), plus de mention « Hors Tricount » (#74) ; pastille ● à la couleur du compte à la place du 🏦 (#76, option A préférée au liseré) | liste plus lisible |
| 05/11/2026 | Catégories : on reste sur les emojis (pas d'icônes au trait), catalogue élargi, recherche par mots-clés, saisie libre d'un seul emoji (#78) | pas de migration, gain sans refonte |
| 05/11/2026 | Sprint 1 clos en avance (tous ses tickets livrés) ; **sprint 2 du 06/11 au 19/11 inclus**, objectif terminer et valider l'étape 1 : 16 tickets (#10, #24, #54, #56, #58, #68 à #74, #76 à #78, #80) ; #71 et #56 rattachés au jalon Étape 1 | rythme de deux semaines conservé ; la vitesse du sprint 1 (20 tickets) et la majorité de tickets S le permettent, le goulot étant les migrations et recettes du chef de projet |
| 16/11/2026 | Sprint 2 démarré le 16/11 (au lieu du 06/11) et prolongé jusqu'au **20/11/2026 inclus** ; #82 (carte compte : opérations depuis le relevé, option A) intégré au sprint, 17 tickets ; ordre de sortie en cas de débordement : #82, #78, #56, #54 | décision du chef de projet : le sprint commence seulement aujourd'hui ; #82, taille S sans dépendance, lève une confusion dans la saisie de prod |
| 16/11/2026 | Carte compte (#82) : avec un relevé ancien (« ⏱ N jours ») dont l'écart reste calculable, la ligne « Depuis le relevé » et le libellé « Solde attendu en banque » s'affichent ; pas de ligne seulement avec « Aucun relevé » et « Relevé à saisir » | c'est quand le relevé est ancien que la ligne sert le plus ; le voyant invite déjà à saisir un nouveau relevé |
| 16/11/2026 | #69 (PR #88) puis #70 (PR #91) mergés en prod sans la recette manuelle sur la preview ; leurs parcours manuels sont faits dans #10 (validation de l'étape 1), avec des tickets de correction si besoin | recette automatique et relecture de Quentin validées ; navigateurs injoignables depuis sa session |
| 16/11/2026 | Contrôle d'appartenance (#24) par **deux fonctions de trigger séparées**, `soldes_verifier_compte` et `transactions_verifier_categorie`, plutôt qu'en étendant `transactions_verifier_comptes` (#3), qui reste inchangée ; mêmes conventions que #3 (`security invoker`, `search_path` vide, erreur `23503` en français) | `soldes` est une autre table ; #86 doit réécrire la fonction de #3, on évite que deux tickets modifient la même fonction ; chaque trigger ne se déclenche que sur ses colonnes (`update of …`) |
| 16/11/2026 | Migration #68 : `transactions.compte_dest_id` **conservée** et forcée à null (`transactions_compte_dest_id_vide_check`) au lieu d'être supprimée ; sa suppression (colonne, FK, index `transactions_compte_dest_id_idx`, mention dans le trigger `transactions_verifier_comptes`, contrainte) passe dans un ticket de suivi, #86, à faire une fois #69 en prod | le front actuel envoie `compte_dest_id: null` à chaque enregistrement (`saveTx`) : supprimer la colonne aurait cassé toute saisie en prod entre l'application de #68 et le merge de #69 |
| 17/11/2026 | Le chef de projet ne fait plus de recette manuelle sur la preview pour l'instant : les tickets sont mergés après la CI verte, et un test en prod est fait à la fin (dans #10) ; concerne #74 (PR #101), #73 (PR #102), #76 (PR #105) et #72 (PR #107), mergés le 17/11 | choix du chef de projet |
| 17/11/2026 | #89 (stabiliser `soldes.spec.js`), #86 (suppression de `compte_dest_id`) et #100 (histogramme de l'épargne, jalon Étape 4) ajoutés au sprint 2 : 20 tickets ; ordre de fin de sprint #78 → #54 → #56 → #89 → #86 → #10 → #100 ; débordement : on sort #100, #89, #56, #54 | décision du chef de projet : le sprint est en avance (13 tickets sur 17 livrés le 17/11 à 11 h 30). #86 appartient au jalon Étape 1 et passe avant #10 ; #100 relève de l'étape 4 et ne bloque pas la validation |

Décisions en attente : voir les tickets labellisés `decision`.

## 5. Glossaire

- **Solde calculé** : solde initial du compte (à sa date de solde initial) + somme des transactions rattachées à ce compte depuis cette date (un virement interne y compte en sortie sur un compte et en entrée sur l'autre).
- **Solde banque** : solde lu sur le relevé, saisi dans `soldes`.
- **Écart** : solde banque − solde calculé (ou − solde pointé pendant un rapprochement).
- **Pointer** : cocher une opération vue sur le relevé.
- **Rapprocher** : valider qu'à une date donnée, solde pointé = solde banque ; les opérations concernées sont alors verrouillées.
- **Mouvement de compte** : catégorie cochée (une par utilisateur) qui regroupe les virements entre comptes de l'utilisateur ; chaque virement = une sortie + une entrée ; neutre pour les stats, compté dans les soldes. Le type `mouvement` n'existe plus (#68, #69).
- **Plafond suggéré** : limite mensuelle proposée pour une catégorie à partir de ses dépenses des 3 ou 6 mois précédents (médiane par défaut). Indicatif sous 3 mois d'historique ; pour une catégorie irrégulière, on propose une provision égale à la moyenne.
- **Cagnotte** : objectif d'épargne virtuel (montant, date cible) adossé à un ou plusieurs comptes épargne.
