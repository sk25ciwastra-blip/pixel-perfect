const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');

// Run the actual hook query with the installed SDK and an isolated HTTP transport.
// No Cloud requests, credentials, React renderer or operational writes are needed.
const requests = [];
let responseError = false;
const supabase = createClient('https://example.invalid', 'isolated-test-key', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: {
    fetch: async (url) => {
      requests.push(new URL(url));
      return new Response(JSON.stringify(responseError
        ? { message: 'permission denied', code: '42501' }
        : [{ id: 'test-row' }]), {
        status: responseError ? 403 : 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  },
});
let state = [];
const react = {
  useCallback: (callback) => callback,
  useEffect: () => {},
  useId: () => 'isolated-test',
  useState: (initial) => {
    const index = state.length;
    state.push(initial);
    return [initial, (value) => { state[index] = value; }];
  },
};
const source = fs.readFileSync('src/lib/data-live.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exportsObject = {};
vm.runInNewContext(compiled, {
  exports: exportsObject,
  require: (name) => {
    if (name === 'react') return react;
    if (name === '@/integrations/supabase/client') return { supabase };
    throw new Error(`Unexpected import: ${name}`);
  },
});

async function refresh(table, enabled = true, scope) {
  state = [];
  await exportsObject.useTable(table, enabled, scope).refresh();
}

(async () => {
  await refresh('finance_settings');
  assert.equal(requests.at(-1).pathname, '/rest/v1/finance_settings');
  assert.equal(requests.at(-1).searchParams.get('select'), '*');
  assert.equal(requests.at(-1).searchParams.has('order'), false);
  assert.equal(state[0][0].id, 'test-row');
  assert.equal(state[1], '');
  assert.equal(state[2], false);

  await refresh('rooms', true, { column: 'id', value: 'room-03' });
  assert.equal(requests.at(-1).pathname, '/rest/v1/rooms');
  assert.equal(requests.at(-1).searchParams.get('order'), 'created_at.asc');
  assert.equal(requests.at(-1).searchParams.get('id'), 'eq.room-03');

  const count = requests.length;
  await refresh('finance_settings', false);
  assert.equal(requests.length, count);
  assert.equal(state[0].length, 0);
  assert.equal(state[2], false);

  responseError = true;
  await refresh('finance_settings');
  assert.equal(state[1], 'permission denied');
  assert.equal(state[0].length, 0);
  assert.equal(state[2], false);
  console.log('PASS: finance_settings unordered; rooms created_at.asc; scope, disabled and errors preserved.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
