import { test, expect } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AksiPdfStruk } from '../src/components/konfirmasi-pembayaran';
import { canUseConfirmationPdf } from '../src/lib/payment-confirmation-access';
import type { usePaymentConfirmation } from '../src/lib/use-payment-confirmation';

// Render the actual shared Booking/Detail PDF controls without any app auth/SDK or network.
test('shared PDF controls allow eligible roles and show honest denial for Training/inactive/other roles', () => {
  for (const [position, training, signedIn, allowed] of [
    ['owner', 'NONE', true, true], ['supervisor', 'NONE', true, true], ['receptionist', 'PASSED', true, true],
    ['supervisor', 'ACTIVE', true, false], ['receptionist', 'REVOKED', true, false],
    ['receptionist', 'NONE', false, false], ['inspector', 'NONE', true, false],
    ['housekeeping', 'NONE', true, false], ['investor', 'NONE', true, false],
  ] as const) {
    const pdfAvailable = canUseConfirmationPdf(true, signedIn, position, training);
    expect(pdfAvailable).toBe(allowed);
    const hook = { pdfAvailable } as ReturnType<typeof usePaymentConfirmation>;
    const html = renderToStaticMarkup(<AksiPdfStruk hook={hook} transactionId="isolated-fixture" />);
    expect(html.includes('1. Unduh PDF')).toBe(allowed);
    if (allowed) {
      expect(html).toContain('2. Buka WhatsApp');
      expect(html).toContain('Lampirkan PDF secara manual');
      expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*2\. Buka WhatsApp/);
    } else expect(html).toContain('Training tidak diizinkan');
  }
});
