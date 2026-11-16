type Catatan = { action: string; created_at: string };
const tanggalWib = (value: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
const namaBulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];

const tanggalSelesai = (rows: Catatan[], now: Date) => {
  const today = tanggalWib(now);
  return rows.filter(row => row.action === 'finish_cleaning').map(row => tanggalWib(new Date(row.created_at))).filter(date => date <= today);
};

// Monthly counts of recorded completions for one calendar year (WIB).
export function grafikTahun(rows: Catatan[], tahun: string, now = new Date()) {
  const dates = tanggalSelesai(rows, now);
  return namaBulan.map((nama, index) => ({ nama, jumlah: dates.filter(date => date.startsWith(`${tahun}-${String(index + 1).padStart(2, '0')}`)).length }));
}

// Years that have recorded completions, always including the current WIB year.
export function tahunTersedia(rows: Catatan[], now = new Date()) {
  const set = new Set([tanggalWib(now).slice(0, 4), ...tanggalSelesai(rows, now).map(date => date.slice(0, 4))]);
  return [...set].sort((a, b) => b.localeCompare(a));
}

// Counts recorded completion events, not invented tasks or unique room inventory.
export function ringkasanHousekeeping(rows: Catatan[], now = new Date()) {
  const today = tanggalWib(now);
  const localDay = new Date(`${today}T00:00:00Z`);
  const weekStart = new Date(localDay);
  weekStart.setUTCDate(localDay.getUTCDate() - (localDay.getUTCDay() + 6) % 7);
  const week = weekStart.toISOString().slice(0, 10);
  const year = today.slice(0, 4);
  const month = today.slice(0, 7);
  const dates = tanggalSelesai(rows, now);
  return {
    hari: dates.filter(date => date === today).length,
    minggu: dates.filter(date => date >= week).length,
    bulan: dates.filter(date => date.startsWith(month)).length,
    tahun: year,
    grafik: grafikTahun(rows, year, now),
  };
}

type Riwayat = Catatan & { id: string; room_id: string; job_id: string | null; job_number: string | null; performed_by_name: string };
export type Pekerjaan = { id: string; roomId: string; petugas: string; mulai: string | null; selesai: string | null; durasiMenit: number | null; hasil: 'Selesai' | 'Dijadikan Siap' | 'Proses' };

// Pairs each recorded start with its finish (same job, or the open start of the same room for legacy rows).
export function riwayatPekerjaan(rows: Riwayat[], batas = 5): Pekerjaan[] {
  const jobs: Pekerjaan[] = [];
  const terbuka = new Map<string, Pekerjaan>();
  for (const row of [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const kunci = row.job_id ?? row.job_number ?? `kamar:${row.room_id}`;
    if (row.action === 'start_cleaning') {
      const job: Pekerjaan = { id: row.id, roomId: row.room_id, petugas: row.performed_by_name, mulai: row.created_at, selesai: null, durasiMenit: null, hasil: 'Proses' };
      jobs.push(job); terbuka.set(kunci, job); continue;
    }
    const job = terbuka.get(kunci) ?? (() => { const baru: Pekerjaan = { id: row.id, roomId: row.room_id, petugas: row.performed_by_name, mulai: null, selesai: null, durasiMenit: null, hasil: 'Proses' }; jobs.push(baru); return baru; })();
    terbuka.delete(kunci);
    job.selesai = row.created_at;
    job.petugas = row.performed_by_name || job.petugas;
    job.hasil = row.action === 'finish_cleaning' ? 'Selesai' : 'Dijadikan Siap';
    job.durasiMenit = job.mulai ? Math.max(0, Math.round((new Date(row.created_at).getTime() - new Date(job.mulai).getTime()) / 60000)) : null;
  }
  return jobs.sort((a, b) => (b.selesai ?? b.mulai ?? '').localeCompare(a.selesai ?? a.mulai ?? '')).slice(0, batas);
}

export const formatDurasi = (menit: number | null) => menit === null ? '—' : menit < 60 ? `${menit} menit` : `${Math.floor(menit / 60)} jam${menit % 60 ? ` ${menit % 60} menit` : ''}`;
