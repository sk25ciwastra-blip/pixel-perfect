/**
 * Baturaden 25 Homestay — reporting only, not cash drawer closing.
 * Refund is a business outflow; cash session allocations/transfers inside the
 * business are not operating revenue or expenses.
 *
 * Only Owner can read the COMPLETE finance_refunds ledger today.
 * For all other roles, we may show gross payments minus recorded expenses,
 * but must NOT call that value "net cash flow".
 */
export function hitungArusKasBersih(
  penerimaanBruto: number,
  pengeluaran: number,
  refund: number | null,
): number | null {
  if (refund === null ||
    ![penerimaanBruto, pengeluaran, refund].every(Number.isFinite)) return null;
  return penerimaanBruto - pengeluaran - refund;
}

export function labelHasilArusKas(hasRefundCoverage: boolean): string {
  return hasRefundCoverage
    ? 'Arus Kas Bersih (setelah Refund)'
    : 'Selisih Penerimaan - Biaya (belum termasuk Refund)';
}
