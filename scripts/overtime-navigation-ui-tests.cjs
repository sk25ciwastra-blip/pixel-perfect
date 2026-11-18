// Focused new navigation/filter regressions only. No Cloud calls or operational suite.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const mod = { exports: {} };
new Function('exports', ts.transpileModule(fs.readFileSync('src/lib/room-overtime.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod.exports);
const {overtimeRoomIds} = mod.exports;
const now = Date.parse('2026-11-19T03:00:00+07:00');
const rooms = ['03','06','07','08','09','10','11','12','01'].map(id=>({id,active:id!=='01',status:id==='10'?'dirty':'occupied'}));
const stay = (room_id, minutes, extra={})=>({room_id,status:'check_in',ends_at:new Date(now-minutes*60000).toISOString(),created_at:'2026-11-18T00:00:00Z',...extra});
const stays = [stay('03',121),stay('06',122),stay('07',123),stay('08',124),stay('09',120),stay('10',500),stay('11',500,{ends_at:null}),stay('12',500,{status:'booking'}),stay('01',500)];
const before = JSON.stringify({rooms,stays});
assert.deepEqual([...overtimeRoomIds(rooms,stays,now)],['03','06','07','08']);
assert.equal(JSON.stringify({rooms,stays}),before); // presentation never changes TERISI/data
assert.deepEqual([...overtimeRoomIds(rooms,[],now)],[]);
assert.deepEqual([...overtimeRoomIds(rooms,stays.map(s=>({...s,status:'check_out'})),now)],[]);
assert.deepEqual([...overtimeRoomIds(rooms,[stay('03',500),stay('03',1,{created_at:'2026-11-19T00:00:00Z'})],now)],[]); // matches latest displayed TRX
const page=fs.readFileSync('src/routes/kamar.tsx','utf8');
const dash=fs.readFileSync('src/routes/index.tsx','utf8');
assert.match(dash,/to="\/kamar" search=\{\{ bagian: "overtime" \}\}/);
assert.ok(dash.includes('to="/kamar" search={{ bagian: "terisi" } as never}')); // old Lihat semua preserved
assert.match(page,/\["semua", "tersedia", "terisi", "perlu", "overtime"\]/);
assert.match(page,/!overtimePending && !overtimeError && overtimeIds.has\(room.id\)/);
assert.match(page,/event.stopPropagation\(\); setDetailTransactionId\(transaction.id\)/);
const css=fs.readFileSync('src/components/kamar.css','utf8');
assert.match(css,/\[data-overtime="true"\] > \.kamar-lampu-terisi/);
assert.match(css,/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none/);
console.log('PASS: all 4 overtime rooms; boundary/non-occupied/inactive/booking/unknown excluded; newest TRX; no mutations; distinct filter; original navigation/TRX; pending/error gating; reduced motion CSS.');
