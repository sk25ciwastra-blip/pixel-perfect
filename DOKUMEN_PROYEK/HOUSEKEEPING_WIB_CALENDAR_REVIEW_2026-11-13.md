# Perawatan Berkala — penyegaran kalender WIB

Base main: `f74851cb8454594911763d5a7d53ec4bf96d130a` setelah PR #54.
Checkpoint: https://github.com/sk25ciwastra-blip/pixel-perfect/issues/45#issuecomment-6855299473
Buku Induk/aturan HK dan review fungsi HK sebelumnya tetap berlaku.

## Perubahan tunggal

`useWibCalendarDate()` menyediakan tanggal reaktif Asia/Jakarta ke PerawatanBerkala.
`dueTasks` sekarang bergantung pada tasks **dan tanggal WIB**, sehingga kategori,
jumlah pekerjaan dan daftar kategori terpilih ikut dihitung ulang walau data historis
tidak berubah. JSX/desain, interval linen/fan/toilet, MENUNGGU AKSES, checkbox,
save callback dan RPC tidak diubah.

Watcher memiliki satu timeout menuju tengah malam WIB. Saat timeout terlambat
karena throttling/sleep, tanggal dibaca ulang dari jam saat itu, bukan ditambah satu.
Focus, pageshow dan visibilitychange ke visible juga menyinkronkan tanggal dan
menjadwalkan ulang satu timer. Event berulang dalam hari yang sama tidak menerbitkan
pembaruan tanggal. Cleanup membatalkan timer dan melepas semua listener; callback
yang sudah terantre tidak melakukan pembaruan setelah cleanup. Tidak ada polling
data, refresh tabel, RPC, atau perubahan data akibat pergantian tanggal.

Perhitungan tetap menggunakan **operational_date** terakhir dan selisih hari kalender,
bukan performed_at atau zona waktu lokal perangkat. Linen berinterval 2 hari:
hari pertama belum jatuh tempo, hari kedua jatuh tempo. Interval fan/toilet existing
tetap diteruskan apa adanya. Tidak ada riwayat atau tanggal kalender invalid dianggap
perlu perhatian/jatuh tempo, sehingga tidak diam-diam menghilangkan pekerjaan.
Tanggal mustahil seperti 30 Februari ditolak sebagai tanggal kalender, bukan dinormalisasi.
Tidak ada pencatatan tanggal penggantian baru secara otomatis.

## Pemeriksaan baru yang terdampak

PASS `node --test scripts/maintenance-calendar.test.cjs`: 5 tes terfokus:

1. 23:59 -> 00:00 WIB dan batas satu/dua hari linen.
2. Tab hidden/visible, focus/pageshow, resume setelah beberapa hari, tanpa event
   pembaruan tanggal berulang atau timer menumpuk.
3. Cleanup timer/listener, callback terlambat setelah cleanup dan remount.
4. Riwayat kosong/tanggal invalid, batas bulan/tahun/leap day dan interval fan/toilet.
5. Kode hook dan komponen actual dengan harness state/memo/effect terisolasi:
   data rows tetap sama; setelah rollover kategori Sprei muncul, jumlah mengikuti,
   daftar yang dipilih tetap mutakhir, occupied tetap MENUNGGU AKSES dengan checkbox
   disabled; tidak ada RPC/SDK access/refresh atau mutasi fixture. operational_date
   dan performed_at fixture sengaja berbeda untuk memeriksa sumber tanggal.

Test awal komponen gagal karena clock virtual belum disuntikkan ke hook (helper
sudah memakai clock virtual). Fixture diperbaiki; pemeriksaan akhir 5/5 PASS.
Harness bukan browser E2E atau bukti penyelesaian pekerjaan perawatan nyata.

PASS installed TypeScript `tsc --noEmit` dengan config sementara extends tsconfig.json,
include dua helper/hook baru dan perawatan-berkala.tsx, types vite/client,node.
Config sementara dibuang. PASS pemeriksaan diff/batas perubahan.
Suite HK/SQL/PDF/financial/layout yang sudah PASS tidak dijalankan ulang.

NOT REACHED: browser terautentikasi/sleep perangkat nyata, RPC/RLS Cloud dan
penggantian sprei fisik. Akurasi jam perangkat tetap menjadi asumsi yang sama
dengan implementasi sebelumnya; ini bukan sinkronisasi waktu server. Perbaikan
tidak memblokir READY atau mengubah status kamar/pembayaran.

Langkah berikut: review Owner, lalu smoke test browser tanggal/tab resume bila
diizinkan, tanpa membuat pekerjaan/data baru. Tidak ada SQL/migrasi, Cloud/DEMO,
flags, Lovable, merge, deploy atau publish.
