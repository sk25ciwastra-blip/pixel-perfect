// Urutan tampilan dropdown pada form Check-in: tipe kamar lalu paket.
// Murni presentasi: tidak mengubah data, harga, atau aturan bisnis.

const URUTAN_TIPE = ['standard', 'superior a', 'superior b', 'deluxe'];

export function urutanTipeKamar(nama: string, indeks = 0): number {
  const n = nama.trim().toLowerCase().replace(/\s+/g, ' ');
  const posisi = URUTAN_TIPE.indexOf(n);
  return posisi >= 0 ? posisi : URUTAN_TIPE.length + indeks;
}

export function tipeKamarTerurut<T extends { name: string }>(types: T[]): T[] {
  return types
    .map((type, indeks) => ({ type, indeks }))
    .sort((a, b) => urutanTipeKamar(a.type.name, a.indeks) - urutanTipeKamar(b.type.name, b.indeks))
    .map(entry => entry.type);
}

export function urutanPaket(nama: string): number {
  const n = nama.toLowerCase();
  const jam = n.match(/(\d+)\s*jam/);
  if (jam) return Number(jam[1]);
  if (n.includes('pagi')) return 100;
  if (n.includes('malam')) return 101;
  if (n.includes('harian')) return 102;
  if (n.includes('minggu')) return 103;
  return 200;
}

export function paketTerurut<T extends { name: string; active: boolean }>(packages: T[]): T[] {
  return packages
    .filter(pack => pack.active)
    .sort((a, b) => urutanPaket(a.name) - urutanPaket(b.name));
}
