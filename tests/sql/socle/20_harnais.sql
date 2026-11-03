-- Harnais de test : qa.cas(...) exécute UNE requête comme le ferait l'API Supabase
-- (PostgREST), avec le rôle et l'utilisateur voulus, puis compare le résultat obtenu
-- au résultat attendu et l'enregistre dans qa.resultats.
--
--   select qa.cas(
--     'description lisible du cas',
--     'authenticated',                 -- rôle : 'anon', 'authenticated', 'service_role' ou 'postgres' (administrateur)
--     'aaaaaaaa-…-001',                -- utilisateur connecté (auth.uid()), null si aucun
--     $q$ insert into … $q$,           -- la requête à tester, entre $q$ … $q$
--     '23514'                          -- attendu : 'ok' (par défaut) ou un code d'erreur Postgres (SQLSTATE)
--   );
--
-- Codes d'erreur les plus utiles :
--   23514 contrainte check violée      23503 clé étrangère / compte d'un autre utilisateur
--   23505 doublon (index unique)        42501 refusé par la RLS ou les droits
--   22003 nombre trop grand             0A000 opération non supportée
--
-- Chaque cas s'exécute dans une sous-transaction : s'il échoue, ses effets sont annulés
-- et le rôle redevient celui de la session. S'il réussit, ses effets RESTENT : les cas
-- suivants du même fichier voient les lignes créées ou supprimées (l'ordre compte).

create schema qa;

create table qa.resultats (
  n       serial,
  cas     text,
  attendu text,
  obtenu  text,
  message text,
  ok      boolean generated always as (attendu = obtenu) stored
);

create function qa.cas(p_cas text, p_role text, p_uid uuid, p_sql text, p_attendu text default 'ok')
returns void language plpgsql as $$
declare
  v_obtenu text := 'ok';
  v_msg    text;
  v_lignes bigint;
begin
  begin
    -- Claims du jeton JWT puis rôle, locaux à la transaction, comme PostgREST.
    perform set_config('request.jwt.claims',
      case when p_uid is null then json_build_object('role', p_role)::text
           else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
    if p_role <> 'postgres' then
      perform set_config('role', p_role, true);
    end if;
    execute p_sql;
    get diagnostics v_lignes = row_count;
    v_msg := v_lignes || ' ligne(s)';
  exception when others then
    v_obtenu := sqlstate;
    v_msg    := sqlerrm;
  end;
  -- Retour au rôle de la session (administrateur) avant d'écrire le résultat.
  perform set_config('role', 'none', true);
  insert into qa.resultats (cas, attendu, obtenu, message)
  values (p_cas, p_attendu, v_obtenu, v_msg);
end $$;
