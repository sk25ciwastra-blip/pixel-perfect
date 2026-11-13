# Housekeeping menuju Operasional Sementara — satu gap daftar

Base main: `d72fe6ab58044d8f02003540987c8c7b1a4b50d2`.
Checkpoint Owner: https://github.com/sk25ciwastra-blip/pixel-perfect/issues/45#issuecomment-6854430659

Dokumen resmi yang dibaca: Buku Induk, Aturan Bisnis, Status Fitur, riwayat terkait
dan paket kesiapan lokal 12 November. Status lama di dokumen bukan bukti runtime
Cloud terbaru. Keputusan terbaru Owner menjadi acuan; tes HK lama tidak diulang.

## Inventaris sebelum perubahan

1. **FAIL statis daftar:** Status Housekeeping memiliki bagian dirty, needs_action
   (READY dengan kekurangan), cleaning dan ready; occupied tidak masuk bagian mana pun.
   Ini berlawanan dengan daftar TERISI/KOTOR yang diminta Owner.
2. **Sudah ada, tidak dibangun ulang:** checklist wajib dijawab dan alasan kekurangan
   disimpan melalui complete_housekeeping_checklist. Migrasi HK resmi 14000 mengisi
   hasil needs_action tetapi tetap menyelesaikan cleaning menjadi ready. Halaman
   Room sudah menyediakan indikator/detail kekurangan dari checklist resmi.
   Tidak ada perubahan RPC, checklist, izin READY atau form pemesanan dalam PR ini.
3. **Interval sprei sudah ada:** PerawatanBerkala menetapkan linen 2 hari, memakai
   operational_date dan tanggal kalender Asia/Jakarta. Tidak ada riwayat dianggap
   jatuh tempo. Tidak diubah atau diuji ulang sebagai fitur baru.
   **Gap berikut:** dueTasks hanya useMemo berdasarkan tasks; halaman yang terbuka
   melewati tengah malam tanpa data baru dapat mempertahankan daftar jatuh tempo lama.

Paket kesiapan mencatat Housekeeping PostgreSQL 16 assertion PASS dan HK-11 pure
PASS. Bukti tersebut dipertahankan, bukan dijalankan ulang atau diklaim Cloud PASS.

## Perbaikan tunggal yang dipilih

Cakupan daftar operasional Status diperbaiki dengan helper pure:

- Hanya active occupied dan dirty; READY, READY needs_action, inactive dan status
  tak dikenal tidak menjadi baris daftar Status.
- Status TERISI tetap status TERISI, tidak diganti menjadi Perlu Tindakan karena
  kekurangan. Informasi kekurangan dari checklist terakhir dapat dibuka lewat details.
- READY dengan kekurangan tidak dimasukkan kembali ke daftar; indikator/detail
  READY tetap tersedia di Room melalui jalur existing yang tidak diedit.
- Pekerjaan yang telah dimulai tetap memakai status teknis cleaning dan tersedia
  di tab **Checklist** existing. Ini antrean pekerjaan berjalan, terpisah dari daftar
  Status TERISI/KOTOR. Setelah selesai menjadi READY, baris hilang dari kedua antrean.
  Pesan sukses mulai membersihkan mengarahkan petugas ke tab Checklist.
- Tombol Jadikan Siap dibatasi pada dirty/cleaning; tidak muncul pada occupied
  yang kini masuk daftar. RPC dan izin server existing tetap otoritas akhir.

Tidak ada perubahan state machine dirty -> cleaning -> ready atau nomor pekerjaan.
Pengecualian Room 01, pencarian nomor kamar/TRX/HK, riwayat, kartu ringkasan,
tab perawatan, kerangka dan kelas desain global tetap. Tidak ada desain ulang.

## Pemeriksaan

- PASS `node --test scripts/housekeeping-queue.test.cjs`: 4 tes terfokus baru.
  Memeriksa seleksi status/active, kekurangan bukan gate, render route Status dengan
  mock data, escaping informasi kekurangan, tanpa tombol override occupied,
  pekerjaan cleaning tetap punya jalur selesai di Checklist, READY hilang dan
  batas tombol housekeeping/inspector tetap. Semua SDK/RPC dimock agar gagal bila
  dipanggil; data fixture tidak dimutasi. SSR route bukan browser E2E.
- PASS installed TypeScript `tsc --noEmit` dengan config sementara extends
  tsconfig.json, include helper, route Housekeeping dan routeTree.gen.ts; config
  dibuang. Deklarasi route generator diperlukan untuk typecheck route yang benar.
- PASS diff scope/check; tidak ada edit SQL, perawatan/checklist existing,
  Room, styles global, finansial, DEMO atau flags.

NOT REACHED: browser interaktif, klik/penyimpanan kerja HK nyata, kontrak RPC/RLS
Cloud terbaru dan kepatuhan pergantian sprei di lapangan. Tidak ada transaksi atau
pekerjaan HK dibuat. PDF role tests tetap ditunda sesuai keputusan Owner.

## Pekerjaan berikutnya

Perbaikan fungsi terisolasi berikut yang direkomendasikan adalah penyegaran tanggal
WIB pada antrean Perawatan Berkala ketika berganti hari atau tab kembali aktif,
agar jatuh tempo sprei 2 hari tidak bergantung pada reload/data baru. Pertahankan
aturan kalender dan pencatatan existing; jangan menambah blokir penggunaan kamar.
Perlu tes batas tengah malam, umur satu/dua hari, serta riwayat tidak tersedia atau
tanggal tidak valid. Itu belum dikerjakan dalam PR daftar ini.

Hanya branch/PR review; tidak ada Cloud SQL/DEMO/flags, merge, deploy, publish
atau penggunaan Lovable.
