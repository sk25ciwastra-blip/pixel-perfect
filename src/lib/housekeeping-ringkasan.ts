type Catatan = { action: string; created_at: string };
const tanggalWib = (value: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);

// Counts recorded completion events, not invented tasks or unique room inventory.
export function ringkasanHousekeeping(rows: Catatan[], now = new Date()) {
  const today = tanggalWib(now);
  const localDay = new Date(`${today}T00:00:00Z`);
  const weekStart = new Date(localDay);
  weekStart.setUTCDate(localDay.getUTCDate() - (localDay.getUTCDay() + 6) % 7);
  const week = weekStart.toISOString().slice(0, 10);
  const year = today.slice(0, 4);
  const month = today.slice(0, 7);
  const dates = rows.filter(row => row.action === 'finish_cleaning').map(row => tanggalWib(new Date(row.created_at))).filter(date => date <= today);
  return {
    hari: dates.filter(date => date === today).length,
    minggu: dates.filter(date => date >= week).length,
    bulan: dates.filter(date => date.startsWith(month)).length,
    tahun: year,
    grafik: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'].map((nama, index) => ({ nama, jumlah: dates.filter(date => date.startsWith(`${year}-${String(index + 1).padStart(2, '0')}`)).length })),
  };
}