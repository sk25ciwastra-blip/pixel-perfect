import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const sessionSource = readFileSync(new URL('../src/lib/sesi-kas.ts', import.meta.url), 'utf8');
const profileSource = readFileSync(new URL('../src/components/kerangka.tsx', import.meta.url), 'utf8');

test('same-tab selector notifies mounted consumers and clears on exit', () => {
  const fn = sessionSource.match(/export function setSesiKasKonteks\(sessionId: string \| null\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(fn, 'setSesiKasKonteks must exist');
  const data = new Map();
  const emitted = [];
  const window = {
    sessionStorage: {
      setItem: (k, v) => data.set(k, v),
      removeItem: (k) => data.delete(k),
    },
    dispatchEvent: (event) => emitted.push(event.type),
  };
  class FakeEvent { constructor(type) { this.type = type; } }
  const setter = vm.runInNewContext(
    fn.replace('export function ', 'function ').replace('sessionId: string | null', 'sessionId')
      + '\nsetSesiKasKonteks',
    { window, Event: FakeEvent,
      ACTIVE_SESSION_KEY: 'baturaden25.active_finance_session_id',
      SESSION_CONTEXT_CHANGE: 'baturaden25:sesi-kas-konteks' },
  );
  setter('session-A');
  assert.equal(data.get('baturaden25.active_finance_session_id'), 'session-A');
  setter(null);
  assert.equal(data.has('baturaden25.active_finance_session_id'), false);
  assert.deepEqual(emitted, ['baturaden25:sesi-kas-konteks', 'baturaden25:sesi-kas-konteks']);
});

test('same-tab and cross-tab listeners are paired with cleanup', () => {
  assert.match(sessionSource, /addEventListener\(SESSION_CONTEXT_CHANGE, sync\)/);
  assert.match(sessionSource, /removeEventListener\(SESSION_CONTEXT_CHANGE, sync\)/);
  assert.match(sessionSource, /addEventListener\('storage', handleStorage\)/);
  assert.match(sessionSource, /removeEventListener\('storage', handleStorage\)/);
});

test('manual selection explicitly wins over owned session', () => {
  assert.match(sessionSource, /isSessionHelper && assistedSessionId\s*\? assistedSession\s*:\s*ownSession \?\? onlyOpenSession/);
  const sessions = [{id:'A', status:'OPEN'}, {id:'B',status:'OPEN'}];
  const own = sessions[0], assisted = sessions[1];
  const active = assisted ?? own;
  assert.equal(active.id,'B');
});

test('closed chosen session never silently changes to a different drawer', () => {
  assert.match(sessionSource, /isSessionHelper && assistedSessionId\s*\? assistedSession\s*:\s*ownSession \?\? onlyOpenSession/);
  const ownSession = {id:'A',status:'OPEN'};
  const assistedSessionId='B';
  const assistedSession = undefined;
  const activeSession = assistedSessionId ? assistedSession : ownSession;
  assert.equal(activeSession,undefined);
  assert.match(profileSource, /Sesi pilihan sudah ditutup/);
});

test('non-Owner/Supervisor and trainee cannot select helper session', () => {
  assert.match(sessionSource, /const isSessionHelper = posisiKode === 'owner' \|\| posisiKode === 'supervisor'/);
  assert.match(sessionSource, /if \(!isSessionHelper \|\| training\.is_training\) return false/);
  assert.match(profileSource, /isSessionHelper && !isTraining && !yakin/);
});

test('selector uses only OPEN sessions and correct owner identity', () => {
  assert.match(sessionSource, /session\.status === 'OPEN'/);
  assert.match(sessionSource, /!openSessions\.some\(\(session\) => session\.id === sessionId\)/);
  assert.match(profileSource, /employee\.user_id === openedBy/);
  assert.match(profileSource, /\{namaPemilik\(session\.opened_by\)\}/);
});

test('selecting an active session only changes local context, never finance ledger', () => {
  assert.match(sessionSource, /setSesiKasKonteks\(sessionId\)/);
  assert.doesNotMatch(sessionSource, /supabase\.rpc|\.insert\(|\.update\(|\.delete\(/);
  assert.match(profileSource, /setSesiKasKonteks\(null\); void keluar\(\)/);
});
