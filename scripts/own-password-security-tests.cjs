// Focused self-service password contract tests (offline mocks, no Supabase calls).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const source = read('src/lib/own-password.ts');
const output = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const scope = { exports: {} };
vm.runInNewContext(output, scope, { filename: 'own-password.js' });
const { validatePasswordFields, changeOwnPassword } = scope.exports;

const valid = {
  currentPassword: 'OldPass123!',
  newPassword: 'NewPass456!',
  confirmPassword: 'NewPass456!',
};
const cases = [];
function check(name, test) { cases.push({ name, test }); }
const bad = (values) => Boolean(validatePasswordFields({ ...valid, ...values }));

check('Reject empty password fields', () => { assert.equal(bad({ currentPassword: '' }), true); });
check('Reject new password shorter than eight characters', () => { assert.equal(bad({ newPassword: 'abc', confirmPassword: 'abc' }), true); });
check('Reject mismatched confirmation', () => { assert.equal(bad({ confirmPassword: 'different' }), true); });
check('Reject reusing the existing password', () => {
  assert.equal(bad({ newPassword: valid.currentPassword, confirmPassword: valid.currentPassword }), true);
});
check('Accept valid password form', () => { assert.equal(validatePasswordFields(valid), null); });

function mockedAuth({
  existing = { id: 'own-user', email: 'own@example.test' },
  verified = { id: 'own-user' },
  authError = null,
  signinError = null,
  updateError = null,
  throwOnUpdate = false,
} = {}) {
  const calls = [];
  const auth = {
    async getUser() { calls.push('getUser'); return { data: { user: existing }, error: authError }; },
    async signInWithPassword(credentials) {
      calls.push('signInWithPassword');
      assert.equal(credentials.email, 'own@example.test');
      assert.equal(credentials.password, valid.currentPassword);
      return { data: { user: verified }, error: signinError };
    },
    async updateUser(payload) {
      calls.push('updateUser');
      assert.equal(payload.password, valid.newPassword);
      assert.equal(payload.current_password, valid.currentPassword);
      if (throwOnUpdate) throw new Error('network failed');
      return { error: updateError };
    },
  };
  return { auth, calls };
}
check('Invalid form never contacts Supabase', async () => {
  const m = mockedAuth();
  const r = await changeOwnPassword(m.auth, { ...valid, confirmPassword: 'wrong' });
  assert.equal(r.ok, false); assert.equal(m.calls.length, 0);
});
check('Missing signed-in user stops before password verification', async () => {
  const m = mockedAuth({ existing: null });
  const r = await changeOwnPassword(m.auth, valid);
  assert.equal(r.ok, false); assert.equal(m.calls.join(','), 'getUser');
});
check('Invalid current password cannot call updateUser', async () => {
  const m = mockedAuth({ signinError: { message: 'invalid login' }, verified: null });
  const r = await changeOwnPassword(m.auth, valid);
  assert.equal(r.ok, false); assert.equal(m.calls.join(','), 'getUser,signInWithPassword');
});
check('Auth identity switch cannot call updateUser', async () => {
  const m = mockedAuth({ verified: { id: 'another-account' } });
  const r = await changeOwnPassword(m.auth, valid);
  assert.equal(r.ok, false); assert.equal(m.calls.join(','), 'getUser,signInWithPassword');
});
check('Successful same-user reauthentication updates only own password', async () => {
  const m = mockedAuth();
  const r = await changeOwnPassword(m.auth, valid);
  assert.equal(r.ok, true);
  assert.equal(m.calls.join(','), 'getUser,signInWithPassword,updateUser');
});
check('Auth provider rejects password change without false success', async () => {
  const m = mockedAuth({ updateError: { message: 'weak password' } });
  const r = await changeOwnPassword(m.auth, valid);
  assert.equal(r.ok, false);
});
check('Auth reauthentication error returns user guidance', async () => {
  const m = mockedAuth({ updateError: { message: 'nonce required', code: 'reauthentication_needed' } });
  const r = await changeOwnPassword(m.auth, valid);
  assert.equal(r.ok, false);
  assert.ok(r.message.includes('verifikasi tambahan'));
});
check('Weak password Auth response has actionable safe guidance', async () => {
  const m = mockedAuth({ updateError: { code: 'weak_password', message: 'Password refused' } });
  const r = await changeOwnPassword(m.auth, valid);
  assert.equal(r.ok, false);
  assert.ok(r.message.includes('kebijakan keamanan'));
});
check('Same password gets a distinct message', async () => {
  const m = mockedAuth({ updateError: { code: 'same_password', message: 'Same password' } });
  const r = await changeOwnPassword(m.auth, valid);
  assert.equal(r.ok, false);
  assert.ok(r.message.includes('sebelumnya'));
});
check('Rate-limit guidance does not reveal Auth raw error details', async () => {
  const m = mockedAuth({ updateError: { code: 'over_request_rate_limit', message: 'secret in auth error' } });
  const r = await changeOwnPassword(m.auth, valid);
  assert.equal(r.ok, false);
  assert.ok(r.message.includes('Terlalu banyak percobaan'));
  assert.ok(!r.message.includes('secret'));
});
check('Unknown Auth code shown in sanitized form without raw error message', async () => {
  const m = mockedAuth({ updateError: { code: 'custom_policy_error', message: 'hidden server contents' } });
  const r = await changeOwnPassword(m.auth, valid);
  assert.equal(r.ok, false);
  assert.ok(r.message.includes('custom_policy_error'));
  assert.ok(!r.message.includes('hidden server contents'));
});
check('Malformed Auth code and provider message are not reflected to users', async () => {
  const m = mockedAuth({ updateError: { code: '<unsafe html>', message: 'new password leaked' } });
  const r = await changeOwnPassword(m.auth, valid);
  assert.equal(r.ok, false);
  assert.ok(!r.message.includes('unsafe') && !r.message.includes('leaked'));
});
check('Session expiry suggests login again rather than changing another account', async () => {
  const m = mockedAuth({ updateError: { code: 'session_expired', message: 'session expired' } });
  const r = await changeOwnPassword(m.auth, valid);
  assert.equal(r.ok, false);
  assert.ok(r.message.includes('login kembali'));
});
check('Network failure returns safe error and no password leakage', async () => {
  const m = mockedAuth({ throwOnUpdate: true });
  const r = await changeOwnPassword(m.auth, valid);
  assert.equal(r.ok, false);
  assert.ok(!r.message.includes(valid.currentPassword) && !r.message.includes(valid.newPassword));
});
check('Navigation exposes only personal security settings for staff', () => {
  const rootRoute = read('src/routes/__root.tsx');
  const navbar = read('src/components/kerangka.tsx');
  const settings = read('src/routes/pengaturan.tsx');
  const page = read('src/routes/pengaturan-keamanan.tsx');
  assert.ok(rootRoute.includes("pathname === '/pengaturan' || pathname === '/pengaturan-keamanan'"));
  assert.ok(rootRoute.includes("return Boolean(posisiKode)"));
  assert.ok(navbar.includes('ke === "/pengaturan"'));
  assert.ok(settings.includes('peran === "owner" ? kelompok : kelompok.filter'));
  assert.ok(settings.includes('ke: "/pengaturan-keamanan"'));
  assert.ok(page.includes('changeOwnPassword(supabase.auth'));
  assert.ok(!page.includes('service_role'));
});

(async () => {
  for(const test of cases) {
    await test.test();
    process.stdout.write('PASS: ' + test.name + '\n');
  }
  console.log('PASS: ' + cases.length + ' focused self-service password checks (offline only).');
})().catch(e => { console.error('FAIL: ' + e.message); process.exitCode = 1; });
