# Tests de monbudget

Trois familles de tests, lancées automatiquement par GitHub Actions (`.github/workflows/tests.yml`) à chaque pull request, après chaque merge sur `main`, et à la demande (onglet *Actions* → *Tests* → *Run workflow*). **Une PR dont un job est rouge ne doit pas être mergée.**

| Job | Dossier | Ce qu'il vérifie | Réseau / secrets |
|---|---|---|---|
| `tests-sql` (#25) | `sql/` | Migrations rejouées sur un Postgres jetable, contraintes, RLS, vues | aucun (voir `sql/README.md`) |
| `tests-front` (#9) | `front/` | Fonctions pures de `index.html` (calculs, validations, dates) | aucun |
| `tests-e2e` (#9) | `e2e/` | L'app dans un vrai navigateur (Playwright) | sans connexion, puis base TEST avec `TEST_EMAIL` / `TEST_PASSWORD` |

```
tests/
├── package.json, package-lock.json   dépendances des tests (versions épinglées)
├── playwright.config.js              configuration Playwright (serveur local, fuseau Paris, projets)
├── front/                            tests unitaires Node (aucune dépendance)
├── e2e/
│   ├── serveur.js                    sert index.html sur http://127.0.0.1:8123/
│   ├── outils.js                     fixtures : faux Supabase, CDN locaux, contrôle du bandeau TEST
│   ├── environnement.spec.js         démarrage sur TEST, bandeau, écran de connexion
│   ├── transactions.spec.js          créer / supprimer une transaction, changer de mois, erreur base
│   ├── fonctions-pures.spec.js       fonctions de index.html appelées dans la page (page.evaluate)
│   └── connecte.spec.js              mêmes parcours sur la vraie base TEST
└── sql/                              tests SQL (#25)
```

## Lancer les tests en local

Il faut Node 22. Depuis le dossier `tests/` :

```bash
npm ci                                  # installe les dépendances (une fois)
npx playwright install chromium         # télécharge le navigateur de Playwright (une fois)
npm test                                # tests unitaires, puis Playwright
```

Ou séparément :

```bash
npm run test:unitaires                  # tests/front, quelques secondes
npx playwright test                     # tous les tests Playwright
npx playwright test transactions        # un seul fichier (le nom suffit)
npx playwright test --project=mobile-390
npx playwright test --headed            # en voyant le navigateur
npx playwright test --ui                # mode interactif : pas à pas, avec l'état de la page
```

Sans les variables `TEST_EMAIL` / `TEST_PASSWORD`, les 3 tests connectés sont **ignorés** (« skipped ») : c'est normal en local. Résultat attendu : `20 passed, 3 skipped`.

**Session cloud de Claude** : le téléchargement du navigateur est bloqué ; utiliser le Chrome du système :

```bash
CHROMIUM_PATH=/usr/bin/google-chrome npx playwright test
```

## Les tests sans connexion (`bureau-1280`, `mobile-390`)

L'app est servie en local, donc branchée sur TEST (aiguillage de #20), mais **aucune requête ne sort** :

- les CDN (`supabase-js`, `Chart.js`) sont servis depuis `tests/node_modules` ;
- les appels à Supabase TEST sont interceptés et servis par une **fausse base en mémoire** (fixture `base` de `e2e/outils.js`), qui note aussi chaque écriture envoyée par l'app (`base.ecritures`) et peut renvoyer une erreur Postgres à la demande (`base.forcerErreur('23514')`) ;
- tout appel vers un autre site, ou vers un autre projet Supabase (la prod), est **bloqué et fait échouer le test** ;
- l'horloge de la page est figée au **mercredi 4 novembre 2026, 10 h, heure de Paris**, avec `timezoneId: 'Europe/Paris'` : les dates et le mois affiché sont toujours les mêmes ;
- à la fin de chaque test, **toute erreur dans la console** fait échouer le test, sauf celles déclarées attendues (`journal.attendre(/motif/)`).

Avant toute action, la fixture `app` contrôle, comme le ferait Quentin à la main : URL locale, bandeau « Environnement de TEST » visible, message console `[monbudget] environnement : test`.

## Les tests connectés (`connecte`)

Ils rejouent la connexion, la création puis la suppression d'une transaction et le changement de mois sur la **vraie base TEST `ebupazakzfbpptmlrzze`**, avec l'utilisateur de test dédié.

- Identifiants : variables d'environnement `TEST_EMAIL` / `TEST_PASSWORD`, alimentées en CI par les secrets GitHub du même nom (*Settings → Secrets and variables → Actions*). Aucun agent ne les lit ni ne les saisit.
- Les données créées commencent par `TEST QA e2e` suivi d'un identifiant unique, et sont **supprimées à la fin du test, même en cas d'échec**. Le jeu de données de #21 n'est jamais touché.
- Pas de trace ni de capture pour ces tests, et le champ mot de passe est vidé juste après le clic sur « Se connecter » : vérifié le 04/11, une trace Playwright ou l'instantané de page joint à un échec contiendrait sinon le mot de passe en clair.
- En CI, ils tournent dans une **étape à part, sans rapport publié** : le repo est public, un artefact serait téléchargeable par n'importe quel compte GitHub.

En local, seul le chef de projet peut les lancer, en tapant lui-même les identifiants (jamais dans une conversation ni un fichier) :

```bash
read -r TEST_EMAIL; read -rs TEST_PASSWORD; export TEST_EMAIL TEST_PASSWORD
npx playwright test --project=connecte
```

## Lire un échec

**Sur GitHub** : dans la PR, *Checks* → *Tests* → job rouge. Le journal liste chaque test (`✓` / `✘`) et le message d'erreur ; les erreurs sont aussi annotées directement dans l'onglet *Files changed*.

Un message Playwright se lit ainsi :

```
✘ [mobile-390] › e2e/transactions.spec.js:45:1 › changer de mois
    Error: expect(locator).toHaveText(expected)
    Locator: locator('#month-label')
    Expected: "octobre 2026"
    Received: "novembre 2026"
      48 |   await app.click('#btn-prev-month');
    > 49 |   await expect(libelle).toHaveText('octobre 2026');
```

Projet (largeur d'écran), fichier et ligne, ce qui était attendu, ce que la page affichait, et la ligne du test.

Pour les tests sans connexion, le **rapport HTML** est publié en cas d'échec : en bas de la page du run, *Artifacts* → `rapport-playwright` (gardé 7 jours). Une fois décompressé :

```bash
npx playwright show-report chemin/vers/rapport-playwright
```

Chaque test en échec y a sa capture d'écran et sa **trace** (onglet *Trace*) : on rejoue le test étape par étape, avec la page, la console et le réseau à chaque instant. En local, le rapport du dernier lancement s'ouvre avec `npm run rapport`.

Pour les tests connectés, il n'y a que le journal (aucune capture ni trace, voir plus haut).

**Avant de conclure à un bug de l'app** : relancer une fois (si le test repasse, il est instable, c'est un bug du test à corriger), puis rejouer le parcours à la main sur la preview Vercel de la PR.

## Écrire un nouveau test

Partir d'un test existant de `e2e/transactions.spec.js`. Les fixtures se demandent par leur nom :

```js
const {test,expect}=require('./outils');

test('ce que le chef de projet doit pouvoir faire',async({app,base})=>{
  await app.getByRole('button',{name:'− Sortie d\'argent'}).click();
  await expect(app.locator('#modal-tx-desc')).toBeFocused();   // attendre le focus automatique
  // ... agir comme l'utilisateur, puis vérifier l'écran (expect) et ce qui a été envoyé (base.ecritures)
});
```

Règles qui évitent les tests instables :

- toujours **attendre avec `expect(...)`** (il réessaie jusqu'à 5 s) plutôt que `waitForTimeout` ;
- dans une modale, **attendre le focus automatique** (posé 100 ms après l'ouverture) avant de remplir : sur la description de la modale transaction, sur `#modal-c-nom` dans la modale compte ;
- une date se calcule en **heure de Paris**, jamais avec `toISOString()` (UTC, la veille entre minuit et 1 h ou 2 h) ;
- pour un cas autour de minuit : `page.clock.setFixedTime(...)` avant `page.goto` (exemple dans `fonctions-pures.spec.js`).

Une fonction pure de `index.html` se teste de deux façons : en Node dans `front/` (rapide, extrait le bloc de fonctions entre ses marqueurs de début et de fin), ou dans la page avec `page.evaluate` (vrai navigateur, vrai fuseau ; modèle dans `fonctions-pures.spec.js`). Pour un nouveau bloc de fonctions pures dans `index.html`, prévoir un **marqueur de début et un marqueur de fin**, comme le bloc #8.

## Vérifier que la CI attrape une régression

Casser volontairement un test (par exemple attendre `'octobre 2025'` dans `changer de mois`), pousser sur la branche de la PR : le job `tests-e2e` doit passer au rouge avec le message ci-dessus. Annuler ensuite le commit.

## Réglage côté GitHub (chef de projet)

`tests-sql` est le seul check obligatoire de `main`. Pour bloquer aussi le merge sur les nouveaux jobs : *Settings → Branches → règle de `main` → Require status checks* → ajouter `tests-front` et `tests-e2e`.
