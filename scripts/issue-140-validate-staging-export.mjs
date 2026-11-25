#!/usr/bin/env node
/**
 * Issue #140 export readiness gate. Offline only: no network, database, restore or DDL.
 * Usage: node scripts/issue-140-validate-staging-export.mjs <private-export-directory>
 * Do not commit an exported schema or catalog, or send them to chat.
 */
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';

const EXPECTED_REF = 'bgtztcfbkcrvcipxbfti';
const EXPECTED_CHECKPOINT = '76ed06e / 36e7cce';
const HEX = /^[0-9a-f]{64}$/i;

export function verifyExport({ metadata, catalog, schema, catalogText }) {
  const failures = [];
  const fail = (name, detail) => failures.push({ name, detail });
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return { status: 'BLOCKED', failures: [{ name: 'metadata', detail: 'Missing or malformed export metadata' }] };
  }
  if (metadata.staging_ref !== EXPECTED_REF) fail('staging_ref', 'Export is not from the approved staging ref');
  if (metadata.checkpoint !== EXPECTED_CHECKPOINT) fail('checkpoint', 'Export checkpoint differs from reviewed baseline');
  if (!['Direct', 'SessionPooler'].includes(metadata.connection_mode)) fail('connection_mode', 'Unknown endpoint route');
  if (metadata.endpoint_host !== (metadata.connection_mode === 'Direct' ?
    'db.bgtztcfbkcrvcipxbfti.supabase.co' : 'aws-0-ap-northeast-1.pooler.supabase.com')) {
    fail('endpoint_host', 'Export endpoint is not the approved source');
  }
  if (!Number.isFinite(Date.parse(metadata.exported_utc ?? ''))) fail('exported_utc', 'Missing timestamp');
  if (!HEX.test(metadata.schema_sha256 ?? '') || !HEX.test(metadata.catalog_sha256 ?? '')) fail('sha256_format', 'Invalid checksum');
  const hash = data => createHash('sha256').update(data).digest('hex');
  if (metadata.schema_sha256?.toLowerCase() !== hash(schema).toLowerCase()) fail('schema_sha256', 'Schema digest mismatch');
  if (metadata.catalog_sha256?.toLowerCase() !== hash(catalogText).toLowerCase()) fail('catalog_sha256', 'Catalog digest mismatch');
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
    fail('catalog', 'Manifest is invalid');
  } else {
    if (!/^17\./.test(String(catalog.database_version ?? ''))) fail('postgres', 'Not PostgreSQL 17');
    const checkpoint = catalog.checkpoint ?? {};
    for (const [key,expected] of Object.entries({
      booking_12: true, booking_13: false, training_guard: false,
      training_assignments: false, quote_guard: false, offer_table: false
    })) {
      if (checkpoint[key] !== expected) fail('checkpoint.'+key, 'Catalog state mismatch');
    }
    if (catalog.foreign_servers !== 0) fail('foreign_servers', 'Foreign server definitions require separate security review');
    if (!Array.isArray(catalog.functions) || !Array.isArray(catalog.relations) ||
        !Array.isArray(catalog.schemas) || !Array.isArray(catalog.triggers) ||
        !Array.isArray(catalog.policies)) fail('manifest_inventory', 'Catalog must include functions, relations, schemas, triggers and policies');
  }
  if (schema.length === 0 || !schema.toString('utf8').includes('CREATE')) fail('schema', 'Missing expected schema-only DDL');
  // A valid digest is not a sensitive-data scan; SQL can embed secrets in function bodies.
  return { status: failures.length ? 'BLOCKED' : 'EXPORT_INTEGRITY_ONLY_NOT_CLONE_PARITY', failures };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1) throw new Error('Usage: node scripts/issue-140-validate-staging-export.mjs <private-export-directory>');
  const directory = resolve(args[0]);
  const names = ['staging-schema.sql', 'staging-catalog.json', 'staging-export.json'];
  const paths = names.map(name => join(directory, name));
  const fileStats = await Promise.all(paths.map(path => stat(path)));
  if (fileStats.some(x => !x.isFile())) throw new Error('Expected regular files in private directory');
  const [schema, catalogTextBuffer, metadataText] = await Promise.all(paths.map(path => readFile(path)));
  const catalogText = catalogTextBuffer.toString('utf8');
  const report = verifyExport({ schema, catalogText, catalog: JSON.parse(catalogText), metadata: JSON.parse(metadataText.toString('utf8')) });
  // Intentionally print only control results, never schema text, names, emails, phone numbers, or function bodies.
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (report.status === 'BLOCKED') process.exitCode = 2;
}

if (process.argv[1] && /issue-140-validate-staging-export\.mjs$/.test(process.argv[1])) {
  main().catch(error => { process.stderr.write('BLOCKED: export package unavailable or malformed ('+error.code ?? 'error'+')\n'); process.exitCode=2; });
}
