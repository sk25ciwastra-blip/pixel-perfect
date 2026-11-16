import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');
const baseline = read('fixtures/housekeeping-preview-3218bd2.tsx.txt').replace(/\r\n/g, '\n');
// Apply the real review patch only to a fresh synthetic source tree outside the repo.
const work = mkdtempSync(join(tmpdir(), 'b25-hk-navigation-'));
const target = join(work, 'src', 'routes', 'housekeeping.tsx');
let fixed: string;
try {
  mkdirSync(join(work, 'src', 'routes'), { recursive: true });
  writeFileSync(target, baseline);
  const patch = read('../patches/housekeeping-navigation-lovable-3218bd2.patch').replace(/\r\n/g, '\n');
  const run = (args: string[]) => {
    const result = spawnSync('git', ['apply', ...args, '-'], { cwd: work, input: patch, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`Isolated patch failed: ${result.stderr}`);
  };
  run(['--check']);
  run([]);
  fixed = readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
} finally {
  // Exact files/directories created above only; no recursive deletion or arbitrary paths.
  unlinkSync(target);
  rmdirSync(join(work, 'src', 'routes')); rmdirSync(join(work, 'src')); rmdirSync(work);
}
const ast = ts.createSourceFile('housekeeping.tsx', fixed, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
test('patched route transpiles as TSX without syntax errors (not a full app typecheck)', () => {
  const result = ts.transpileModule(fixed, { fileName: 'housekeeping.tsx', reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } });
  expect(result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error) ?? []).toEqual([]);
});
function nodes(predicate: (n: ts.Node) => boolean) {
  const matches: ts.Node[] = [];
  function visit(n: ts.Node) { if (predicate(n)) matches.push(n); ts.forEachChild(n, visit); }
  visit(ast);
  return matches;
}
function variable(name: string) {
  const n = nodes(n => ts.isVariableDeclaration(n) && n.name.getText(ast) === name)[0] as ts.VariableDeclaration;
  if (!n?.initializer) throw new Error(`Missing ${name}`);
  return n.initializer.getText(ast);
}
function evaluate(expression: string, context: Record<string, unknown> = {}) {
  const code = ts.transpileModule(`const result = (${expression});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, module: ts.ModuleKind.None },
  }).outputText;
  return new Function('React', ...Object.keys(context), `${code}\nreturn result;`)(React, ...Object.values(context));
}
const Icon = () => <svg aria-hidden="true" />;
const parts = evaluate(variable('bagianHk'), { Brush: Icon, Users: Icon, Package: Icon, Wrench: Icon, History: Icon });
const nav = nodes(n => ts.isJsxElement(n) && n.openingElement.tagName.getText(ast) === 'nav')[0];
if (!nav) throw new Error('Navigation not rendered');

test('restore actual navigation absent in preview; preserve all existing source outside insertion', () => {
  expect(baseline).not.toContain('bagianHk.map(');
  const insertion = fixed.slice(fixed.indexOf('      <nav aria-label="Bagian Housekeeping"'), fixed.indexOf('      {message &&'));
  expect(fixed.replace(insertion, '')).toBe(baseline);
  expect(insertion).not.toMatch(/rpc|supabase|override|onClick|<button/);
  expect(read('fixtures/housekeeping-navigation-existing.css.txt')).toContain('.hk-tabs {');
  expect(read('fixtures/housekeeping-navigation-existing.css.txt')).toContain('.hk-tab[aria-current="page"]');
});

test('all five existing sections are actual links, including Tugas Petugas', () => {
  for (const active of ['status', 'checklist', 'perlengkapan', 'perawatan', 'riwayat']) {
    const links: any[] = [];
    const Link = (props: any) => { links.push(props); return <a href={`${props.to}?bagian=${props.search.bagian}`} aria-current={props['aria-current']} className={props.className}>{props.children}</a>; };
    const html = renderToStaticMarkup(evaluate(nav.getText(ast), { Link, bagianHk: parts, bagian: active }));
    expect(links.map(p => p.search.bagian)).toEqual(['status', 'checklist', 'perlengkapan', 'perawatan', 'riwayat']);
    expect(html).toContain('Tugas Petugas');
    expect(html).toContain('href="/housekeeping?bagian=checklist"');
    expect(links.filter(p => p['aria-current'] === 'page').map(p => p.search.bagian)).toEqual([active]);
    expect(links.every(p => p.className === 'hk-tab')).toBe(true);
  }
});

test('existing route validation accepts section links and safely defaults unknown section', () => {
  const prop = nodes(n => ts.isPropertyAssignment(n) && n.name.getText(ast) === 'validateSearch')[0] as ts.PropertyAssignment;
  const validate = evaluate(prop.initializer.getText(ast), { bagianHk: parts });
  for (const section of parts) expect(validate({ bagian: section.kode })).toEqual({ bagian: section.kode });
  for (const bagian of ['unknown', null, 1, {}]) expect(validate({ bagian })).toEqual({ bagian: undefined });
  expect(validate({})).toEqual({ bagian: undefined });
});

const button = nodes(n => ts.isJsxElement(n) && n.openingElement.tagName.getText(ast) === 'Button' && n.getText(ast).includes('Telah Dibersihkan'))[0]!;
let action: ts.Node = button;
while (ts.isBinaryExpression(action.parent)) action = action.parent;
function actionFor(role: string | null, status = 'cleaning', sectionKey = 'cleaning', processing = false) {
  let captured: any;
  const opened: string[] = [];
  const canAdvance = evaluate(variable('canAdvance'), { posisiKode: role });
  const element = evaluate(action.getText(ast), { canAdvance, section: { key: sectionKey },
    room: { id: 'dummy-room-10', status }, processingIds: processing ? ['dummy-room-10'] : [],
    Button: (props: any) => { captured = props; return <button disabled={props.disabled}>{props.children}</button>; },
    ClipboardCheck: Icon, setChecklistRoomId: (id: string) => opened.push(id) });
  const html = renderToStaticMarkup(element || <></>);
  return { html, opened, click: () => captured?.onClick(), disabled: captured?.disabled };
}

test('existing action allows Owner/Supervisor/Housekeeping and only opens checklist locally', () => {
  for (const role of ['owner', 'supervisor', 'housekeeping']) {
    const a = actionFor(role);
    expect(a.html).toContain('Telah Dibersihkan');
    a.click();
    expect(a.opened).toEqual(['dummy-room-10']);
  }
});

test('other positions cannot finish cleaning; other statuses/sections do not expose action', () => {
  for (const role of [null, 'receptionist', 'inspector', 'investor', 'unknown']) {
    const a = actionFor(role); a.click();
    expect(a.html).not.toContain('Telah Dibersihkan');
    expect(a.opened).toEqual([]);
  }
  for (const status of ['occupied', 'dirty', 'ready']) expect(actionFor('owner', status).html).not.toContain('Telah Dibersihkan');
  expect(actionFor('owner', 'cleaning', 'dirty').html).not.toContain('Telah Dibersihkan');
  expect(actionFor('owner', 'cleaning', 'cleaning', true).disabled).toBe(true);
});
