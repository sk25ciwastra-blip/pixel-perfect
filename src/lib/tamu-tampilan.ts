export type KunjunganTamu = { guest_id: string; status: string; created_at: string; started_at: string | null };
export function kunjunganTamu<T extends KunjunganTamu>(rows: T[], id: string) {
  return rows.filter(row => row.guest_id === id && (row.status === 'check_in' || row.status === 'check_out'));
}
export function empatDigitWA(phone: string) { return phone.replace(/\D/g, '').slice(-4); }
export function urutTamu<T extends { id: string; full_name: string }>(rows: T[], transactions: KunjunganTamu[], order: 'nama' | 'terbanyak' | 'tersedikit') {
  const counts = new Map<string, number>();
  for (const row of transactions) if (row.status === 'check_in' || row.status === 'check_out') counts.set(row.guest_id, (counts.get(row.guest_id) ?? 0) + 1);
  return [...rows].sort((a, b) => {
    const difference = (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0);
    return (order === 'nama' ? 0 : order === 'terbanyak' ? difference : -difference) || a.full_name.localeCompare(b.full_name, 'id-ID') || a.id.localeCompare(b.id);
  });
}