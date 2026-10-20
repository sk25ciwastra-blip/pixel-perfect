export type ModeGrafik = "harian" | "mingguan" | "bulanan";

/** Skala sumbu grafik pendapatan (rupiah) sesuai permintaan Owner. */
export const skalaGrafik: Record<ModeGrafik, number[]> = {
  harian: [0, 1_000_000, 3_000_000, 6_000_000],
  mingguan: [0, 5_000_000, 10_000_000, 20_000_000],
  bulanan: [0, 40_000_000, 60_000_000, 100_000_000],
};

/** Posisi 0..1 pada sumbu dengan jarak garis bantu yang sama rata. */
export function posisiSkala(nilai: number, ticks: number[]): number {
  if (!(nilai > 0)) return 0;
  const n = ticks.length - 1;
  for (let i = 0; i < n; i += 1) {
    const bawah = ticks[i] ?? 0;
    const atas = ticks[i + 1] ?? bawah;
    if (nilai <= atas) {
      return (i + (nilai - bawah) / (atas - bawah || 1)) / n;
    }
  }
  return 1;
}

export function labelJuta(nilai: number) {
  return nilai === 0 ? "0" : `${nilai / 1_000_000}M`;
}

/** Tambah satu garis bantu bila data melebihi batas atas, agar batang tidak terpotong. */
export function skalaAdaptif(ticks: number[], maksimum: number): number[] {
  const atas = ticks[ticks.length - 1] ?? 0;
  if (maksimum <= atas) return ticks;
  return [...ticks, Math.ceil(maksimum / 1_000_000) * 1_000_000];
}
