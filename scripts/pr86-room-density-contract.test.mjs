// Focused PR #86 source contract test. Runs actual TSX memo callbacks on synthetic fixtures.
// No browser login, production writes, or prior operational-suite reruns.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read = path => readFileSync(path, 'utf8');
const dash = read('src/routes/index.tsx');
const card = read('src/routes/kamar.tsx');
const overtimeSrc = read('src/lib/room-overtime.ts');
const parsed = ts.createSourceFile('index.tsx', dash, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const findMemo = name => {
  let match = null;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === name) {
      assert.equal(match, null, 'memo must have one definition');
      match = node.initializer;
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  assert.ok(match && ts.isCallExpression(match), name+' must be a hook call');
  assert.equal(match.expression.getText(parsed), 'useMemo');
  assert.equal(match.arguments.length, 2);
  const fn = match.arguments[0];
  assert.ok(ts.isArrowFunction(fn));
  return fn.getText(parsed);
};
const memo = (name, deps) => new Function(...Object.keys(deps), 'return ('+findMemo(name)+')')(...Object.values(deps));

const exports = {};
const transpiled = ts.transpileModule(overtimeSrc, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
vm.runInNewContext(transpiled, {exports, Date, Number, Object, isNaN}, {timeout:1000});
const roomOvertimeIndicator = exports.roomOvertimeIndicator;
assert.equal(typeof roomOvertimeIndicator, 'function');
const now = Date.parse('2026-11-19T02:00:00+07:00');
const ended = mins => new Date(now-mins*60000).toISOString();
const stay = mins => ({status:'check_in',ends_at:ended(mins)});
assert.equal(roomOvertimeIndicator(stay(120),now).needsAction,false, '120-minute exact boundary');
assert.equal(roomOvertimeIndicator(stay(121),now).needsAction,true, 'over 120-minute warning');
assert.equal(roomOvertimeIndicator({status:'booking',ends_at:ended(121)},now).needsAction,false, 'booking is not occupied overtime');
assert.equal(roomOvertimeIndicator({status:'check_in',ends_at:null},now).deadlineKnown,false, 'missing deadline is unknown');
console.log('PASS: real overtime helper retains correct threshold and status');

const kamarAktif = ['03','06','07','08','09'].map((num,i)=>({id:'room-'+num,room_number:num,room_type_id:'type-'+i}));
const kamarTerisi = kamarAktif.slice(0,4).map((room,i)=>({room,transaksi:{id:'tr-'+i,status:'check_in',ends_at:ended(121+i)},guest:{full_name:'TEST'} }));
const bookingHariIni = [];
const roomTypes = {rows:kamarAktif.map(room=>({id:room.room_type_id,name:'Standard'}))};
const table = memo('statusKamarBaris',{kamarAktif,kamarTerisi,bookingHariIni,roomTypes,sekarang:now})();
assert.equal(table.length,4, '4 occupied overdue rooms must remain in Status Kamar table');
assert.deepEqual(table.map(x=>x.room.room_number),['03','06','07','08']);
assert.ok(table.every(x=>x.terisi?.transaksi?.status==='check_in'));
assert.ok(table.every(x=>x.terisi.transaksi.id));
console.log('PASS: actual dashboard memo keeps all four overdue rooms in occupied table');

const overtime = memo('overtimePerluTindakan',{kamarTerisi,roomOvertimeIndicator,sekarang:now})();
assert.equal(overtime.length,4, 'compact alert still tracks all 4 occupied overdue stays');
assert.equal(dash.includes('{statusKamarBaris.length === 0 ? ('),true, 'empty state is governed by real table rows');
assert.equal(dash.includes('const terisi = kamarTerisi.find((item) => item.room?.id === room.id);'),true);
console.log('PASS: overdue indicator retained, false empty state is prevented');

const start=dash.indexOf('{overtimePerluTindakan.length > 0 && (');
const end=dash.indexOf('{statusKamarBaris.length === 0 ? (',start);
assert.ok(start>=0 && end>start);
const alertBlock=dash.slice(start,end);
assert.ok(alertBlock.includes('overtimePerluTindakan.length} kamar overtime lebih dari 120 menit'));
assert.ok(alertBlock.includes('Detail dan Check-out tersedia di tabel'));
assert.ok(!alertBlock.includes('<Button'), 'alert must not duplicate transaction actions');
assert.ok(!alertBlock.includes('overtimePerluTindakan.map(({ transaksi: item, room, guest })'), 'no full-width duplicate queue');
console.log('PASS: dashboard action alert is compact and avoids duplicate buttons');

assert.ok(card.includes('PERLU TINDAKAN · &gt;120 menit'), 'room text stays concise');
assert.ok(card.includes('title="Overtime lebih dari 120 menit"'), 'full meaning is still accessible');
assert.ok(card.includes('import "@/components/kamar.css";'), 'preserve original CSS import');
assert.ok(card.includes('className={\`kamar-kartu \${overtime ? "ring-2 ring-destructive" : ""}\`}'), 'warning remains visible');
console.log('PASS: room card preserves compact warning and CSS');
console.log('5 NEW PR86 source contracts PASS; no live data/actions.');
