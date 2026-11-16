export function tanggalLaporan(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = (name: string) => parts.find(p => p.type === name)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function rentangLaporan(hari: number, kini = new Date().toISOString()) {
  const akhir = tanggalLaporan(kini);
  const awal = new Date(`${akhir}T00:00:00Z`);
  awal.setUTCDate(awal.getUTCDate() - Math.max(0, hari - 1));
  return { awal: awal.toISOString().slice(0, 10), akhir };
}

export function dalamPeriode(iso: string, rentang: { awal: string; akhir: string }) {
  const tanggal = tanggalLaporan(iso);
  return Boolean(tanggal) && tanggal >= rentang.awal && tanggal <= rentang.akhir;
}