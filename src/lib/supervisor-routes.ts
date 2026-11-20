/**
 * Baturaden 25 Homestay: explicitly allow only operational pages to Supervisors.
 * Navigation hiding is not authorization; the same check protects direct URLs.
 * Owner-only settings, staff management, tariffs and expenditure admin are excluded.
 */
const supervisorAllowedPaths = new Set([
  '/',
  '/kamar',
  '/booking',
  '/check-in',
  '/transaksi',
  '/tamu',
  '/housekeeping',
  '/keuangan',
  '/laporan',
]);

export function canAccessSupervisorOperationalPage(pathname: string): boolean {
  return supervisorAllowedPaths.has(pathname);
}
