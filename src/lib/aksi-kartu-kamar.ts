// UI dispatch only; operational validation remains in the existing form and RPCs.
export function aksiKartuKamar(room: { active: boolean; status: string }, canCheckIn: boolean) {
  if (!room.active || room.status !== 'ready') return 'status';
  return canCheckIn ? 'check_in' : 'informasi';
}

export function statusPopupKamar(room: { active: boolean; status: string }) {
  if (!room.active) return 'nonaktif';
  if (room.status === 'occupied') return 'terisi';
  if (room.status === 'dirty') return 'perlu';
  if (room.status === 'cleaning') return 'sedang';
  return 'nonaktif';
}