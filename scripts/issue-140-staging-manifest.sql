-- Catalog only. No guest, payment or auth user rows are read.
with scope as (
  select oid, nspname, nspowner, nspacl from pg_namespace
  where nspname not in ('pg_catalog','information_schema') and nspname !~ '^pg_'
), relations as (
  select c.*, s.nspname from pg_class c join scope s on s.oid=c.relnamespace
  where c.relkind in ('r','p','v','m','S','f')
), functions as (
  select p.*, s.nspname from pg_proc p join scope s on s.oid=p.pronamespace
  where p.prokind in ('f','p','w')
)
select jsonb_build_object(
  'database_version', current_setting('server_version'),
  'foreign_servers', (select count(*) from pg_foreign_server),
  'schemas', (select jsonb_agg(jsonb_build_object('name',nspname,'owner',pg_get_userbyid(nspowner),
    'acl',nspacl::text) order by nspname) from scope),
  'roles', (select jsonb_agg(jsonb_build_object('name',rolname,'inherit',rolinherit,'superuser',rolsuper,
    'bypass_rls',rolbypassrls,'can_login',rolcanlogin,'create_role',rolcreaterole,'create_db',rolcreatedb,
    'replication',rolreplication) order by rolname) from pg_roles),
  'memberships', (select jsonb_agg(jsonb_build_object('role',r.rolname,'member',m.rolname,'grantor',g.rolname,
    'admin',a.admin_option,'inherit',a.inherit_option,'set',a.set_option)
    order by r.rolname,m.rolname,g.rolname) from pg_auth_members a
    join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member join pg_roles g on g.oid=a.grantor),
  'extensions', (select jsonb_agg(jsonb_build_object('name',e.extname,'version',e.extversion,
    'schema',n.nspname,'owner',pg_get_userbyid(e.extowner)) order by e.extname)
    from pg_extension e join pg_namespace n on n.oid=e.extnamespace),
  'postgrest_catalog_settings', (select jsonb_agg(jsonb_build_object('database',d.datname,'role',r.rolname,'setting',v)
    order by d.datname,r.rolname,v) from pg_db_role_setting s left join pg_roles r on r.oid=s.setrole
    left join pg_database d on d.oid=s.setdatabase cross join lateral unnest(s.setconfig) v
    where v like 'pgrst.db_schemas=%' and (s.setdatabase=0 or d.datname=current_database())),
  'relations', (select jsonb_agg(jsonb_build_object('schema',nspname,'name',relname,'kind',relkind,
    'owner',pg_get_userbyid(relowner),'acl',relacl::text,'rls',relrowsecurity,'force_rls',relforcerowsecurity)
    order by nspname,relname) from relations),
  'column_acl', (select jsonb_agg(jsonb_build_object('schema',r.nspname,'relation',r.relname,
    'column',a.attname,'acl',a.attacl::text) order by r.nspname,r.relname,a.attnum)
    from relations r join pg_attribute a on a.attrelid=r.oid where a.attacl is not null and not a.attisdropped),
  'columns', (select jsonb_agg(jsonb_build_object('schema',r.nspname,'relation',r.relname,
    'column',a.attname,'type',format_type(a.atttypid,a.atttypmod),'required',a.attnotnull,
    'identity',a.attidentity,'generated',a.attgenerated,'default',pg_get_expr(ad.adbin,ad.adrelid))
    order by r.nspname,r.relname,a.attnum) from relations r join pg_attribute a on a.attrelid=r.oid
    left join pg_attrdef ad on ad.adrelid=r.oid and ad.adnum=a.attnum where a.attnum>0 and not a.attisdropped),
  'constraints', (select jsonb_agg(jsonb_build_object('schema',r.nspname,'relation',r.relname,
    'name',c.conname,'valid',c.convalidated,'definition',pg_get_constraintdef(c.oid,false))
    order by r.nspname,r.relname,c.conname) from relations r join pg_constraint c on c.conrelid=r.oid),
  'views', (select jsonb_agg(jsonb_build_object('schema',nspname,'name',relname,
    'definition',pg_get_viewdef(oid,false),'options',reloptions) order by nspname,relname)
    from relations where relkind in ('v','m')),
  'default_acl', (select jsonb_agg(jsonb_build_object('role',pg_get_userbyid(d.defaclrole),
    'schema',s.nspname,'type',d.defaclobjtype,'acl',d.defaclacl::text)
    order by pg_get_userbyid(d.defaclrole),s.nspname,d.defaclobjtype)
    from pg_default_acl d left join scope s on s.oid=d.defaclnamespace
    where d.defaclnamespace=0 or s.oid is not null),
  'policies', (select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname)
    from pg_policies p join scope s on s.nspname=p.schemaname),
  'indexes', (select jsonb_agg(to_jsonb(i) order by schemaname,tablename,indexname)
    from pg_indexes i join scope s on s.nspname=i.schemaname),
  'triggers', (select jsonb_agg(jsonb_build_object('schema',r.nspname,'relation',r.relname,'name',t.tgname,
    'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid,false)) order by r.nspname,r.relname,t.tgname)
    from pg_trigger t join relations r on r.oid=t.tgrelid where not t.tgisinternal),
  'functions', (select jsonb_agg(jsonb_build_object('schema',nspname,'name',proname,
    'arguments',pg_get_function_identity_arguments(oid),'owner',pg_get_userbyid(proowner),'acl',proacl::text,
    'security_definer',prosecdef,'sha256',encode(sha256(convert_to(pg_get_functiondef(oid),'UTF8')),'hex'))
    order by nspname,proname,pg_get_function_identity_arguments(oid)) from functions),
  'checkpoint', jsonb_build_object(
    'booking_12',to_regprocedure('public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid)') is not null,
    'booking_13',to_regprocedure('public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid,integer)') is not null,
    'training_guard',to_regprocedure('public.finance_training_is_restricted(uuid)') is not null,
    'training_assignments',to_regclass('public.finance_training_assignments') is not null,
    'quote_guard',to_regprocedure('booking_quote_private.require_operator()') is not null,
    'offer_table',to_regclass('public.reservation_offers') is not null
  )
);
