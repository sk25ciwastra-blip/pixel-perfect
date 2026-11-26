// Genuine Chromium smoke test of the real ActionResultDialog component.
// It only opens a localhost synthetic harness — never Supabase or Lovable LIVE.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const origin = process.env.B25_UI26_ORIGIN ?? 'http://127.0.0.1:4187';
const playwrightModule = process.env.B25_PLAYWRIGHT_MODULE ?? 'playwright';
const { chromium } = await import(playwrightModule);
await mkdir('test-results/ui26-browser', { recursive: true });

async function waitForHarness() {
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(`${origin}/qa/ui26-popup.html`);
      if (response.ok && (await response.text()).includes('UI26-02 Synthetic Popup QA')) return;
    } catch { /* local test server not ready yet */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('The isolated synthetic popup harness did not start');
}

await waitForHarness();
const browser = await chromium.launch({ headless: true });
const viewports = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 375, height: 812 },
];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, locale: 'id-ID' });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.route('**/*', route => {
      // UI harness must never fetch any external origin, including Cloud.
      if (route.request().url().startsWith(origin)) return route.continue();
      pageErrors.push(`Non-local request blocked: ${route.request().url()}`);
      return route.abort();
    });
    try {
      await page.goto(`${origin}/qa/ui26-popup.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: /Uji Interaksi Popup Berhasil/ }).waitFor();

      const popup = page.getByRole('alertdialog');
      assert.equal(await popup.count(), 0, 'Popup must start closed');
      assert.equal(await page.getByTestId('modal-state').innerText(), 'tertutup');

      await page.getByRole('button', { name: 'Uji sukses' }).click();
      await popup.waitFor({ state: 'visible' });
      assert.equal(await popup.getByRole('heading', { name: 'Rekening berhasil ditambahkan' }).count(), 1);
      assert.equal(await popup.getByText('Ini data simulasi; sistem operasional tidak diubah.').count(), 1);
      assert.equal(await popup.getByRole('button').count(), 1, 'Only one dismiss button is allowed');
      assert.equal(await popup.getByRole('button', { name: 'Tutup' }).count(), 1);
      assert.equal(await popup.locator('span.text-emerald-700').count(), 1, 'Success icon must be green');
      assert.equal(await page.getByTestId('modal-state').innerText(), 'success');
      const background = await popup.evaluate(el => getComputedStyle(el).backgroundColor);
      assert.match(background, /250,\s*245,\s*233/, 'Popup must use warm cream background');
      const bounds = await popup.boundingBox();
      assert.ok(bounds, 'Popup must have a visible bounding box');
      assert.ok(bounds.x >= -2 && bounds.x + bounds.width <= viewport.width + 2,
        'Dialog may not overflow viewport horizontally');
      await page.screenshot({ path: `test-results/ui26-browser/${viewport.name}-success.png` });
      await popup.getByRole('button', { name: 'Tutup' }).click();
      await popup.waitFor({ state: 'hidden' });
      assert.equal(await page.getByTestId('modal-state').innerText(), 'tertutup');

      await page.getByRole('button', { name: 'Uji gagal' }).click();
      await popup.waitFor({ state: 'visible' });
      assert.equal(await popup.getByRole('heading', { name: 'Konfigurasi belum dapat disimpan' }).count(), 1);
      assert.equal(await popup.locator('span.text-rose-700').count(), 1, 'Error icon must be red');
      assert.equal(await popup.getByRole('button', { name: 'Tutup' }).count(), 1);
      assert.equal(await page.getByTestId('modal-state').innerText(), 'error');
      await page.screenshot({ path: `test-results/ui26-browser/${viewport.name}-error.png` });
      await page.keyboard.press('Escape');
      await popup.waitFor({ state: 'hidden' });
      assert.equal(await page.getByTestId('modal-state').innerText(), 'tertutup');

      assert.deepEqual(pageErrors, [], 'The synthetic harness must not make external requests or throw errors');
      console.log(`PASS ${viewport.name}: success, error, Tutup, Escape, colors, and viewport fit (synthetic browser)`);
    } catch (error) {
      await page.screenshot({ path: `test-results/ui26-browser/${viewport.name}-failure.png` }).catch(() => {});
      throw error;
    } finally {
      await context.close();
    }
  }
  console.log('PASS UI26-02 browser smoke: two synthetic viewports, zero Cloud operations');
} finally {
  await browser.close();
}
