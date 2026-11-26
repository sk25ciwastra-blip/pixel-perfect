// Real Chromium tests of document-capture input events with React-controlled
// fields. Synthetic-only: no login, backend, database or app LIVE requests.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const origin = process.env.B25_AUTO_CAP_ORIGIN || 'http://127.0.0.1:4187';
const { chromium } = await import(process.env.B25_PLAYWRIGHT_MODULE || 'playwright');
await mkdir('test-results/live-auto-capitalization', { recursive: true });

async function waitForHarness() {
  for (let i = 0; i < 80; i++) {
    try {
      const response = await fetch(`${origin}/qa/live-auto-capitalization.html`);
      if (response.ok && (await response.text()).includes('Live Auto Capitalization Synthetic QA')) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Synthetic input harness did not start');
}
await waitForHarness();

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ name: 'desktop', width: 1280, height: 800 }, { name: 'mobile', width: 375, height: 812 }]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, locale: 'id-ID' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      if (route.request().url().startsWith(origin)) return route.continue();
      errors.push(`Nonlocal request blocked: ${route.request().url()}`);
      return route.abort();
    });
    try {
      await page.goto(`${origin}/qa/live-auto-capitalization.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Live Auto Capitalization QA' }).waitFor();

      const guestName = page.getByLabel('Nama Tamu');
      await guestName.pressSequentially('andi');
      assert.equal(await guestName.inputValue(), 'Andi', 'First character must be uppercase immediately while typing');
      assert.equal(await page.getByTestId('name-state').innerText(), 'Andi', 'Controlled React state must receive formatted value');

      const address = page.getByLabel('Alamat', { exact: true });
      await address.pressSequentially('kiaracondong');
      assert.equal(await address.inputValue(), 'Kiaracondong', 'Guest address capitalized on first key');
      assert.equal(await page.getByTestId('address-state').innerText(), 'Kiaracondong');

      await address.fill('jalan kiaracondong');
      assert.equal(await address.inputValue(), 'Jalan Kiaracondong', 'Address words are capitalized during paste');
      assert.equal(await page.getByTestId('address-state').innerText(), 'Jalan Kiaracondong');

      const bookingAddress = page.getByLabel('Alamat Booking');
      await bookingAddress.fill('jl kiara condong');
      assert.equal(await bookingAddress.inputValue(), 'Jl Kiara Condong', 'Other feature addresses also use word mode');

      const notes = page.getByLabel('Catatan');
      await notes.fill('tamu minta bantal tambahan');
      assert.equal(await notes.inputValue(), 'Tamu minta bantal tambahan');
      assert.equal(await page.getByTestId('note-state').innerText(), 'Tamu minta bantal tambahan');

      // Technical and case-sensitive fields must not be rewritten.
      const protectedFields = [
        ['Nomor WhatsApp', '+62 856-5980-8499', 'phone-state'],
        ['Email', 'test.lower@example.com', 'email-state'],
        ['Password', 'rahasiaAbc123', 'password-state'],
        ['Cari Tamu', 'andi', 'search-state'],
        ['Referensi Transfer', 'trfABC987', 'reference-state'],
        ['Teks WhatsApp', 'hello [nama]', 'template-state'],
        ['Kode Rahasia', 'caseSensitiveABC', 'code-state'],
      ];
      for (const [label, raw, state] of protectedFields) {
        const locator = page.getByLabel(label);
        await locator.fill(raw);
        assert.equal(await locator.inputValue(), raw, `Protected technical input: ${label}`);
        assert.equal(await page.getByTestId(state).innerText(), raw, `State must stay unchanged: ${label}`);
      }

      // A cursor placed at the start stays next to the inserted character.
      await notes.focus();
      await notes.evaluate(node => node.setSelectionRange(0, 0));
      await notes.press('a');
      assert.equal(await notes.inputValue(), 'ATamu minta bantal tambahan');
      assert.equal(await page.getByTestId('note-state').innerText(), 'ATamu minta bantal tambahan');
      const position = await notes.evaluate(node => node.selectionStart);
      assert.equal(position, 1, 'Cursor must stay at the edit position');

      assert.deepEqual(errors, [], 'No JS errors or external requests');
      await page.screenshot({ path: `test-results/live-auto-capitalization/${viewport.name}.png`, fullPage: true });
      console.log(`PASS ${viewport.name}: controlled typing, paste, sentence and address words, caret, protected inputs`);
    } catch (err) {
      await page.screenshot({ path: `test-results/live-auto-capitalization/${viewport.name}-error.png`, fullPage: true }).catch(() => {});
      throw err;
    } finally {
      await context.close();
    }
  }
  console.log('PASS live auto-capitalization Chromium synthetic browser tests; zero Cloud access');
} finally {
  await browser.close();
}
