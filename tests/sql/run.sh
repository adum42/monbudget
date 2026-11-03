#!/usr/bin/env bash
# Rejoue toutes les migrations sur un Postgres jetable, puis les tests SQL.
#
# Usage :   tests/sql/run.sh                                        -> tous les fichiers de tests/sql/cas/
#           tests/sql/run.sh tests/sql/cas/front_non_regression.sql -> seulement ce(s) fichier(s)
#
# Connexion : variables libpq standard (PGHOST, PGPORT, PGUSER, PGPASSWORD).
# L'utilisateur doit être superutilisateur (en CI : postgres). AUCUN projet Supabase n'est utilisé.
# La base de travail ($BASE_TESTS, par défaut monbudget_tests) est détruite et recréée à chaque
# fichier : ne jamais pointer ce script sur une vraie base.
#
# Pour chaque fichier de tests, sur une base NEUVE (les fichiers sont indépendants) :
#   1. tests/sql/socle/00_supabase.sql   rôles anon / authenticated / service_role, auth.users, auth.uid()
#   2. supabase/bootstrap/*.sql          schéma de la prod avant les migrations versionnées
#   3. tests/sql/socle/10_donnees.sql    données fictives (utilisateurs a@test et b@test)
#   4. supabase/migrations/*.sql         TOUTES les migrations, dans l'ordre alphabétique des noms,
#                                        chacune dans une transaction (begin … commit), comme en prod
#   5. tests/sql/socle/20_harnais.sql    fonction qa.cas() et table qa.resultats
#   6. le fichier de tests
# Code de sortie : 0 si tout passe, 1 sinon (cas KO ou erreur SQL).

set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
RACINE="$(cd "$DIR/../.." && pwd)"
BASE="${BASE_TESTS:-monbudget_tests}"
export LC_ALL=C              # même ordre alphabétique partout (tri des migrations)
export PGOPTIONS="-c client_min_messages=warning"
JOURNAL="$(mktemp)"
trap 'rm -f "$JOURNAL"' EXIT

# Exécute un fichier SQL sur la base de travail ; s'arrête à la première erreur.
# Options supplémentaires (ex. -1 = tout le fichier dans une transaction) en 2e argument.
executer() {
  psql -X -q -v ON_ERROR_STOP=1 -d "$BASE" ${2:-} -f "$1" >/dev/null 2>"$JOURNAL"
}

# Requête dont on lit le résultat (une valeur, ou des lignes séparées par des tabulations)
lire() {
  psql -X -At -F $'\t' -d "$BASE" -c "$1"
}

# Signale une erreur dans le log (et comme annotation dans l'onglet de la PR en CI)
annoter() {
  if [ -n "${GITHUB_ACTIONS:-}" ]; then echo "::error title=$1::$2"; fi
}

# Prépare une base neuve et exécute le fichier de tests $1.
# En cas d'erreur SQL, affiche l'étape et le message, et renvoie 1.
preparer_et_executer() {
  local etape f
  dropdb --if-exists "$BASE" && createdb "$BASE" || { echo "KO  impossible de créer la base $BASE"; return 1; }

  etape="tests/sql/socle/00_supabase.sql"; executer "$DIR/socle/00_supabase.sql" || { erreur "$etape"; return 1; }
  for f in "$RACINE"/supabase/bootstrap/*.sql; do
    etape="${f#"$RACINE"/}"; executer "$f" || { erreur "$etape"; return 1; }
  done
  etape="tests/sql/socle/10_donnees.sql"; executer "$DIR/socle/10_donnees.sql" || { erreur "$etape"; return 1; }
  for f in "${MIGRATIONS[@]}"; do
    etape="${f#"$RACINE"/}"; executer "$f" -1 || { erreur "$etape"; return 1; }
  done
  etape="tests/sql/socle/20_harnais.sql"; executer "$DIR/socle/20_harnais.sql" || { erreur "$etape"; return 1; }
  etape="${1#"$RACINE"/}"; executer "$1" || { erreur "$etape"; return 1; }
}

erreur() {
  echo "KO  erreur SQL dans $1 :"
  sed 's/^/      /' "$JOURNAL"
  annoter "tests-sql : erreur SQL" "$1 : $(head -1 "$JOURNAL")"
}

# Fichiers de tests à lancer
if [ $# -gt 0 ]; then
  FICHIERS=()
  for f in "$@"; do
    # chemin depuis le dossier courant, ou depuis tests/sql/ (ex. cas/front_non_regression.sql)
    [ -f "$f" ] || f="$DIR/$f"
    [ -f "$f" ] || { echo "Fichier de tests introuvable : $f"; exit 1; }
    FICHIERS+=("$(cd "$(dirname "$f")" && pwd)/$(basename "$f")")
  done
else
  FICHIERS=("$DIR"/cas/*.sql)
fi

MIGRATIONS=("$RACINE"/supabase/migrations/*.sql)
echo "Migrations rejouées, dans cet ordre :"
for m in "${MIGRATIONS[@]}"; do echo "  - ${m#"$RACINE"/}"; done

total=0; echecs=0; fichiers_ko=0

for cas in "${FICHIERS[@]}"; do
  nom="${cas#"$RACINE"/}"
  echo
  echo "════ $nom"

  if ! preparer_et_executer "$cas"; then
    fichiers_ko=$((fichiers_ko + 1))
    continue
  fi

  # Une ligne par cas
  lire "select case when ok then 'OK ' else 'KO ' end, n, cas from qa.resultats order by n" |
    while IFS=$'\t' read -r etat n libelle; do printf '%s %3s  %s\n' "$etat" "$n" "$libelle"; done

  n_total=$(lire "select count(*) from qa.resultats")
  n_ko=$(lire "select count(*) from qa.resultats where not ok")
  total=$((total + n_total)); echecs=$((echecs + n_ko))

  # Détail des échecs : code attendu, code obtenu et message de Postgres
  if [ "$n_ko" -gt 0 ]; then
    fichiers_ko=$((fichiers_ko + 1))
    echo "── Échecs ($n_ko) :"
    lire "select n, cas, attendu, obtenu, coalesce(message,'') from qa.resultats where not ok order by n" |
      while IFS=$'\t' read -r n libelle attendu obtenu message; do
        echo "  #$n $libelle"
        echo "      attendu : $attendu   obtenu : $obtenu   ($message)"
        annoter "tests-sql : $nom #$n" "$libelle : attendu $attendu, obtenu $obtenu ($message)"
      done
  fi
  echo "── $((n_total - n_ko))/$n_total cas OK"
done

dropdb --if-exists "$BASE" 2>/dev/null

echo
echo "════ Bilan : $((total - echecs))/$total cas OK, ${#FICHIERS[@]} fichier(s) dont $fichiers_ko en échec"
[ "$fichiers_ko" -eq 0 ]
