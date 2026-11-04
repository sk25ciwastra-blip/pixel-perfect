export function waktuWib(value: string | null) {
  if (!value) return '—';

  return new Date(value).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function tanggalWib(value: string | null) {
  if (!value) return '—';

  return new Date(value).toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function jamWib(value: string | null) {
  if (!value) return '—';

  return new Date(value).toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Durasi tetap berasal dari jadwal paket; actual checkout hanya mengisi
// timestamp Check-out dan tidak mengubah perhitungan durasi yang disetujui.
export function durasiWib(awal: string | null, akhir: string | null) {
  if (!awal || !akhir) return '—';

  const menit = Math.round((new Date(akhir).getTime() - new Date(awal).getTime()) / 60000);

  if (!Number.isFinite(menit) || menit < 0) return '—';

  const jam = Math.floor(menit / 60);

  if (jam === 0) return `${menit % 60} menit`;

  return `${jam} jam ${menit % 60} menit`;
}
