import { test, expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { verifyExport } from './issue-140-validate-staging-export.mjs';

const sha = s => createHash('sha256').update(s).digest('hex');
function fixture() {
  const schema = Buffer.from('CREATE TABLE example (id integer);');
  const catalog = {
    database_version:'17.11', foreign_servers:0,
    checkpoint:{booking_12:true,booking_13:false,training_guard:false,training_assignments:false,quote_guard:false,offer_table:false},
    functions:[],relations:[],schemas:[],triggers:[],policies:[]
  };
  const catalogText=JSON.stringify(catalog);
  const metadata={
    staging_ref:'bgtztcfbkcrvcipxbfti',checkpoint:'76ed06e / 36e7cce',
    connection_mode:'SessionPooler', endpoint_host:'aws-0-ap-northeast-1.pooler.supabase.com',
    exported_utc:'2026-11-25T13:00:00.000Z',schema_sha256:sha(schema),catalog_sha256:sha(catalogText)
  };
  return {schema,catalog,catalogText,metadata};
}
test('valid bundle only establishes export integrity, never full parity or deploy readiness',()=>{
  const result=verifyExport(fixture());
  expect(result.status).toBe('EXPORT_INTEGRITY_ONLY_NOT_CLONE_PARITY');
  expect(result.failures).toHaveLength(0);
});
test('wrong source, changed schema, and stale checkpoint fail closed',()=>{
 const f=fixture();
 f.metadata.staging_ref='another-database';
 f.catalog.checkpoint.booking_13=true;
 f.schema=Buffer.from('CREATE TABLE example (id integer, modified text);');
 const result=verifyExport(f);
 expect(result.status).toBe('BLOCKED');
 for(const key of ['staging_ref','checkpoint.booking_13','schema_sha256'])expect(result.failures.map(x=>x.name)).toContain(key);
});
test('missing manifest inventories and foreign servers block use',()=>{
 const f=fixture();
 f.catalog.functions=null;
 f.catalog.foreign_servers=1;
 const result=verifyExport(f);
 expect(result.status).toBe('BLOCKED');
 expect(result.failures.map(x=>x.name)).toContain('manifest_inventory');
 expect(result.failures.map(x=>x.name)).toContain('foreign_servers');
});
