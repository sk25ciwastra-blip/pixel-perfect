export type StatusKamar = "siap" | "terisi" | "perlu" | "sedang";

export const labelStatusKamar: Record<StatusKamar, string> = {
  siap: "Siap",
  terisi: "Terisi",
  perlu: "Perlu Dibersihkan",
  sedang: "Sedang Dibersihkan",
};

export type Kamar = {
  nomor: string;
  tipe: string;
  status: StatusKamar;
  tamu?: string;
  paket?: string;
  sisa?: string;
  sisaMenit?: number;
  selesai?: string;
};

export const kamar: Kamar[] = [
  { nomor: "101", tipe: "Standar", status: "siap" },
  { nomor: "102", tipe: "Standar", status: "terisi", tamu: "Budi", paket: "Paket 4 Jam", sisa: "01:42:18", sisaMenit: 102, selesai: "23:15" },
  { nomor: "103", tipe: "Deluxe", status: "perlu" },
  { nomor: "104", tipe: "Standar", status: "terisi", tamu: "Andi Saputra", paket: "Paket 2 Jam", sisa: "00:18:05", sisaMenit: 18, selesai: "21:59" },
  { nomor: "201", tipe: "Deluxe", status: "sedang" },
  { nomor: "202", tipe: "Family", status: "terisi", tamu: "Keluarga Wibowo", paket: "Paket 24 Jam", sisa: "15:10:40", sisaMenit: 910, selesai: "13:52" },
  { nomor: "203", tipe: "Family", status: "siap" },
  { nomor: "204", tipe: "Deluxe", status: "perlu" },
];

export type StatusBooking = "Booking" | "Check-in" | "Check-out" | "Dibatalkan";

export const booking: {
  kode: string;
  tamu: string;
  kamar: string;
  tanggal: string;
  jam: string;
  status: StatusBooking;
}[] = [
  { kode: "BTRD25-000431", tamu: "Andi Saputra", kamar: "104", tanggal: "27 Sep 2026", jam: "19:59", status: "Check-in" },
  { kode: "BTRD25-000432", tamu: "Budi", kamar: "102", tanggal: "27 Sep 2026", jam: "19:15", status: "Check-in" },
  { kode: "BTRD25-000433", tamu: "Siti Nurhaliza", kamar: "203", tanggal: "27 Sep 2026", jam: "23:30", status: "Booking" },
  { kode: "BTRD25-000434", tamu: "Dimas Prakoso", kamar: "101", tanggal: "28 Sep 2026", jam: "10:00", status: "Booking" },
  { kode: "BTRD25-000429", tamu: "Rahmat Hidayat", kamar: "103", tanggal: "27 Sep 2026", jam: "14:00", status: "Check-out" },
  { kode: "BTRD25-000428", tamu: "Lina Marlina", kamar: "201", tanggal: "26 Sep 2026", jam: "20:00", status: "Dibatalkan" },
];

export const transaksi = [
  { kode: "BTRD25-000432", tamu: "Budi", kamar: "102", metode: "QRIS", jumlah: 150000, tanggal: "27 Sep 2026", status: "Lunas" },
  { kode: "BTRD25-000431", tamu: "Andi Saputra", kamar: "104", metode: "Transfer", jumlah: 90000, tanggal: "27 Sep 2026", status: "Lunas" },
  { kode: "BTRD25-000430", tamu: "Keluarga Wibowo", kamar: "202", metode: "Cash", jumlah: 450000, tanggal: "27 Sep 2026", status: "Menunggu Persetujuan" },
  { kode: "BTRD25-000429", tamu: "Rahmat Hidayat", kamar: "103", metode: "Cash", jumlah: 300000, tanggal: "26 Sep 2026", status: "Lunas" },
  { kode: "BTRD25-000428", tamu: "Lina Marlina", kamar: "201", metode: "Transfer", jumlah: 150000, tanggal: "26 Sep 2026", status: "Refund" },
];

export const tamu = [
  { nama: "Andi Saputra", telepon: "0812-3456-7890", terakhir: "27 Sep 2026" },
  { nama: "Budi", telepon: "0813-2222-1010", terakhir: "27 Sep 2026" },
  { nama: "Keluarga Wibowo", telepon: "0815-7788-9900", terakhir: "27 Sep 2026" },
  { nama: "Siti Nurhaliza", telepon: "0857-9090-4321", terakhir: "12 Agu 2026" },
  { nama: "Dimas Prakoso", telepon: "0878-1234-5566", terakhir: "3 Jul 2026" },
];

export const karyawan = [
  { nama: "Rina Lestari", id: "KR-01", posisi: "Receptionist", aktif: true },
  { nama: "Joko Susilo", id: "KR-02", posisi: "Housekeeping", aktif: true },
  { nama: "Nia Ramadhani", id: "KR-03", posisi: "Receptionist", aktif: false },
];

/** Contoh tampilan saja — bukan aturan harga. */
export const paketContoh = [
  { nama: "Paket 2 Jam", durasi: "2 jam", harga: 90000 },
  { nama: "Paket 4 Jam", durasi: "4 jam", harga: 150000 },
  { nama: "Paket 6 Jam", durasi: "6 jam", harga: 200000 },
  { nama: "Paket 12 Jam", durasi: "12 jam", harga: 300000 },
  { nama: "Paket 24 Jam", durasi: "24 jam", harga: 450000 },
];

export function rupiah(nilai: number) {
  return "Rp " + nilai.toLocaleString("id-ID");
}
