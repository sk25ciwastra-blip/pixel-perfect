/** Baturaden 25 Homestay — validate counted physical cash before closing.
 * This UI preflight is not an authorization boundary; Cloud RPC revalidates
 * actor, session status, money, allocation and variance under row lock.
 */
export type ClosingCashReview =
  | { ok: true; counted: number; difference: number }
  | { ok: false; error: string };

export function reviewClosingCash(
  expected: number | null,
  rawCount: string,
  cashAllocation: number,
  reason: string,
): ClosingCashReview {
  if (expected === null || !Number.isFinite(expected)) {
    return { ok: false, error: 'Saldo kas belum tersedia. Muat ulang ringkasan sebelum closing.' };
  }
  const value = rawCount.trim();
  const counted = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(counted) || counted < 0) {
    return { ok: false, error: 'Masukkan hasil hitung uang fisik dalam nominal rupiah bulat sebelum Closing.' };
  }
  if (expected < 0 && counted !== 0) {
    return { ok: false, error: 'Saldo sesi minus: perhitungan kas fisik harus nol untuk Closing ini.' };
  }
  if (cashAllocation !== counted) {
    return { ok: false, error: 'Total alokasi Cash harus sama dengan uang fisik yang dihitung.' };
  }
  const difference = counted - expected;
  if (difference !== 0 && !reason.trim()) {
    return { ok: false, error: 'Tuliskan alasan selisih kas sebelum Closing.' };
  }
  return { ok: true, counted, difference };
}
