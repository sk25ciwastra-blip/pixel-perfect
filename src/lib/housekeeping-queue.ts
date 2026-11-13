type QueueRoom = { active: boolean; status: string };

/** Status is the Owner's occupied/dirty list; ongoing work stays on the existing Checklist tab. */
export function housekeepingSections<T extends QueueRoom>(rooms: readonly T[], area: 'status' | 'checklist') {
  const active = rooms.filter(room => room.active);
  if (area === 'checklist') return [{ key: 'cleaning' as const, judul: 'Sedang Dibersihkan',
    label: 'sedang' as const, rooms: active.filter(room => room.status === 'cleaning') }];
  return [
    { key: 'occupied' as const, judul: 'Kamar Terisi', label: 'terisi' as const,
      rooms: active.filter(room => room.status === 'occupied') },
    { key: 'dirty' as const, judul: 'Perlu Dibersihkan', label: 'perlu' as const,
      rooms: active.filter(room => room.status === 'dirty') },
  ];
}

/** A shortage is information, never a replacement room status or a readiness gate. */
export function housekeepingShortageNote(checklist?: { result: string; issue_note: string }) {
  return checklist?.result === 'needs_action'
    ? checklist.issue_note.trim() || 'Kekurangan tercatat; rincian belum tersedia.' : null;
}
