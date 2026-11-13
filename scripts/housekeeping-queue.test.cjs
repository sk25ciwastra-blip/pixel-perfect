// Focused queue regressions only. No SDK, RPC, database or existing HK PASS suite.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(file, mocks = {}) {
  const context = { exports: {}, require(name) {
    if (name in mocks) return mocks[name];
    if (['react','react/jsx-runtime'].includes(name)) return require(name);
    throw Error('Unexpected dependency: ' + name);
  } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, context);
  return context.exports;
}
const helpers = load('src/lib/housekeeping-queue.ts');
const room = (id,status,active=true) => ({id,room_number:id,status,active,room_type_id:'type'});
test('Status selects active occupied/dirty only, irrespective of shortage; Checklist retains ongoing cleaning', () => {
  const rooms = [room('occupied','occupied'),room('dirty','dirty'),room('ready','ready'),
    room('cleaning','cleaning'),room('disabled','dirty',false),room('unknown','unknown')];
  const before = JSON.stringify(rooms);
  const status = helpers.housekeepingSections(rooms,'status');
  assert.deepEqual(Array.from(status,s=>s.key),['occupied','dirty']);
  assert.deepEqual(Array.from(status.flatMap(s=>s.rooms),r=>r.id),['occupied','dirty']);
  assert.deepEqual(Array.from(helpers.housekeepingSections(rooms,'checklist').flatMap(s=>s.rooms),r=>r.id),['cleaning']);
  assert.equal(helpers.housekeepingShortageNote({result:'needs_action',issue_note:'Handuk kurang satu'}),'Handuk kurang satu');
  assert.equal(helpers.housekeepingShortageNote({result:'needs_action',issue_note:' '}),'Kekurangan tercatat; rincian belum tersedia.');
  assert.equal(helpers.housekeepingShortageNote({result:'passed',issue_note:'old note'}),null);
  assert.equal(helpers.housekeepingShortageNote(),null);
  assert.equal(JSON.stringify(rooms),before);
});

function page(rows, area='status', position='owner') {
  let calls=0;
  const stub = ({children}) => React.createElement('span',null,children);
  const icons = new Proxy({}, {get:()=>()=>null});
  const api = load('src/routes/housekeeping.tsx', {
    '@tanstack/react-router': {createFileRoute:()=>options=>({...options,useSearch:()=>({bagian:area})}),Link:stub},
    '@/components/kerangka': {Kerangka:({children})=>React.createElement('main',null,children)},
    '@/components/ui/button': {Button:({children,disabled})=>React.createElement('button',{disabled},children)},
    '@/components/ui/input': {Input:()=>React.createElement('input')},
    '@/components/status-kamar': {LencanaStatus:({status})=>React.createElement('span',null,status)},
    '@/lib/housekeeping-queue': helpers,
    '@/lib/data-live': {useTable: name=>({rows: name==='rooms'?rows:name==='room_types'?[{id:'type',name:'Dummy type'}]:
      name==='housekeeping_checklists'?[{room_id:'OCCUPIED-ROOM',created_at:'2026-11-13T00:00:00Z',result:'needs_action',issue_note:'Handuk <kurang>'},
        {room_id:'READY-MISSING-ROOM',created_at:'2026-11-13T00:00:00Z',result:'needs_action',issue_note:'Kekurangan READY'}]:[],
      error:null,loading:false,refresh:async()=>{}})},
    '@/integrations/supabase/client': {supabase:{rpc(){calls++;throw Error('Unexpected RPC');}}},
    '@/lib/meta': {meta:()=>({})}, '@/lib/peran': {usePeran:()=>({posisiKode:position})},
    '@/components/checklist-housekeeping': {ChecklistHousekeeping:stub},
    '@/components/perawatan-berkala': {PerawatanBerkala:stub},
    'lucide-react': icons, '@/lib/konteks-header': {konteksHeader:{'/housekeeping':'Fixture context'}},
  });
  const before=JSON.stringify(rows),html=renderToStaticMarkup(React.createElement(api.Route.component));
  assert.equal(calls,0);assert.equal(JSON.stringify(rows),before);
  return html;
}
const rows = () => [room('OCCUPIED-ROOM','occupied'),room('DIRTY-ROOM','dirty'),room('READY-MISSING-ROOM','ready'),
  room('READY-ROOM','ready'),room('CLEANING-ROOM','cleaning'),room('DISABLED-ROOM','dirty',false),room('01','occupied')];
test('actual Status route hides READY including shortages, shows occupied details, and never offers occupied override', () => {
  const html=page(rows());
  assert.match(html,/OCCUPIED-ROOM/);assert.match(html,/DIRTY-ROOM/);
  assert.doesNotMatch(html,/READY-MISSING-ROOM|READY-ROOM|CLEANING-ROOM|DISABLED-ROOM/);
  assert.match(html,/<summary[^>]*>Informasi kekurangan<\/summary>/);
  assert.match(html,/Handuk &lt;kurang&gt;/);
  const occupied=html.split('<tr').find(part=>part.includes('OCCUPIED-ROOM'));
  assert.doesNotMatch(occupied,/Mulai Bersihkan|Telah Dibersihkan|Jadikan Siap/);
  const dirty=html.split('<tr').find(part=>part.includes('DIRTY-ROOM'));
  assert.match(dirty,/Mulai Bersihkan/);assert.match(dirty,/Jadikan Siap/);
});
test('ongoing cleaning remains finishable on existing Checklist tab and disappears once READY', () => {
  const html=page(rows(),'checklist');
  assert.match(html,/CLEANING-ROOM/);assert.match(html,/Telah Dibersihkan/);
  assert.doesNotMatch(html,/OCCUPIED-ROOM|DIRTY-ROOM|READY-MISSING-ROOM|READY-ROOM|DISABLED-ROOM/);
  const finished=rows().map(r=>r.id==='CLEANING-ROOM'?{...r,status:'ready'}:r);
  assert.doesNotMatch(page(finished,'checklist'),/CLEANING-ROOM|Telah Dibersihkan/);
  assert.doesNotMatch(page(finished),/CLEANING-ROOM/);
});
test('existing housekeeping/inspector UI permission boundaries remain in both queue views', () => {
  assert.match(page(rows(),'status','housekeeping'),/Mulai Bersihkan/);
  assert.doesNotMatch(page(rows(),'status','housekeeping'),/Jadikan Siap/);
  assert.match(page(rows(),'checklist','housekeeping'),/Telah Dibersihkan/);
  for(const area of ['status','checklist']) assert.doesNotMatch(page(rows(),area,'inspector'),/Mulai Bersihkan|Telah Dibersihkan|Jadikan Siap/);
});
