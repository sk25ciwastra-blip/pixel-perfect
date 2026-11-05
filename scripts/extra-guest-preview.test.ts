import { describe, it, expect } from 'vitest';
import { isPreviewHost, extraGuestAktif, featureGateOn } from '../src/lib/feature-flags';

describe('Extra Guest khusus Preview', () => {
  it('production host selalu OFF', () => {
    expect(extraGuestAktif('pixel-perfect-homestay-hub.lovable.app', true)).toBe(false);
    expect(extraGuestAktif('project--017f6e78-15f2-4d07-a38c-87cb185279bf.lovable.app', true)).toBe(false);
  });
  it('preview host + 3 flag true → ON', () => {
    expect(extraGuestAktif('id-preview--017f6e78-15f2-4d07-a38c-87cb185279bf.lovable.app', featureGateOn('true', 'true', 'true'))).toBe(true);
    expect(isPreviewHost('id-preview-6--017f6e78-15f2-4d07-a38c-87cb185279bf.lovable.app')).toBe(true);
  });
  it('satu flag hilang → OFF', () => {
    expect(extraGuestAktif('id-preview--x.lovable.app', featureGateOn('true', 'true', undefined))).toBe(false);
  });
});
