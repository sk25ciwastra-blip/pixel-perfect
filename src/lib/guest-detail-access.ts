import type { PosisiAkses } from '@/lib/peran';

/**
 * Detail Tamu privileges mirror the existing AccessGate and the
 * can_frontdesk()/RLS decisions on public.guests.
 *
 * This is UX defense in depth, not a replacement for PostgreSQL RLS.
 * Inspector may read the profile and history but must not initiate changes,
 * contact through the UI, print payment evidence, or open a write-capable
 * transaction detail. Housekeeping and Investor have no Guest route.
 */
export function guestDetailPermissions(position: PosisiAkses, signedIn: boolean) {
  const canView = signedIn && (
    position === 'owner' || position === 'receptionist' ||
    position === 'supervisor' || position === 'inspector'
  );
  const canWrite = signedIn && (
    position === 'owner' || position === 'receptionist' ||
    position === 'supervisor'
  );
  return {
    canView,
    canWrite,
    canContact: canWrite,
    transactionMode: position === 'inspector' ? 'read-only' as const : 'full' as const,
  };
}
