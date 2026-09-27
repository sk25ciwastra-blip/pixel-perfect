export type StatusKamar = "siap" | "terisi" | "perlu" | "sedang";

export const labelStatusKamar: Record<StatusKamar, string> = {
  siap: "Siap",
  terisi: "Terisi",
  perlu: "Perlu Dibersihkan",
  sedang: "Sedang Dibersihkan",
};

export const kamar: {
  nomor: string;
  tipe: string;
  status: StatusKamar;
  tamu?: string;
}[] = [
  { nomor: "101", tipe: "Standar", status: "siap" },
  { nomor: "102", tipe: "Standar", status: "terisi", tamu: "Andi Saputra" },
  { nomor: "103", tipe: "Deluxe", status: "perlu" },
  { nomor: "201", tipe: "Deluxe", status: "sedang" },
  { nomor: "202", tipe: "Family", status: "terisi", tamu: "Keluarga Wibowo" },
  { nomor: "203", tipe: "Family", status: "siap" },
];

export const booking = [
  {
    kode: "TRX-0431",
    tamu: "Andi Saputra",
    kamar: "102",
    tanggal: "27 Sep 2026",
    status: "Check-in",
  },
  {
    kode: "TRX-0432",
    tamu: "Keluarga Wibowo",
    kamar: "202",
    tanggal: "27 Sep 2026",
    status: "Check-in",
  },
  {
    kode: "TRX-0433",
    tamu: "Siti Nurhaliza",
    kamar: "203",
    tanggal: "28 Sep 2026",
    status: "Menunggu",
  },
  {
    kode: "TRX-0434",
    tamu: "Dimas Prakoso",
    kamar: "101",
    tanggal: "29 Sep 2026",
    status: "Menunggu",
  },
];

export const transaksi = [
  {
    kode: "TRX-0431",
    tamu: "Andi Saputra",
    metode: "QRIS",
    jumlah: 350000,
    tanggal: "27 Sep 2026",
    status: "Lunas",
  },
  {
    kode: "TRX-0432",
    tamu: "Keluarga Wibowo",
    metode: "Transfer Bank",
    jumlah: 620000,
    tanggal: "27 Sep 2026",
    status: "Lunas",
  },
  {
    kode: "TRX-0430",
    tamu: "Rahmat Hidayat",
    metode: "Cash",
    jumlah: 300000,
    tanggal: "26 Sep 2026",
    status: "Menunggu Persetujuan",
  },
];

export const tamu = [
  { nama: "Andi Saputra", telepon: "0812-3456-7890", kunjungan: 3 },
  { nama: "Keluarga Wibowo", telepon: "0813-2222-1010", kunjungan: 1 },
  { nama: "Siti Nurhaliza", telepon: "0857-9090-4321", kunjungan: 2 },
  { nama: "Dimas Prakoso", telepon: "0878-1234-5566", kunjungan: 1 },
];

export const karyawan = [
  { nama: "Rina Lestari", id: "KR-01", pin: "••••", posisi: "Receptionist", aktif: true },
  { nama: "Joko Susilo", id: "KR-02", pin: "••••", posisi: "Housekeeping", aktif: true },
  { nama: "Nia Ramadhani", id: "KR-03", pin: "••••", posisi: "Receptionist", aktif: false },
];

export function rupiah(nilai: number) {
  return "Rp " + nilai.toLocaleString("id-ID");
}
