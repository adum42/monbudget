-- Empreinte des catalogues du schéma public (lecture seule).
-- À lancer sur TEST et sur PROD (execute_sql avec le project_id explicite, ou éditeur SQL) :
-- la ligne TOTAL_public doit être identique sur les deux bases.
-- Une ligne par famille d'objets : en cas d'écart, comparer famille par famille pour le localiser.
-- Ne lit aucune donnée des tables, seulement les catalogues.
with f as (
 select 'colonnes' fam, table_name||'.'||column_name||'|'||ordinal_position||'|'||data_type||'|'||coalesce(numeric_precision::text,'')||','||coalesce(numeric_scale::text,'')||'|'||is_nullable||'|'||coalesce(column_default,'') l
  from information_schema.columns where table_schema='public'
 union all select 'contraintes', conrelid::regclass||'|'||conname||'|'||pg_get_constraintdef(oid) from pg_constraint where connamespace='public'::regnamespace
 union all select 'index', indexdef from pg_indexes where schemaname='public'
 union all select 'politiques', tablename||'|'||policyname||'|'||permissive||'|'||roles::text||'|'||cmd||'|'||coalesce(qual,'')||'|'||coalesce(with_check,'') from pg_policies where schemaname='public'
 union all select 'rls', relname||'|'||relrowsecurity||'|'||relforcerowsecurity from pg_class where relnamespace='public'::regnamespace and relkind in ('r','v','m','p')
 union all select 'droits_tables', table_name||'|'||grantee||'|'||privilege_type from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','service_role','postgres','PUBLIC')
 union all select 'triggers', tgrelid::regclass||'|'||tgname||'|'||pg_get_triggerdef(oid)||'|'||tgenabled::text from pg_trigger where not tgisinternal and tgrelid in (select oid from pg_class where relnamespace='public'::regnamespace)
 union all select 'fonctions', p.oid::regprocedure||'|'||md5(pg_get_functiondef(p.oid))||'|'||coalesce(array_to_string(p.proacl,','),'') from pg_proc p where pronamespace='public'::regnamespace
 union all select 'commentaires', c.relname||'.'||coalesce(a.attname,'')||'|'||d.description from pg_description d join pg_class c on c.oid=d.objoid and d.classoid='pg_class'::regclass left join pg_attribute a on a.attrelid=c.oid and a.attnum=d.objsubid and d.objsubid>0 where c.relnamespace='public'::regnamespace
 union all select 'sequences_vues', relname||'|'||relkind::text from pg_class where relnamespace='public'::regnamespace and relkind in ('S','v','m')
 union all select 'def_vues', c.relname||'|'||md5(pg_get_viewdef(c.oid))||'|'||coalesce(array_to_string(c.reloptions,','),'') from pg_class c where c.relnamespace='public'::regnamespace and c.relkind in ('v','m')
 union all select 'extensions', extname||'|'||extversion from pg_extension
 union all select 'schemas', nspname from pg_namespace where nspname not like 'pg_%' and nspname<>'information_schema'
)
select fam, count(*) n, md5(string_agg(l, E'\n' order by l)) h from f group by fam
union all select 'TOTAL_public', count(*), md5(string_agg(fam||l, E'\n' order by fam, l)) from f where fam not in ('extensions','schemas')
order by 1;
