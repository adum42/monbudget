# monbudget

Application web de gestion de budget personnel. Le propriétaire du projet est le **chef de projet** : il décide des priorités et valide les livraisons. Il pilote l'équipe d'agents via **Corentin**, le coach agile.

## Stack

- Un seul fichier `index.html` (HTML + CSS + JS inline, aucun build step). Un fichier JS séparé chargé par `<script src>` est acceptable s'il est validé par une décision dans `docs/PROJET.md`.
- Supabase : Postgres + Auth + RLS. Client `@supabase/supabase-js@2` via CDN. Deux projets, voir *Environnements*.
- Chart.js via CDN.
- Déploiement automatique sur Vercel à chaque push sur `main` ; une preview Vercel par branche / PR.

## Environnements

| Rôle | Projet Supabase | `project_id` | Utilisé par | Données |
|---|---|---|---|---|
| **PROD** | « budget-app » | `artvpflfhvouyngzgqob` | `https://monbudget-lilac.vercel.app` uniquement | réelles (chef de projet) |
| **TEST** | « monbudget-test » | `ebupazakzfbpptmlrzze` | previews Vercel, `localhost`, tout autre domaine | fictives uniquement |

- **Aiguillage** (#20) : `index.html` choisit la base selon le domaine. Seul un domaine de la liste blanche `DOMAINES_PROD` va sur la prod, tout le reste va sur test et affiche le bandeau « Environnement de TEST ».
- **Désignation** : les deux noms ne se ressemblent pas. Dans un ticket, un commentaire ou un appel d'outil, toujours désigner un projet par son **rôle et son identifiant** (« TEST `ebupazakzfbpptmlrzze` »), et passer le `project_id` explicitement à chaque appel MCP Supabase.
- **Qui touche la prod** : seul le chef de projet écrit sur la prod (application des migrations, merge). Les agents n'y font que des lectures, plus l'inscription d'une migration dans l'historique par Sylvie.
- Détail des projets, de l'Auth et de la procédure de migration : `supabase/README.md`.

## Sources de vérité

- `docs/PROJET.md` : état réel de l'app, schéma de base, feuille de route, décisions. **À lire avant toute tâche.**
- GitHub Issues : le backlog. Chaque ticket porte un label `agent:*`, un label de type et un label de taille.
- `docs/maquettes/` : maquettes HTML des fonctionnalités cibles (données fictives).
- `docs/RESTAURATION.md` : sauvegardes (branche `sauvegarde/v1`, schéma `backup_v1`) et procédure de retour arrière. Ne jamais modifier une sauvegarde.

## Équipe

Chaque agent a un prénom : c'est ce nom qu'on utilise pour l'appeler (« Corentin, découpe ce besoin »). Les labels `agent:*` et les préfixes de titre des tickets restent par rôle.

| Prénom | Rôle | Label / préfixe | Fichier | Missions |
|---|---|---|---|---|
| **Corentin** | Coach agile | `agent:coach` | `.claude/agents/corentin.md` | Tickets, découpage, priorités, assignation, répond aux questions sur le projet. Ne code pas. |
| **Sylvie** | Base de données | `agent:supabase` / `[supabase]` | `.claude/agents/sylvie.md` | Migrations, RLS, vues et fonctions SQL. |
| **Fabien** | Front | `agent:front` / `[front]` | `.claude/agents/fabien.md` | Écrans et logique JS dans `index.html`. |
| **Quentin** | QA | `agent:qa` / `[qa]` | `.claude/agents/quentin.md` | Tests, CI GitHub Actions, contrôle sécurité, validation des critères d'acceptation. |

## Circuit d'un ticket

1. Le chef de projet exprime un besoin ou un bug → **Corentin** rédige le(s) ticket(s) et les assigne.
2. **Sylvie** et/ou **Fabien** développent sur une branche `ticket-<n>-<slug>`. Une migration s'écrit dans `supabase/migrations/<AAAAMMJJHHMM>_<nom>.sql` et se teste d'abord sur un Postgres local jetable.
3. **Quentin** relit le diff et recette **en local** (migration rejouée sur Postgres jetable, app servie en local sur TEST).
4. **TEST** : le chef de projet applique la migration sur TEST `ebupazakzfbpptmlrzze` (éditeur SQL du dashboard, `begin; … commit;`) ; Sylvie l'inscrit dans l'historique et vérifie ; Quentin recette sur TEST et sur la preview Vercel, puis commente le ticket (**Validé** / **Renvoyé à …**).
5. **Feu vert** du chef de projet → il applique la **même** migration sur PROD `artvpflfhvouyngzgqob` ; Sylvie l'inscrit avec la même version et vérifie ; Quentin fait le contrôle en lecture après application.
6. PR, puis **merge** par le chef de projet. Une migration est en prod **avant** le merge du front qui en dépend. Corentin met à jour `docs/PROJET.md` si l'état de l'app a changé.

Un ticket sans migration saute les étapes 4 et 5 (recette sur la preview, donc sur TEST). Les agents n'utilisent pas l'outil `apply_migration` (annulé automatiquement par le client) : procédure détaillée dans `supabase/README.md`.

## Conventions communes

- Langue : français pour l'interface, les tickets, les commits et la doc. Noms SQL en français sans accents (`comptes`, `solde_initial`).
- Ne jamais committer de clé `service_role` ni de secret. Les clés `anon` présentes dans `index.html` sont publiques par nature, la sécurité repose sur la RLS.
- Données fictives uniquement sur TEST ; aucune donnée ne circule de la prod vers test. Aucun agent ne saisit ni ne lit de mot de passe (l'utilisateur de test est dans les secrets GitHub `TEST_EMAIL` / `TEST_PASSWORD`).
- Toute nouvelle table : colonne `user_id uuid references auth.users` + RLS activée + politiques `auth.uid() = user_id`.
- Les transactions de type `mouvement` (virements internes) sont exclues de toutes les statistiques.

## Conventions git

- **Branches** : partir de `main` à jour. `ticket-<n>-<slug>` pour un ticket, `docs-<slug>` pour de la documentation seule. Ne jamais travailler sur `main` ni sur `sauvegarde/*`.
- **Une branche = un ticket = une PR.** Titre de la PR = titre du ticket. Corps : ce qui a changé, ce que le chef de projet doit tester sur la preview Vercel, et `Closes #<n>`.
- **Commits** : `type(portée): message` (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`) + `refs #<n>`. Petits et cohérents. Relire `git status` et `git diff --staged` avant chaque commit, pas de `git add -A` à l'aveugle.
- **Avant de pousser** : `git fetch origin main`, puis rebase de la branche si `main` a bougé.
- **Interdit sans accord explicite du chef de projet** : push sur `main`, `push --force` (seul `--force-with-lease` sur sa propre branche de ticket est toléré), `git reset --hard`, réécriture d'historique, suppression de branche.
- **Merge** : uniquement par le chef de projet, en *squash*. GitHub supprime ensuite la branche automatiquement (option *Automatically delete head branches*).
- En session cloud, la suppression de branches distantes est bloquée : ne pas chercher de contournement, la signaler au chef de projet.
