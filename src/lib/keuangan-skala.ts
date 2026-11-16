// Skala sumbu vertikal grafik arus kas: murni presentasi, tidak mengubah data.
export type SkalaSumbu = { ticks: number[]; domain: [number, number] };

const langkahBagus = (kasar: number): number => {
  const pangkat = Math.pow(10, Math.floor(Math.log10(kasar)));
  const pecahan = kasar / pangkat;
  const bagus = pecahan <= 1 ? 1 : pecahan <= 2 ? 2 : pecahan <= 2.5 ? 2.5 : pecahan <= 5 ? 5 : 10;
  return bagus * pangkat;
};

// Interval proporsional dari nilai tertinggi aktual, termasuk arus kas bersih negatif.
export function skalaArusKas(nilai: number[], jumlahGaris = 4): SkalaSumbu {
  const bersih = nilai.filter(v => Number.isFinite(v));
  if (!bersih.length) return { ticks: [0], domain: [0, 0] };
  const maks = Math.max(0, ...bersih);
  const min = Math.min(0, ...bersih);
  if (maks === 0 && min === 0) return { ticks: [0], domain: [0, 0] };
  const langkah = langkahBagus(Math.max(maks, -min) / jumlahGaris);
  const atas = Math.ceil(maks / langkah) * langkah;
  const bawah = Math.floor(min / langkah) * langkah;
  const ticks: number[] = [];
  for (let v = bawah; v <= atas + langkah / 2; v += langkah) ticks.push(Math.round(v));
  return { ticks, domain: [bawah, atas] };
}

// Label rupiah ringkas: Rp250 rb, Rp1 jt, negatif diawali tanda minus.
export function labelSkala(nilai: number): string {
  const tanda = nilai < 0 ? '-' : '';
  const absolut = Math.abs(nilai);
  if (absolut >= 1_000_000) {
    const jt = absolut / 1_000_000;
    return `${tanda}Rp${Number.isInteger(jt) ? jt : jt.toFixed(1).replace('.', ',')} jt`;
  }
  if (absolut >= 1_000) return `${tanda}Rp${Math.round(absolut / 1_000)} rb`;
  return `${tanda}Rp${absolut}`;
}
