# Baturaden 25 Homestay — Checkpoint Transisi Data DEMO → Operasional Nyata
**Tanggal pemeriksaan:** 22 November 2026 WIB  
**Sumber:** GitHub PR #101 (implementasi Arsip DEMO `48ae83e` sebelum checkpoint ini) dan Lovable Cloud PostgreSQL (SELECT-only).  
**Status:** RENCANA/GATE; **NO-GO aktivasi**. Tidak ada operasi mutasi Cloud, SQL migrasi, arsip, closing, refund, merge, deploy, atau publish yang dilakukan saat membuat checkpoint ini.

## A. Batas dan keputusan Owner yang sudah ada

1. Owner secara eksplisit mengonfirmasi **8 transaksi `check_out`** di bagian B sebagai DEMO pada 22 November 2026. Keputusan itu **hanya klasifikasi**; belum memberi izin menerapkan migrasi Cloud, memasukkan approval ke database, atau mengarsipkan data.
2. Transaksi aktif lainnya **belum termasuk persetujuan 8 transaksi per-nomor**. Status `booking` dan `check_in` dilindungi RPC; jangan mengarsipkan, memanipulasi status via SQL, menghapus pembayaran, atau melakukan pembatalan/refund/checkout tanpa keputusan dan prosedur operasional yang sesuai.
3. Aturan Owner tetap berlaku: closing kas boleh minus dan tidak ada fitur/talangan pribadi; histori closing FINAL tidak boleh ditulis ulang; identitas TRX, pembayaran, komisi, struk, audit dan bukti HK harus dipertahankan.
4. Kode fungsi/RPC dan tes tetap dikerjakan Codex, visual Lovable. Jangan mengulang suite lama yang sudah PASS. Rencana ini tidak mengubah prioritas operasional menjadi proyek tambahan yang tidak kritis.

## B. Persetujuan klasifikasi: tepat 8 transaksi historis (read-only cocok ulang)

| Nomor TRX | UUID Lovable (dicocokkan read-only) | Status | Pembayaran |
|---|---|---|---:|
| BTRD25-000002 | `5617455d-c6d4-4b73-99ca-ef30a8ee5a00` | check_out | 1 |
| BTRD25-000004 | `e72fc83d-d18f-4064-bf03-86a50de27d90` | check_out | 1 |
| BTRD25-000008 | `d6b35607-0a71-48e8-acd5-1b30de344c36` | check_out | 2 |
| BTRD25-000018 | `37aecc2d-f414-46b9-839c-d3beedc3142a` | check_out | 1 |
| BTRDTRX-000026 | `8a44b799-30e9-4a7a-bcc1-d4f9ec1fb4f3` | check_out | 1 |
| BTRDTRX-000027 | `0ff660a1-9d61-4021-ae68-28a7a23df9c2` | check_out | 2 |
| BTRDTRX-000028 | `bbe16673-ac9d-4672-a758-6098dcd08134` | check_out | 2 |
| BTRDTRX-000029 | `1c8a9e0a-e2f9-4cc5-b273-449eb97e22c1` | check_out | 1 |

**Snapshot terkait 8 TRX, bukan instruksi perubahan saldo:** 11 baris pembayaran = **Rp820.000**, jumlah price_snapshot = **Rp820.000**, komisi snapshot pada pembayaran = **Rp22.000**; Housekeeping: 12 history, 6 checklists, 5 jobs; refund 0; official payment receipts 0. Dua TRX (`000028`, `000029`) terhubung ke pembayaran sesi kas FINAL; dua TRX (`000026`, `000027`) ke sesi kas OPEN. Jangan menyamakan belum ada struk resmi dengan tidak adanya bukti pembayaran.

## C. 9 transaksi masih aktif: inventaris, **belum diizinkan untuk arsip**

| Nomor | Status saat pemeriksaan | Pembayaran | Nilai pembayaran | Catatan |
|---|---|---:|---:|---|
| BTRD25-000006 | booking | 2 | Rp100.000 | Jadwal check-in belum ada |
| BTRD25-000010 | booking | 1 | Rp10.000 | Jadwal 7 Okt 2026 |
| BTRD25-000012 | booking | 1 | Rp10.000 | Jadwal **24 Des 2026**, di masa depan saat pemeriksaan |
| BTRD25-000014 | booking | 1 | Rp70.000 | Jadwal 12 Okt 2026 |
| BTRD25-000016 | booking | 1 | Rp70.000 | Jadwal 12 Okt 2026 |
| BTRDTRX-000021 | booking | 1 | Rp56.000 | Jadwal 5 Nov 2026 |
| BTRD25-000019 | check_in | 2 | Rp70.000 | Belum checkout |
| BTRDTRX-000020 | check_in | 2 | Rp70.000 | Belum checkout |
| BTRDTRX-000025 | check_in | 2 | Rp80.000 | Belum checkout |

Total aktif: **9 TRX, 13 pembayaran, Rp536.000**. Ini hanya inventaris. Semua transaksi bertanda aktif wajib mendapat keputusan penanganan sendiri; jangan memaksakan `check_out` atau `cancelled` lewat SQL demi masuk allowlist.

**Khusus booking 24 Desember:** jangan dianggap kedaluwarsa atau dibatalkan otomatis. Lakukan verifikasi klasifikasi dan jadwal sebelum tindakan apa pun.

## D. 3 sesi kas berstatus OPEN (read-only)

| Tanggal operasional | Identitas yang terhubung | Pembayaran tercatat | Kondisi |
|---|---|---:|---|
| 21 Oktober 2026 | `opened_by` tidak cocok dengan baris `public.employees`; **belum tentu akun orphan**, perlu identifikasi role melalui prosedur terbatas | **10 pembayaran, Rp436.000** | Sebanyak **Rp160.000** dari 2 TRX di bagian B; **Rp276.000** dari transaksi lain |
| 5 November 2026 | `QA-RCP-01` (Receptionist) | **0 pembayaran, Rp0** | Tetap OPEN meski tanpa pembayaran |
| 21 November 2026 | **`B25EMP-002` (Receptionist)** | **0 pembayaran, Rp0** | **Jangan ditutup otomatis**; akun karyawan operasional yang dipersiapkan |

Arsip metadata DEMO **tidak boleh mengubah** nominal sesi kas tersebut, closing/snapshot FINAL, atau jejak pembayaran. Sesi OPEN dengan Rp0 tidak otomatis layak ditutup: cek tanggung jawab petugas, handover, dan prosedur closing yang benar. Tidak ada `UPDATE status='FINAL'` manual.

## E. Gate bertahap menuju transaksi nyata

1. **Gate 0 — baseline data (SELESAI read-only):** inventaris semua 17 TRX dan semua 3 sesi OPEN; klasifikasi Owner disahkan hanya untuk 8 TRX di bagian B. Snapshot total 24 pembayaran = **Rp1.356.000** seluruh transaksi; angka ini masih mencampur aktivitas pengujian dan tidak boleh diberi label pendapatan LIVE.
2. **Gate 1 — review deployment/migrasi (PENDING):** PR #101 harus melalui pemeriksaan kontrak Auth/RLS/trigger/Realtime aktual Lovable, backup + bukti restore, dan browser end-to-end menggunakan fixture terisolasi. Preview Lovable terakhir masih di commit `bdabf17`, sementara kode PR Arsip DEMO di `48ae83e` sebelum checkpoint ini. Tidak boleh menyebut browser PASS tanpa menjalankannya.
3. **Gate 2 — penanganan 9 TRX aktif (PENDING):** Owner menetapkan status DEMO/LIVE per-nomor, lalu operator menangani Booking/Check-in dengan alur resmi dan audit. Booking masa depan tidak boleh otomatis dianggap tidak berlaku.
4. **Gate 3 — rekonsiliasi 3 sesi OPEN (PENDING):** identifikasi penanggung jawab aktual, verifikasi pembayaran/serah-terima, selesaikan closing melalui fungsi resmi bila diizinkan dan layak. Sesi kas `B25EMP-002` harus dievaluasi dengan pemilik sesi yang sah. FINAL yang sudah ada tetap immutable; tidak ada talangan pribadi.
5. **Gate 4 — pelaksanaan arsip (BELUM DIIZINKAN):** setelah approval **terpisah** untuk migrasi Cloud dan daftar izin privat, review ulang UUID+nomor+status ke-8 TRX di bagian B, baru proses masing-masing via RPC Owner dengan konfirmasi persis dan audit. **Bukan** mass-update SQL, bukan otomatis menjalankan seluruh 8.
6. **Gate 5 — pembuktian kesiapan (PENDING):** uji nyata Login Owner/Receptionist/Supervisor sesuai role, Booking → Check-in → pembayaran → Checkout → HK → READY, pembacaan Laporan/Keuangan/struk serta saldo, tanpa duplikasi TRX atau transaksi silang. Status GO hanya setelah hasil aktual di Lovable Cloud dibuktikan.

## F. Cara memahami dashboard dan laporan

- Halaman operasional dapat menyembunyikan TRX yang sudah diarsipkan, tetapi **Keuangan dan Laporan historis tetap memuat pembayaran, komisi, refund, dan closing**; penanda Arsip DEMO harus terlihat.
- Sebelum menerima data riil, **pisahkan KPI DEMO dan LIVE** untuk tujuan analisis bisnis secara jelas; jangan menghapus/merubah ledger sejarah hanya untuk membuat grafik terlihat nol.
- Jika angka sesudah uji tidak cocok dengan snapshot atau schema Cloud tidak cocok dengan migrasi, **STOP/NO-GO** dan selesaikan gap. Jangan lakukan “reset semua” tanpa review dependensi.

## G. Catatan bukti dan pembatasan

- Referensi: [PR #101](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/101); [konfirmasi Owner 8 DEMO](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/101#issuecomment-7075086923); [preflight katalog](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/101#issuecomment-7075009315); [rekonsiliasi kas awal](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/101#issuecomment-7075139087).
- Semua query pada checkpoint ini **SELECT-only**. Data bersifat snapshot per 22 November; hitungan status bisa berubah jika pengguna lain mengoperasikan sistem.
- Tidak ada kredensial, HP, nama tamu, NIK, atau data sensitif lain yang disalin ke dokumen.
- **Persentase cakupan inventaris:** 17/17 transaksi dan 3/3 sesi OPEN terpetakan; **bukan** persen kesiapan operasional. Aktivasi Cloud tetap **NO-GO**.

## H. Pemetaan hambatan kamar dan fungsi backend (tambahan SELECT-only, 22 November 2026)

Pemeriksaan aktual `public.transactions` JOIN `public.rooms`, tanpa membuka informasi identitas tamu, mengonfirmasi **3 kamar status `occupied`** yang tetap mengacu pada CHECK-IN lama:

| Kamar | TRX CHECK-IN | Mulai aktual WIB | Batas tercatat WIB | Status kamar |
|---|---|---|---|---|
| 03 | `BTRDTRX-000025` | 12 Nov 2026 07.13 | 12 Nov 2026 08.58 | occupied |
| 06 | `BTRD25-000019` | 22 Okt 2026 16.45 | 22 Okt 2026 18.45 | occupied |
| 07 | `BTRDTRX-000020` | 22 Okt 2026 16.46 | 22 Okt 2026 18.46 | occupied |

**Konsekuensi:** kamar 03, 06 dan 07 berpotensi tidak tersedia pada alur Check-in baru. Jangan paksa menjadi READY. Status hanya boleh berubah melalui penanganan tamu yang dipastikan selesai, **Check-out resmi → Housekeeping → READY** sesuai guard backend, dengan catatan audit yang benar. Tidak ada transaksi check-in baru, checkout, atau housekeeping yang dijalankan pada pemeriksaan.

Enam BOOKING yang masih aktif berada di kamar: **05** (`BTRD25-000006`, tanpa jadwal), **06** (`BTRD25-000014`), **08** (`BTRD25-000010`, `BTRD25-000016`), dan **09** (`BTRD25-000012`, `BTRDTRX-000021`). Kamar 06 memiliki satu booking lama selain satu CHECK-IN aktif; ini bukan bukti jadwal overlap, tetapi perlu resolusi kedua identitas secara terpisah. **Booking 24 Desember** pada kamar 09 tidak boleh dibatalkan berdasar tanggal pembuatan lama.

Berdasarkan inspeksi katalog fungsi Lovable, `public.check_out_transaction(uuid)` tersedia dan mewajibkan status `check_in` serta kamar `occupied`; prosedur mengubah transaksi menjadi `check_out` dan kamar menjadi **`dirty`**, bukan READY. Fungsi `close_finance_cash_session(uuid,jsonb,text)` tersedia dan memvalidasi otoritas operator, alokasi kas, transfer serta snapshot sebelum `FINAL`. Tidak ditemukan RPC bernama mengandung `cancel` pada katalog publik saat pemeriksaan; **ini tidak membuktikan ketiadaan jalur pembatalan lain**. Lakukan review jalur resmi Booking sebelum menetapkan cara menutup enam booking berbayar; jangan gunakan checkout palsu atau UPDATE status langsung.

## I. Klarifikasi identitas sesi kas 21 Oktober (tambahan SELECT-only)

Sesi kas OPEN tanggal **21 Okt 2026** yang tidak cocok dengan `public.employees` **BUKAN akun Auth hilang**: `auth.users` terkait **masih ada** dan `user_roles` menunjukkan **role Owner**. Akun memang tidak memiliki profil karyawan. Sesi itu memiliki pembayaran **Rp98.000 Cash + Rp338.000 QRIS = Rp436.000**, saldo awal `Rp0`. Perlu rekonsiliasi dan keputusan Owner sebelum closing melalui RPC yang benar; jangan menganggap akun tersebut orphan atau menulis ulang finance. Dua sesi OPEN lain adalah `QA-RCP-01` dan `B25EMP-002`, masing-masing pembayaran Rp0 pada snapshot ini.

**Batas keputusan tetap:** 8 transaksi selesai yang sudah dikonfirmasi DEMO boleh dipersiapkan untuk proses arsip mendatang, bukan otomatis diarsipkan; 9 transaksi aktif belum termasuk daftar approval per-UUID dan memerlukan penyelesaian alur resmi. Semua temuan ini hanya pemetaan, **tidak mengubah data Cloud dan tidak mengubah status NO-GO**.


## J. Gate resolusi transaksi aktif: checkout ≠ pembatalan Booking (SELECT-only, 22 Nov 2026)

**Bukti kontrak Cloud + source PR #101:**
- 6 `booking` dengan **7 pembayaran sejumlah Rp316.000** (1 booking dijadwalkan ke depan: 24 Des 2026; 1 tanpa jadwal): `BTRD25-000006`, `BTRD25-000010`, `BTRD25-000012`, `BTRD25-000014`, `BTRD25-000016`, `BTRDTRX-000021`.
- 3 `check_in` dengan **6 pembayaran sejumlah Rp220.000**, kamar `03`, `06`, `07`: `BTRDTRX-000025`, `BTRD25-000019`, `BTRDTRX-000020`.
- Katalog `pg_proc` pada schema `public` ditemukan `check_out_transaction(uuid)` serta wrapper Training. **Tidak ditemukan RPC resmi cancel booking.** Pencarian definisi fungsi `public` yang memuat literal `cancelled` hanya menghasilkan `record_transaction_payment(uuid,numeric,text,uuid,uuid)`, yang **melarang pembayaran bila transaksi sudah dibatalkan**, bukan menjalankan pembatalan. `src/routes/booking.tsx` dan `src/components/detail-transaksi.tsx` pada PR #101 juga tidak menyediakan aksi pembatalan Booking; teks `Batal` yang ada menutup dialog, bukan membatalkan transaksi. Enum transaksi memang mendukung `cancelled`, tetapi ketersediaan enum bukan bukti operasional.
- Tidak ada policy `UPDATE` ke tabel `transactions` untuk role aplikasi; ini **bukan alasan** membuka akses UPDATE langsung. Jalur transaksi hanya boleh lewat RPC tervalidasi dan audit.

**Keputusan gate:**
1. Jalur Checkout 3 CHECK-IN dapat diinspeksi/diuji lewat fungsi resmi setelah verifikasi kamar nyata kosong dan persetujuan transaksi; fungsi mengubah kamar menjadi `dirty`, bukan READY. Housekeeping tetap wajib, tidak ada otomatisasi snapshot yang menghilangkan tunggakan.
2. **6 Booking berbayar BLOCKED oleh kebutuhan alur pembatalan yang aman.** Jangan membuat check-in palsu agar bisa checkout/arsip. Prioritaskan [Issue #102 — pembatalan Booking berbayar](https://github.com/sk25ciwastra-blip/pixel-perfect/issues/102) sebagai gap fungsi operasional terpisah dari PR #101.
3. **Kebijakan Owner yang telah disahkan 14 Nov 2026:** pembayaran Booking yang sudah diterima tidak dapat dibatalkan atau dikembalikan dengan alasan apa pun. Karena itu, pembatalan administratif tidak boleh memanggil refund atau membatalkan pembayaran. Penyesuaian jadwal memerlukan konfirmasi paling lambat **2 jam sebelum waktu check-in terjadwal** (koreksi Owner 22 Nov 2026); bukan pembatalan otomatis. Jangan menulis ulang closing FINAL, mereset saldo sesi OPEN, menganggap jadwal masa depan batal, atau mengubah komisi. Kebijakan ini tercatat kembali sebagai `AB-BOOK-006/007` dan pada Issue #102.
4. Status 9 aktif **tidak otomatis menjadi eligible untuk Arsip DEMO** meskipun seluruhnya data pengujian: arsip membutuhkan status historis sesuai guard, klasifikasi per UUID/nomor, dan izin Cloud yang terpisah.

**Checkpoint:** gap fungsi `cancel booking` teridentifikasi secara spesifik; tidak ada mutasi, **NO-GO** tetap.


## K. Sinkronisasi keputusan Owner tentang pembatalan Booking — 22 Nov 2026

Dalam penelusuran keputusan Owner, ditemukan aturan yang sudah disetujui pada **14 Nov 2026** dalam konteks Booking WhatsApp: **pembayaran Booking yang sudah diterima tidak dapat dibatalkan maupun dikembalikan dengan alasan apa pun**; ketentuan perubahan jadwal sebelumnya tertulis 3 jam, **dikoreksi Owner pada 22 Nov 2026 menjadi paling lambat 2 jam sebelum waktu check-in terjadwal**. Ketentuan non-refundable telah disinkronkan dan batas waktu perubahan jadwal dikoreksi berdasarkan keputusan Owner terbaru pada 22 Nov 2026 di `02_ATURAN_BISNIS.md` sebagai **AB-BOOK-006** dan **AB-BOOK-007**, dan ke [Issue #102](https://github.com/sk25ciwastra-blip/pixel-perfect/issues/102). Tidak meminta keputusan ulang.

**Dampak pada implementasi Issue #102:**
- `Batalkan Booking` yang dibutuhkan untuk mengakhiri reservasi administrasi adalah aksi status/audit, **bukan** tindakan pengembalian uang dan **bukan** pembatalan baris pembayaran.
- Tidak otomatis refund DP/pelunasan, tidak mengubah pembayaran, komisi, closing, sesi kas, struk, identitas nomor TRX, atau jadwal transaksi lain. Jangan menganggap angka penerimaan DEMO sebagai pendapatan LIVE hanya karena status Booking dibatalkan.
- **Reschedule** adalah jalur terpisah; jangan menambahkan reschedule otomatis pada issue pembatalan ini.
- Enam Booking lama tetap belum diklasifikasikan/diizinkan Owner satu per satu untuk perubahan status; salah satunya berjadwal 24 Des 2026. Persetujuan delapan transaksi `check_out` **tidak** mencakup enam Booking atau tiga Check-in.
- Tindakan Cloud, approval daftar izin, mutasi status, dan penutupan sesi kas tetap memerlukan persetujuan terpisah. **NO-GO** tidak berubah.

Bukti: aturan berasal dari keputusan Owner dalam percakapan Booking 14 November, bukan dari penafsiran fungsi refund yang sudah ada. Sinkronisasi dokumen/issue adalah perubahan perencanaan, **bukan** penerapan backend.
