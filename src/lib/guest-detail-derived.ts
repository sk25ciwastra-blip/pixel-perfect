/**
 * Guest detail labels must come from operational records, not placeholder flags.
 * All functions are pure and use no LIVE queries.
 */
export type GuestVisitRecord = {
  status: string;
  guest_count?: number | null;
  room_id?: string | null;
  package_id?: string | null;
  created_at?: string;
  started_at?: string | null;
};
export type GuestNoteCategory = 'umum' | 'preferensi' | 'perhatian' | 'lainnya';
export const guestNoteCategories: Array<{ id: GuestNoteCategory; title: string }> = [
  { id: 'umum', title: 'Umum' },
  { id: 'preferensi', title: 'Preferensi' },
  { id: 'perhatian', title: 'Perhatian' },
  { id: 'lainnya', title: 'Lainnya' },
];
export const guestHistoryLabels: Record<string,string> = {
  full_name: 'Nama lengkap',
  address: 'Alamat',
  phone: 'Nomor WhatsApp',
};
export function guestVisitStatus(rows: GuestVisitRecord[]): string {
  if (rows.some(row => row.status === 'check_in')) return 'Sedang menginap';
  if (rows.some(row => row.status === 'booking')) return 'Ada booking';
  if (rows.some(row => row.status === 'check_out')) return 'Pernah menginap';
  return 'Belum ada kunjungan';
}
export function guestVisitOnly<T extends GuestVisitRecord>(rows:T[]):T[] {
  // A cancelled or future Booking does not count as a visit or preference.
  return rows.filter(row => row.status === 'check_in' || row.status === 'check_out');
}
export function guestAverageGroupSize(rows: GuestVisitRecord[]):number | null {
  const values=guestVisitOnly(rows).map(row=>row.guest_count).filter((n):n is number => typeof n==='number' && n>0);
  return values.length? Math.round(values.reduce((a,b)=>a+b,0)/values.length):null;
}
export function guestNoteType(note: {note_type?:string|null}): GuestNoteCategory {
  return guestNoteCategories.find(x=>x.id===note.note_type)?.id ?? 'umum';
}
