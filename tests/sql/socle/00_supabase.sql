-- Socle Supabase minimal pour un Postgres jetable (CI ou local).
-- Supabase fournit d'office des rôles, un schéma `auth` et des droits par défaut :
-- on reproduit ici le strict nécessaire pour que les migrations et la RLS se comportent
-- comme sur les vrais projets. Aucun lien avec un projet Supabase réel.

-- Rôles utilisés par l'API Supabase (PostgREST).
-- Les rôles sont globaux au serveur : on ne les crée que s'ils n'existent pas encore,
-- car run.sh recrée une base neuve pour chaque fichier de tests sur le même serveur.
do $r$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $r$;

-- Schéma auth simulé : une table d'utilisateurs réduite et auth.uid().
-- auth.uid() est une copie exacte de la définition Supabase : il lit l'identifiant
-- de l'utilisateur (« sub ») dans les claims du jeton JWT de la requête.
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $f$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$f$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Droits par défaut de Supabase : tout objet créé dans public est accessible aux trois rôles,
-- la sécurité reposant sur la RLS. Sans cela, une requête refusée le serait pour un manque
-- de droit (GRANT) et non par la RLS : les tests ne mesureraient pas la bonne chose.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
