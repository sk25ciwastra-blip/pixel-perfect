// Only the WIB rollover change: virtual time/events and isolated component dependencies.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(file, mocks = {}, globals = {}) {
  const context = { exports: {}, require(name) {
    if (name in mocks) return mocks[name];
    if (name === 'react/jsx-runtime') return require(name);
    throw Error('Unexpected dependency: ' + name);
  }, ...globals };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, context);
  return context.exports;
}
const calendar = load('src/lib/maintenance-calendar.ts');
function target() {
  const listeners = new Map();
  return { visibilityState: 'visible',
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type,new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    emit(type) { for (const fn of [...(listeners.get(type) ?? [])]) fn(); },
    count() { return [...listeners.values()].reduce((sum,set)=>sum+set.size,0); } };
}
function clock(start) {
  let now=Date.parse(start),id=0;
  const timers=new Map(), window=target(), document=target();
  const env={now:()=>now,setTimer:(fn,delay)=>{timers.set(++id,{fn,at:now+delay});return id;},
    clearTimer:id=>timers.delete(id),window,document};
  return { env,timers,window,document,now:()=>now,
    move(iso,flush=true) { now=Date.parse(iso); if(flush) { let guard=0;
      while([...timers.values()].some(t=>t.at<=now)) { if(++guard>5)throw Error('timer spin');
        const [key,timer]=[...timers].find(([,t])=>t.at<=now);timers.delete(key);timer.fn(); }
    } } };
}
test('WIB 23:59 -> 00:00 updates once and observes the two-calendar-day linen boundary', () => {
  const c=clock('2026-11-13T23:59:00+07:00'),days=[];
  const stop=calendar.watchWibCalendar(day=>days.push(day),c.env);
  assert.deepEqual(days,['2026-11-13']);
  assert.equal(calendar.maintenanceIsDue('2026-11-12',2,days.at(-1)),false);
  c.move('2026-11-14T00:00:00+07:00');
  assert.deepEqual(days,['2026-11-13','2026-11-14']);
  assert.equal(calendar.maintenanceIsDue('2026-11-12',2,days.at(-1)),true);
  assert.equal(calendar.maintenanceIsDue('2026-11-13',2,days.at(-1)),false);
  assert.equal(c.timers.size,1);stop();assert.equal(c.timers.size,0);
});
test('focus/visibility/pageshow recover from throttled timers and multi-day sleep without duplicate date updates', () => {
  const c=clock('2026-11-13T21:00:00+07:00'),days=[];
  const stop=calendar.watchWibCalendar(day=>days.push(day),c.env);
  c.document.visibilityState='hidden';c.move('2026-11-14T08:00:00+07:00',false);
  c.document.emit('visibilitychange');assert.equal(days.length,1);
  c.document.visibilityState='visible';c.document.emit('visibilitychange');
  assert.equal(days.at(-1),'2026-11-14');
  for(let i=0;i<10;i++){c.window.emit('focus');c.window.emit('pageshow');c.document.emit('visibilitychange');}
  assert.equal(days.length,2);assert.equal(c.timers.size,1);
  c.move('2026-11-18T03:00:00+07:00',false);c.window.emit('pageshow');
  assert.equal(days.at(-1),'2026-11-18');assert.equal(days.length,3);assert.equal(c.timers.size,1);
  c.move('2026-11-18T23:59:59+07:00');assert.equal(days.length,3);
  c.move('2026-11-19T00:00:00+07:00');assert.equal(days.at(-1),'2026-11-19');stop();
});
test('cleanup removes timer and every event listener, including late queued callbacks and remount', () => {
  const c=clock('2026-11-13T23:59:00+07:00'),days=[];
  const stop=calendar.watchWibCalendar(day=>days.push(day),c.env),late=[...c.timers.values()][0].fn;
  assert.equal(c.window.count()+c.document.count(),3);stop();stop();
  assert.equal(c.timers.size,0);assert.equal(c.window.count()+c.document.count(),0);
  c.move('2026-11-15T00:00:00+07:00',false);late();c.window.emit('focus');c.document.emit('visibilitychange');
  assert.deepEqual(days,['2026-11-13']);assert.equal(c.timers.size,0);
  const stopAgain=calendar.watchWibCalendar(day=>days.push(day),c.env);
  assert.equal(days.at(-1),'2026-11-15');assert.equal(c.timers.size,1);stopAgain();
});
test('calendar math handles missing/invalid history safely, month/leap rollover and unchanged fan/toilet intervals', () => {
  assert.equal(calendar.wibCalendarDate(Date.parse('2026-11-13T17:00:00Z')),'2026-11-14');
  for(const bad of [undefined,'','invalid','2026-02-30','2026-13-01','2026-11-13T00:00:00Z']) {
    assert.equal(calendar.maintenanceIsDue(bad,2,'2026-11-14'),true);
  }
  assert.equal(calendar.maintenanceIsDue('2026-11-12',2,'invalid'),true);
  assert.equal(calendar.maintenanceIsDue('2028-02-28',2,'2028-03-01'),true);
  assert.equal(calendar.maintenanceIsDue('2026-12-31',2,'2027-01-01'),false);
  assert.equal(calendar.maintenanceIsDue('2026-12-31',2,'2027-01-02'),true);
  for(const interval of [1,15,30]) {
    assert.equal(calendar.maintenanceIsDue('2026-10-01',interval,'2026-10-'+String(interval).padStart(2,'0')),false);
    const next=new Date(Date.parse('2026-10-01T00:00:00Z')+interval*86400000).toISOString().slice(0,10);
    assert.equal(calendar.maintenanceIsDue('2026-10-01',interval,next),true);
  }
});

test('actual hook/component recompute categories, counts and selected list with unchanged data and no RPC/refresh', () => {
  const c=clock('2026-11-13T23:59:00+07:00');
  let cursor=0,pending=[],calls=0;
  const slots=[];
  const same=(a,b)=>a?.length===b?.length&&a.every((v,i)=>Object.is(v,b[i]));
  const hooks={
    useState(initial){const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;
      return [slots[index],value=>{slots[index]=typeof value==='function'?value(slots[index]):value;}];},
    useMemo(make,deps){const index=cursor++;if(!slots[index]||!same(slots[index].deps,deps))slots[index]={deps,value:make()};return slots[index].value;},
    useEffect(effect,deps){const index=cursor++;if(!slots[index]||!same(slots[index].deps,deps))pending.push(()=>{
      slots[index]?.cleanup?.();slots[index]={deps,cleanup:effect()};});},
  };
  class FakeDate extends Date { static now(){return c.now();} }
  const localCalendar=load('src/lib/maintenance-calendar.ts',{}, {Date:FakeDate});
  const window={...c.window,setTimeout:c.env.setTimer,clearTimeout:c.env.clearTimer};
  const hook=load('src/lib/use-wib-calendar-date.ts',{'react':hooks,'./maintenance-calendar':localCalendar},{window,document:c.document,Date:FakeDate});
  // A complete, stable maintenance set: only linen becomes newly due at midnight.
  const rooms=[{id:'room',room_number:'03',active:true,status:'occupied',room_type_id:'type'}];
  const locations=['Toilet Lantai 2 · Kiri','Toilet Lantai 2 · Kanan','Toilet Lantai 1 · Kiri','Toilet Lantai 1 · Kanan',
    'Toilet Superior B · 02','Toilet Superior B · 03','Toilet Superior B · 04'];
  const maintenance=[...locations.map(location_code=>({work_type:'toilet',location_code,operational_date:'2026-11-13',performed_at:'2026-11-13T15:00:00+07:00',performed_by_name:'Dummy'})),
    {work_type:'fan',location_code:'03',operational_date:'2026-11-13',performed_at:'2026-11-13T15:00:00+07:00',performed_by_name:'Dummy'},
    {work_type:'linen',location_code:'03',operational_date:'2026-11-12',performed_at:'2026-11-13T15:00:00+07:00',performed_by_name:'Dummy'}];
  const data={rooms,housekeeping_maintenance:maintenance,room_types:[{id:'type',name:'Standard'}],employees:[]};
  const before=JSON.stringify(data);
  const component=load('src/components/perawatan-berkala.tsx',{
    'react':hooks,'@/lib/use-wib-calendar-date':hook,'@/lib/maintenance-calendar':localCalendar,
    '@/lib/data-live':{rpc(){calls++;throw Error('Unexpected mutation');},useTable:name=>({rows:data[name],error:null,refresh(){calls++;throw Error('Unexpected refresh');}})},
    '@/integrations/supabase/client':{supabase:new Proxy({}, {get(){calls++;throw Error('Unexpected SDK access');}})},
    '@/components/ui/button':{Button:({children})=>React.createElement('button',null,children)},
  });
  const render=()=>{cursor=0;pending=[];const tree=component.PerawatanBerkala({readOnly:false});for(const effect of pending)effect();
    return {tree,html:renderToStaticMarkup(tree)};};
  function find(element,predicate){if(!element||typeof element!=='object')return null;if(predicate(element))return element;
    for(const child of React.Children.toArray(element.props?.children)){const found=find(child,predicate);if(found)return found;}return null;}
  assert.doesNotMatch(render().html,/>Sprei</);
  c.move('2026-11-14T00:00:00+07:00');let result=render();
  assert.match(result.html,/>Sprei</);assert.match(result.html,/1 pekerjaan jatuh tempo/);
  const category=find(result.tree,e=>e.props?.children?.some?.(child=>child?.props?.children==='Sprei'));
  const button=find(category,e=>e.props?.children==='Lihat Daftar');assert.ok(button);button.props.onClick();
  result=render();assert.match(result.html,/Sprei · Kamar 03/);assert.match(result.html,/MENUNGGU AKSES/);
  assert.match(result.html,/<input[^>]*disabled=""/);
  c.move('2026-11-17T08:00:00+07:00',false);c.window.emit('focus');
  assert.match(render().html,/Sprei · Kamar 03/);
  assert.equal(calls,0);assert.equal(JSON.stringify(data),before);
  for(const slot of slots)slot?.cleanup?.();assert.equal(c.timers.size,0);assert.equal(c.window.count()+c.document.count(),0);
});
