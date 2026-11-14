// UI dispatch only; operational validation remains in the existing form and RPCs.
export function aksiKartuKamar(room: { active: boolean; status: string }, canCheckIn: boolean) {
  if (!room.active) return 'informasi';
  return canCheckIn ? 'check_in' : 'informasi';
}