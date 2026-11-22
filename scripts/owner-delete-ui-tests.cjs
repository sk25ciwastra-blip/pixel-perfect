// Run the actual component and server function with in-process UI/auth stubs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { z } = require('zod');

function load(file, dependencies) {
  const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require(name) {
      assert.ok(Object.hasOwn(dependencies, name), name);
      return dependencies[name];
    },
  });
  return exports;
}

async function main() {
  const middleware = Symbol('requireSupabaseAuth');
  const { hapusDataDemo } = load('src/lib/owner-delete.functions.ts', {
    zod: { z },
    '@/integrations/supabase/auth-middleware': { requireSupabaseAuth: middleware },
    '@tanstack/react-start': {
      createServerFn({ method }) {
        assert.equal(method, 'POST');
        return {
          middleware(list) {
            assert.equal(list[0], middleware);
            return {
              validator(schema) {
                return { handler: fn => (data, context) => fn({ data: schema.parse(data), context }) };
              },
            };
          },
        };
      },
    },
  });
  const id = '00000000-0000-4000-8000-000000000020';
  const data = { kind: 'transaction', id, confirmation: 'BTRDTRX-20', demoConfirmed: true };
  const calls = [];
  const context = owner => ({
    userId: 'fixture',
    supabase: { rpc: async (name, args) => {
      calls.push([name, args]);
      return { data: name === 'has_role' ? owner : 'done' };
    } },
  });
  assert.equal(await hapusDataDemo(data, context(false)), 'denied');
  assert.deepEqual(calls.map(([name]) => name), ['has_role']);
  assert.throws(() => hapusDataDemo({ ...data, role: 'owner' }, context(true)));
  assert.throws(() => hapusDataDemo({ ...data, demoConfirmed: false }, context(true)));
  assert.equal(await hapusDataDemo(data, context(true)), 'done');
  assert.deepEqual(calls.map(([name]) => name), ['has_role', 'has_role', 'owner_delete_demo']);
  assert.equal(calls.at(-1)[1]._id, id);
  console.log('PASS server POST wiring, required auth middleware, authoritative role check and payload validation');

  let actor, cursor, state, requested, refreshed, response;
  const element = (type, props) => ({ type, props });
  const { TombolHapusDemo } = load('src/components/hapus-data-demo.tsx', {
    react: { useState(initial) {
      const index = cursor++;
      state[index] ??= initial;
      return [state[index], next => { state[index] = next; }];
    } },
    'react/jsx-runtime': { jsx: element, jsxs: element },
    '@tanstack/react-start': { useServerFn: () => async ({ data: submitted }) => { requested.push(submitted); return response; } },
    'lucide-react': { Trash2: 'Trash2' },
    '@/components/ui/button': { Button: 'Button' },
    '@/components/ui/dialog': Object.fromEntries(['Dialog', 'DialogContent', 'DialogDescription', 'DialogTitle', 'DialogTrigger'].map(name => [name, name])),
    '@/lib/peran': { usePeran: () => ({ posisiKode: actor }) },
    '@/lib/owner-delete.functions': { hapusDataDemo },
  });
  const search = (element, predicate) => {
    if (!element || typeof element !== 'object') return undefined;
    if (predicate(element)) return element;
    return [element.props.children].flat().map(child => search(child, predicate)).find(Boolean);
  };
  for (const kind of ['employee', 'transaction']) {
    state = [];
    requested = [];
    refreshed = 0;
    const code = kind === 'employee' ? 'B25EMP-020' : data.confirmation;
    const render = () => {
      cursor = 0;
      return TombolHapusDemo({ kind, id, code, name: 'Fixture', onDeleted: () => { refreshed++; } });
    };
    for (actor of [null, 'receptionist', 'supervisor', 'housekeeping', 'trainee', 'inspector', 'investor']) {
      assert.equal(render(), null);
    }
    actor = 'owner';
    assert.ok(search(render(), el => el.props['aria-label'] === `Hapus ${code}`));
    render().props.onOpenChange(true);
    assert.equal(render().props.open, true);
    const cancel = search(render(), el => el.type === 'Button' && el.props.children === 'Batal');
    cancel.props.onClick();
    assert.equal(render().props.open, false);
    assert.equal(requested.length, 0);
    render().props.onOpenChange(true);
    const setCode = value => search(render(), el => el.type === 'input' && el.props.type !== 'checkbox').props.onChange({ target: { value } });
    search(render(), el => el.type === 'input' && el.props.type === 'checkbox').props.onChange({ target: { checked: true } });
    setCode(code + ' ');
    const submit = () => search(render(), el => el.type === 'form').props.onSubmit({ preventDefault() {} });
    await submit();
    assert.equal(requested.length, 0);
    setCode(code);
    response = 'transaction_reference';
    await submit();
    assert.equal(render().props.open, true);
    assert.ok(search(render(), el => el.props.role === 'alert'));
    response = 'done';
    await submit();
    assert.equal(render().props.open, false);
    assert.equal(refreshed, 1);
    assert.equal(requested[0].confirmation, code);
  }
  console.log('PASS component: Owner-only visibility, cancel, exact confirmation, error persistence, refresh callback');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
