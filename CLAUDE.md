# monbudget

Application web de gestion de budget personnel. Le propriétaire du projet est le **chef de projet** : il décide des priorités et valide les livraisons. Il pilote l'équipe d'agents via le **coach agile**.

## Stack

- Un seul fichier `index.html` (HTML + CSS + JS inline, aucun build step). Un fichier JS séparé chargé par `<script src>` est acceptable s'il est validé par une décision dans `docs/PROJET.md`.
- Supabase (projet `artvpflfhvouyngzgqob`) : Postgres + Auth + RLS. Client `@supabase/supabase-js@2` via CDN.
- Chart.js via CDN.
- Déploiement automatique sur Vercel à chaque push sur `main`.

## Sources de vérité

- `docs/PROJET.md` : état réel de l'app, schéma de base, feuille de route, décisions. **À lire avant toute tâche.**
- GitHub Issues : le backlog. Chaque ticket porte un label `agent:*`, un label de type et un label de taille.
- `docs/maquettes/` : maquettes HTML des fonctionnalités cibles (données fictives).
- `docs/RESTAURATION.md` : sauvegardes (branche `sauvegarde/v1`, schéma `backup_v1`) et procédure de retour arrière. Ne jamais modifier une sauvegarde.

## Équipe

| Agent | Fichier | Rôle |
|---|---|---|
| coach | `.claude/agents/coach.md` | Tickets, découpage, priorités, assignation, répond aux questions sur le projet. Ne code pas. |
| supabase | `.claude/agents/supabase.md` | Migrations, RLS, vues et fonctions SQL. |
| front | `.claude/agents/front.md` | Écrans et logique JS dans `index.html`. |
| qa | `.claude/agents/qa.md` | Tests, CI GitHub Actions, contrôle sécurité, validation des critères d'acceptation. |

## Circuit d'un ticket

1. Le chef de projet exprime un besoin ou un bug → le **coach** rédige le(s) ticket(s) et les assigne.
2. **supabase** et/ou **front** développent sur une branche `ticket-<n>-<slug>`.
3. **qa** vérifie les critères d'acceptation et les tests, puis commente le ticket (validé / renvoyé).
4. Le chef de projet merge. Le coach met à jour `docs/PROJET.md` si l'état de l'app a changé.

## Conventions communes

- Langue : français pour l'interface, les tickets, les commits et la doc. Noms SQL en français sans accents (`comptes`, `solde_initial`).
- Commits : `type(portée): message` (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`) + `refs #<ticket>` ou `fixes #<ticket>`.
- Pas de push direct sur `main` : branche + pull request.
- Ne jamais committer de clé `service_role` ni de secret. La clé `anon` présente dans `index.html` est publique par nature, la sécurité repose sur la RLS.
- Toute nouvelle table : colonne `user_id uuid references auth.users` + RLS activée + politiques `auth.uid() = user_id`.
- Les transactions de type `mouvement` (virements internes) sont exclues de toutes les statistiques.
