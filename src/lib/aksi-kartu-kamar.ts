// UI dispatch only; operational validation remains in the existing form and RPCs.
export function aksiKartuKamar(room: { active: boolean; status: string }, canCheckIn: boolean) {
  if (!room.active) return 'informasi';
  if (room.status === 'ready') return canCheckIn ? 'check_in' : 'informasi';
  if (room.status === 'occupied') return 'hunian';
  if (room.status === 'dirty' || room.status === 'cleaning') return 'housekeeping';
  return 'informasi';
}