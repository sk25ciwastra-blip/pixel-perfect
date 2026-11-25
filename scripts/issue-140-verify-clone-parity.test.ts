import {test,expect} from 'bun:test';
import {compareCatalogs} from './issue-140-verify-clone-parity.mjs';

function fixture() {
  const record={database_version:'17.11',checkpoint:{booking_12:true,booking_13:false,training_guard:false},
    foreign_servers:0,postgrest_catalog_settings:[],schemas:[],roles:[],memberships:[],extensions:[],
    relations:[],columns:[],constraints:[],views:[],default_acl:[],policies:[],indexes:[],triggers:[],functions:[]};
  return [structuredClone(record),structuredClone(record)];
}
test('identical manifests prove catalog parity only, not readiness',()=>{
  const [a,b]=fixture();expect(compareCatalogs(a,b).status).toBe('CATALOG_PARITY_ONLY_NOT_RELEASE_APPROVAL');
});
test('missing manifest and drift of privileged function hash fail closed',()=>{
  const [a,b]=fixture();a.functions=[{name:'create_reservation',sha256:'a',acl:'authenticated'}];
  b.functions=[{name:'create_reservation',sha256:'b',acl:'authenticated'}];
  b.roles=null;
  const result=compareCatalogs(a,b);
  expect(result.status).toBe('BLOCKED');
  expect(result.failures).toContain('functions_drift');
  expect(result.failures).toContain('roles_missing');
});
test('owner, ACL, RLS, trigger or PostgREST drift block clone',()=>{
  const [a,b]=fixture();
  a.relations=[{name:'guests',owner:'postgres',rls:true,acl:'read-only'}];
  b.relations=[{name:'guests',owner:'postgres',rls:false,acl:'read-only'}];
  b.postgrest_catalog_settings=['pgrst.db_schemas=other'];
  const result=compareCatalogs(a,b);
  expect(result.failures).toContain('relations_drift');
  expect(result.failures).toContain('postgrest_settings_drift');
});
test('foreign server and major PG mismatch block rehearsal',()=>{
  const [a,b]=fixture();b.foreign_servers=1;b.database_version='16.9';
  expect(compareCatalogs(a,b).status).toBe('BLOCKED');
});
