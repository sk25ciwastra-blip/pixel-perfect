/**
 * Baturaden 25 Homestay — Refund Owner screen only.
 *
 * This is a UI eligibility precheck, not an authorization boundary.
 * Cloud triggers/RPC remain the source of truth and prevent Booking refunds
 * and using cash from FINAL sessions.
 */
export function canRefundTransactionStatus(status: string | null | undefined): boolean {
  return status === 'check_in' || status === 'check_out';
}

export function canSourceRefundFromSession(status: string | null | undefined): boolean {
  return status === 'OPEN';
}
