# Baturaden 25 Homestay V1.0 — Arsitektur Sistem

**Tanggal pencatatan:** 2026-10-13<br>
**Status:** baseline terdokumentasi; beberapa modul masih bertahap.

## Peta arsitektur

```text
Browser / UI
  ├─ TanStack Router routes (`src/routes`)
  ├─ Komponen operasional (`src/components`)
  ├─ Kerangka navigasi (`src/components/kerangka.tsx`)
  └─ Context akses (`src/lib/peran.tsx`)
          │
          ▼
Supabase client (`src/integrations/supabase/client.ts`)
  ├─ Auth provider
  ├─ PostgREST table reads / realtime refresh
  └─ RPC SECURITY DEFINER
          │
          ▼
Lovable Cloud / Supabase
  ├─ Auth users
  ├─ user_roles dan employees
  ├─ RLS / policy / privilege
  ├─ Tabel operasional
  └─ Fungsi dan migrasi SQL
```

## Lapisan repository

| Lapisan | Lokasi | Peran |
|---|---|---|
| UI route | `src/routes` | Halaman Ringkasan, Booking, Check-in, Kamar, Tamu, Transaksi, Housekeeping, Keuangan, Karyawan, Pengaturan, Auth. |
| Komponen | `src/components` | Form transaksi, kerangka navigasi, status kamar, detail transaksi, checklist, maintenance. |
| Metadata/navigasi | `src/components/kerangka.tsx`, root route | Kerangka HP/desktop, menu berdasarkan role/posisi, metadata root. |
| Live data | `src/lib/data-live.ts` | `useTable` membaca tabel Supabase dan refresh melalui postgres changes. |
| Contoh UI | `src/lib/data-contoh.ts` | Data contoh untuk revisi antarmuka; bukan sumber aturan bisnis atau countdown nyata. |
| Akses | `src/lib/peran.tsx`, `src/routes/__root.tsx` | UI route/menu guard berdasarkan role dan posisi; kontrol final tetap server/database. |
| Akun employee | `src/lib/employee.functions.ts` | Server functions berizin Owner; Auth provider mengelola password. |
| Tipe | `src/integrations/supabase/types.ts` | Tipe database dan RPC yang dipakai frontend. |
| Baseline | `drizzle/migrations/0000–0005` | Fondasi identity, room, package, guest, transaction, payment, audit. |
| Operasional lanjutan | `supabase/migrations` | Migrasi SQL berurutan berdasarkan timestamp; total lokal 40 file. |

### Kompatibilitas RPC saat ini

- Staging terakhir memiliki `record_transaction_payment(uuid, numeric, text)` dari migrasi `06000`; source lokal sudah memanggil tiga parameter tersebut.
- Finance Foundation yang belum terpasang memperkenalkan signature empat parameter dengan `_idempotency_key`; penyesuaian source/types diperlukan lagi ketika Finance benar-benar dipasang.
- Staging terakhir memiliki `advance_room_cleaning(uuid)` dan `override_room_ready(uuid)`; source lokal memakai overload satu parameter agar kompatibel. Migrasi Housekeeping berikutnya menambahkan overload berbasis catatan.
- `create_reservation` final pada paket review memakai signature 10 parameter dengan `_scheduled_check_in` opsional; source frontend sudah menyiapkan parameter tersebut, tetapi migrasi `00006–00009` belum terpasang.
- Pada 2026-10-13, rangkaian tersebut berhasil dijalankan pada PostgreSQL portable terisolasi bersama baseline/prerequisite dan seed master uji; hasil ini tidak mengubah status Cloud.
- Dua sesi Receptionist terpisah juga menguji lock kamar: booking slot sama dan check-in kamar sama menghasilkan tepat satu sukses serta satu penolakan.

## Model identity dan permission

- `auth.users` adalah sumber akun autentikasi.
- `public.user_roles` memisahkan role `owner` dan `employee`.
- `public.employees` menyimpan profil operasional, posisi, dan status aktif.
- Password tidak disimpan di tabel aplikasi; pembuatan/reset employee dilakukan lewat Auth Admin server function berizin Owner.
- RLS, privilege, helper function, dan RPC `SECURITY DEFINER` adalah lapisan keamanan database.
- UI route guard pada `__root.tsx` hanya lapisan pengalaman pengguna, bukan pengganti RLS/RPC.

## Domain data

### Operasional

`room_types`, `rooms`, `packages`, `guests`, `transactions`, `payments`, dan `activity_logs` dibentuk oleh baseline dan migrasi operasional. Room status memakai enum `ready`, `occupied`, `dirty`, `cleaning`.

### Pricing

`room_types.pricing_group` mengelompokkan Standard, Superior A/B, dan Deluxe. `package_room_type_prices` menyimpan 27 kombinasi 9 paket × 3 pricing group. `transactions.price_snapshot` menjadi snapshot total transaksi.

### Booking/check-in

RPC `create_reservation` berkembang dari 9 parameter menjadi 10 parameter dengan `_scheduled_check_in` opsional. Versi review terakhir menambahkan jadwal, lock kamar, overlap booking-versus-booking, dan overlap booking-versus-check-in aktif. Belum terpasang di Staging pada status 22/40.

### Housekeeping

Checkout mengubah kamar menjadi dirty. RPC housekeeping menggerakkan dirty → cleaning → ready, dan Owner/Supervisor dapat memakai override READY. History/checklist/maintenance/numbering tersedia sebagai migrasi berikutnya tetapi belum terpasang.

### Nomorator dan relasi transaksi–Housekeeping

- Format Owner untuk transaksi baru: `BTRD25-TRX-000000-26`.
- Format Owner untuk pekerjaan Housekeeping: `BTRD25-HK-000000-26`.
- `14000_official_transaction_housekeeping_numbers.sql` mendefinisikan dua sequence terpisah, generator `next_transaction_number()` dan `next_housekeeping_number()`, serta suffix tahun `YY` berdasarkan Asia/Jakarta.
- Sequence pada migrasi tersebut tidak mendefinisikan reset tahunan; aturan reset/pergantian tahun masih `BELUM DIPUTUSKAN`.
- Baseline masih memiliki default nomor transaksi lama `BTRD25-000000`; migrasi `14000` belum terpasang pada status 22/40.
- Relasi yang dirancang: `housekeeping_jobs.transaction_id`, `housekeeping_history.transaction_id`, `housekeeping_history.job_id/job_number`, dan `housekeeping_transaction_resolutions` untuk kandidat checkout yang ambigu.
- `housekeeping_jobs.transaction_id` unik, sedangkan history dapat menyimpan beberapa kejadian; kebutuhan satu transaksi dengan lebih dari satu aktivitas Housekeeping masih harus diverifikasi sebelum menetapkan asumsi baru.
- Source `kamar.tsx` saat ini membaca rooms, room types, dan transactions, tetapi belum membaca `housekeeping_history`/`housekeeping_jobs`; karena itu kartu ROOM belum dapat menampilkan HK resmi atau ❌ checklist.
- Source `housekeeping.tsx` sudah membaca `housekeeping_history` dan menampilkan `job_number` bila tersedia, tetapi masih menampilkan fallback `HK legacy` bila nomor belum ada.

### Finance

`20261015000000_finance_foundation.sql` merancang cash session, commission, expense, deposit, refund, drawer handoff, dan entry point pembayaran. File tersebut belum terpasang dan tidak boleh diperlakukan sebagai fitur selesai.

Migration lanjutan lokal `20261015000001_finance_150_booking_compatibility.sql` menambahkan snapshot minimum DP, idempotency reservation/payment, contract payment lima parameter, `_session_id` bantuan Owner/Supervisor, operator audit melalui `recorded_by`, serta koreksi komisi refund yang ditautkan ke payment dan sesi asal. Artefak ini belum dijalankan di Cloud/Staging.

Aturan refund setelah closing: transaksi/payment dari sesi FINAL boleh menjadi referensi historis, tetapi sumber dana refund tidak boleh memutasi sesi FINAL; gunakan OWNER_FUNDS atau sesi OPEN yang berwenang. Koreksi komisi tetap ditautkan melalui `finance_refund_allocations` ke payment dan sesi asal.

### Kebutuhan tambahan yang belum terimplementasi

- Aturan biaya tamu tambahan memerlukan jumlah tamu pada alur booking/transaksi, perhitungan biaya, penyimpanan pada total transaksi, dan integrasi pendapatan/finance. Field dan RPC terkait belum ditemukan pada audit source/migrasi.
- Aturan cetak ulang struk memerlukan counter pencetakan per transaksi dan generator label cetakan pertama versus `SALINAN/COPY`. Struktur data, RPC, dan UI cetak belum ditemukan pada audit source/migrasi.

## Kebijakan data testing dan persiapan go-live

- Environment saat ini PRA-OPERASIONAL; belum boleh diperlakukan sebagai operasi resmi.
- Data transaksi, booking, tamu, pembayaran, Housekeeping, dan catatan testing dianggap DEMO/TESTING sampai Owner menetapkannya sebagai operasional.
- Data demo dapat dibersihkan atau diubah untuk pengembangan, tetapi tindakan destruktif tetap memerlukan identifikasi environment/cakupan/dampak dan persetujuan Owner.
- Konfigurasi, akun Owner, aturan bisnis, struktur penting, dan dokumentasi tidak ikut dihapus hanya karena data demo boleh dibersihkan.
- Data yang tidak jelas statusnya harus dipisahkan dan dikonfirmasi sebelum tindakan.
- Go-live membutuhkan pemisahan data testing dari data operasional baru, pemeriksaan relasi, format/sequence TRX-HK, akun/akses, dan pengujian akhir.
- Prosedur pembersihan harus mempertahankan struktur database, konfigurasi, aturan bisnis, dan hak akses yang telah disetujui.
- Kebijakan reset sequence saat go-live belum diputuskan Owner; arsitektur tidak boleh mengasumsikan reset otomatis.

## Urutan migrasi yang terdokumentasi

- Baseline Drizzle `0000–0005`: selesai di Staging.
- Supabase yang sudah dilaporkan berhasil: 22 dari 40.
- Migrasi `00006–00009`: review gabungan tersedia di `supabase/combined_00006_00009_final_review.sql`, belum dipasang.
- Migrasi setelahnya mencakup correction P4, operational calendar, scheduled fixes, housekeeping history/checklist/numbering, dan Finance.
- Jangan menganggap nama file lokal sebagai bukti migrasi sudah berjalan di Cloud; status Staging harus berasal dari checkpoint Owner atau verifikasi database yang diizinkan.

## Enam area perencanaan

Dokumentasi dan pekerjaan berikutnya dikelompokkan sebagai DASHBOARD, ROOM, BOOKING, TRANSAKSI, FINANCE, dan TIM & AKSES. Keputusan tampilan Booking sudah disetujui Owner untuk tampilan yang diperiksa; keputusan ROOM masih sebagian sesuai; empat area lain tetap bertahap sesuai status fitur. Pengelompokan ini tidak mengubah skema atau hak akses.

## Source of truth

| Data / keputusan | Sumber utama |
|---|---|
| Identitas dan role | Lovable Cloud/Supabase Auth, `user_roles`, `employees` |
| Harga/durasi/timing resmi | Keputusan Owner dan katalog database yang disetujui |
| Harga room group | `package_room_type_prices` setelah migrasi terkait terpasang |
| Contoh tampilan | `src/lib/data-contoh.ts`, tidak boleh dijadikan aturan bisnis |
| Data operasional live | `src/lib/data-live.ts` dan Supabase |
| Riwayat pekerjaan repository | Git log, tetapi bukan pengganti persetujuan Owner |

## Keterbatasan yang diketahui

- Runtime PostgreSQL lokal sudah diuji pada cluster sementara port 55432 dan cluster sudah dihentikan; runtime PostgreSQL Cloud/Staging tetap belum diuji.
- Lint repository terblokir oleh masalah formatting/CRLF yang luas.
- Build dan TypeScript berhasil, tetapi itu tidak membuktikan RLS, RPC, trigger, atau migrasi SQL berhasil di database.
- Implementasi biaya tamu tambahan dan cetak ulang struk belum terverifikasi; aturan bisnisnya sudah dicatat sebagai keputusan Owner pada `02_ATURAN_BISNIS.md`.

## Implementasi ROOM + DASHBOARD — 2026-10-13

- Navigasi memakai label `DASHBOARD` untuk route `/` dan `ROOM` untuk route `/kamar`; route Booking tidak diubah.
- Kartu ROOM membaca transaksi `check_in` aktif untuk menampilkan TRX dan membuka detail transaksi.
- Kartu ROOM membaca `housekeeping_history` dan `housekeeping_checklists` bila tabel/record tersedia. `job_number`, catatan, dan isu checklist ditampilkan hanya dari data resmi; tidak ada fallback nomor HK palsu.
- Bila objek Housekeeping belum tersedia di Staging, UI menampilkan keadaan data belum tersedia dan tetap menampilkan data kamar yang dapat dibaca.
- Countdown DASHBOARD hanya memakai state waktu lokal yang diperbarui setiap detik. Query tabel dilakukan oleh `useTable` saat pemuatan dan perubahan realtime, bukan oleh timer countdown.
- Migrasi `00006–00009` sudah diverifikasi terpasang di Staging; objek Housekeeping history/checklist dan nomorator resmi tetap bergantung pada migrasi berikutnya.

## Koreksi tampilan Perawatan Berkala — 2026-10-13

- Sidebar menyimpan label presentasi normal `Dashboard` dan `Room`; kapitalisasi `ROOM` hanya digunakan pada label kartu kamar.
- `PerawatanBerkala` tetap membaca `housekeeping_maintenance`, `rooms`, `room_types`, dan `employees`, tetapi merangkum task jatuh tempo menjadi kategori `work_type`.
- Detail kategori mempertahankan pemilihan petugas, catatan, checkbox, status MENUNGGU AKSES/JATUH TEMPO, riwayat terakhir, dan RPC `record_housekeeping_maintenance`.
- Jika tabel perawatan atau kamar gagal dibaca, UI menampilkan fallback database belum tersedia; kategori dan jumlah tidak dibuat secara palsu.

## Penyempurnaan UI Room, Perawatan, dan Transaksi — 2026-10-13

- Route Room mempertahankan filter status live tanpa input pencarian; judul dan jumlah Room berasal dari data kamar yang dibaca.
- Kartu kategori Perawatan Berkala memakai container presentasi biasa dan tombol aksi `Lihat Daftar`; navigasi tidak terikat pada seluruh permukaan kartu.
- Route Transaksi membentuk grup di browser dari `transactions.created_at` dalam zona waktu Asia/Jakarta, lalu mengurutkan grup dan item secara menurun.
- Tidak ada perubahan pada tabel, RPC, perhitungan pembayaran, pendapatan, atau route Booking.

## Finalisasi UI Transaksi — 2026-10-13

- Pencarian nomor transaksi dilakukan di browser: nomor lengkap memakai pencarian teks, sedangkan input numerik minimal dua digit dicocokkan terhadap bagian urut setelah nol depan dinormalisasi.
- Baris Transaksi membaca identitas dari guest/room/room type dan waktu aktual dari `transactions.started_at` serta `transactions.checked_out_at`.
- `scheduled_check_in`, `scheduled_check_out`, dan `ends_at` tidak digunakan untuk mengisi kolom waktu aktual.
- Aksi Check-out tidak berada pada route atau detail Transaksi; fungsi backend dan akses Dashboard tidak diubah.

## Koreksi desain Booking dan acuan visual Transaksi — 2026-10-13

- Struktur visual Booking pra-RIW-029 adalah acuan presentasi: kotak room kiri, identitas/TRX tengah, aksi/status kanan, grouping tanggal, dan container `Daftar`.
- RIW-030 hanya mengubah JSX/layout presentasi; state Booking, RPC, validasi, pembayaran, dan akses tetap menggunakan implementasi terbaru.
- Route Transaksi mempertahankan grouping/pencarian/timestamp RIW-028, tetapi susunan visualnya mengikuti pola Booking yang disetujui Owner.

## SOP proyek dan data pra-go-live — 2026-10-13

- SOP-01–SOP-05 mengatur urutan kerja, sumber keputusan, kelengkapan instruksi, pembukaan alat pada sesi baru, dan prinsip kesederhanaan; SOP tersebut tidak mengubah runtime aplikasi.
- SOP-06 menetapkan pemisahan konseptual data DEMO/TESTING dari dataset operasional bersih sebelum go-live.
- Pembersihan data adalah prosedur operasional terkontrol, bukan efek otomatis dari UI atau migrasi. Struktur, akun Owner, konfigurasi, aturan, dan dokumentasi tetap berada di luar cakupan pembersihan data demo.
- Keputusan reset nomorator tetap menjadi keputusan Owner yang belum ditetapkan.

## Memori kerja permanen — lima dokumen resmi

| Dokumen | Fungsi permanen |
|---|---|
| `01_BUKU_INDUK.md` | Status proyek, kebijakan Owner, checkpoint utama, definisi status, dan batas go-live. |
| `02_ATURAN_BISNIS.md` | Aturan bisnis/SOP ber-ID permanen serta sumber keputusan Owner. |
| `03_STATUS_FITUR.md` | Status fitur, bukti uji, batas lingkungan, dan pekerjaan berikutnya. |
| `04_RIWAYAT_PERUBAHAN.md` | Riwayat keputusan, implementasi, pengujian, persetujuan, dan checkpoint. |
| `05_ARSITEKTUR_SISTEM.md` | Peta source/data/permission, dependency migration, kontrak RPC, dan rekonstruksi schema. |

Tidak ada dokumen pengganti. Bagian baru di bawah ini adalah addendum dan ledger yang mempertahankan isi historis sebelumnya.

## Ledger Drizzle — baseline dan sidecar

`drizzle/migrations/meta/_journal.json` mencatat tepat 6 migration resmi, `0000` sampai `0005`. Baseline membuat enum, identity/role, master kamar/paket, tamu, transaksi, audit, dan payment. File `drizzle/0007_add_package_hours.sql` berada di luar `drizzle/migrations/` dan tidak tercatat di journal; file tersebut tidak boleh dianggap terbukti pernah dijalankan.

| Urutan / file | Tujuan dan schema | Fungsi, trigger, policy, index, grant penting | Dependency dan status |
|---|---|---|---|
| `0000_operational_foundation.sql` | Membuat 9 tabel inti: `user_roles`, `employees`, `room_types`, `rooms`, `packages`, `package_price_history`, `guests`, `transactions`, `activity_logs`; enum status/role dan `transaction_number_seq`. | `has_role`, `can_operate`, `is_receptionist`, room transition, transaction identity, audit dan `updated_at`; RLS/policy dasar. | Fondasi untuk semua migration berikutnya. STAGING: **TERBUKTI CHECKPOINT OWNER**; journal resmi. |
| `0001_fix_audit_price_column_scope.sql` | Memperbaiki audit agar riwayat harga hanya diproses pada perubahan harga paket. | Replace `audit_changes`. | Dependency `0000`. STAGING: **TERBUKTI CHECKPOINT OWNER**; journal resmi. |
| `0002_operational_permissions_and_number_safety.sql` | Menambah insert/update employee dan transaction melalui policy serta keamanan nomor transaksi. | Replace `advance_room_cleaning` dan trigger `enforce_transaction_identity`. | Dependency `0000–0001`. STAGING: **TERBUKTI CHECKPOINT OWNER**; journal resmi. |
| `0003_package_price_reason_and_inactive_auth.sql` | Mengatur perubahan harga dengan alasan dan menghormati paket/employee aktif. | `change_package_price`, replace `advance_room_cleaning`, revoke/grant RPC. | Dependency `packages`, audit, role helper. STAGING: **TERBUKTI CHECKPOINT OWNER**; journal resmi. |
| `0004_checkin_atomic_transaction.sql` | Menyediakan check-in atomik dari room, guest, dan package. | `create_checkin(uuid,uuid,uuid)` dengan validasi role, harga, room, dan rollback transaksi. | Dependency `rooms`, `guests`, `packages`, `transactions`. STAGING: **TERBUKTI CHECKPOINT OWNER**; journal resmi. |
| `0005_booking_checkin_payments_and_duration.sql` | Menambah `transactions.package_id`, `started_at`, `ends_at`; membuat tabel `payments`, menjadikan total baseline 10 tabel. | RPC legacy `create_reservation` 8 parameter dan payment policy `Cash/QRIS/Transfer`. | Dependency baseline `0000–0004`; prerequisite utama Supabase. STAGING: **TERBUKTI CHECKPOINT OWNER**; journal resmi. |
| `drizzle/0007_add_package_hours.sql` | Sidecar menambah `packages.start_time` dan `end_time` dengan `IF NOT EXISTS`. | Tidak ada journal entry, policy, atau grant resmi. | Di luar `drizzle/migrations/meta/_journal.json`; STAGING: **BELUM TERVERIFIKASI**. |

### Hubungan Drizzle dan Supabase

Drizzle adalah bootstrap schema dan tidak tercermin sebagai 43 row Supabase. Supabase mengasumsikan tabel, enum, helper, dan RPC Drizzle sudah ada, lalu mengubahnya secara berurutan. Karena itu, migration Supabase tidak boleh dijalankan sebagai pengganti baseline Drizzle, dan keberadaan file Supabase tidak membuktikan penerapan remote.

## Ledger Supabase — 43 migration committed

Status ledger:

- **TERBUKTI STAGING (checkpoint Owner):** migration 1–26 sampai `20261006000009`; status ini berasal dari checkpoint/inspeksi Owner, bukan dari `schema_migrations` remote yang lengkap.
- **BELUM TERVERIFIKASI STAGING:** migration 27–43. File, dependency, dan hasil lokal dicatat, tetapi penerapan remote belum terbukti.
- **TERBUKTI LOKAL:** berarti file ada dan/atau source/E2E/runtime lokal memiliki evidence; tidak sama dengan Staging.

### Core check-in, timing, role, checkout, dan pembayaran

| # / filename | Tujuan; tabel/kolom/data | RPC, trigger, index, policy, grant penting | Dependency; status penerapan |
|---|---|---|---|
| 01 `20261002000000_canonical_checkin.sql` | Tidak membuat tabel; menormalkan alur check-in. | Replace `check_in_booking`; drop legacy `create_checkin`; revoke/grant authenticated. | Drizzle baseline. STAGING: **TERBUKTI CHECKPOINT OWNER**. |
| 02 `20261003000001_package_timing_pricing_schema.sql` | Alter `packages` dengan weekday/weekend price, `time_mode`, slot/check-in/checkout; alter `transactions.day_mode` dan constraints. | Constraint nonnegative/hari valid. | `0000`, `packages`, `transactions`. STAGING: **TERBUKTI CHECKPOINT OWNER**. |
| 03 `20261003000002_package_time_engine.sql` | Tidak membuat tabel; memperkenalkan engine waktu paket. | `calculate_package_stay_times` sebagai helper `STABLE`. | Kolom timing pada migration 02. STAGING: **TERBUKTI CHECKPOINT OWNER**. |
| 04 `20261003000003_reservation_timing_pricing_rpc.sql` | Tidak membuat tabel; reservation memakai timing dan harga package-level. | Replace `create_reservation`, `check_in_booking`; validasi mode/payment dan grants. | Engine waktu, room, package, payment. STAGING: **TERBUKTI CHECKPOINT OWNER**. |
| 05 `20261003000004_package_dual_price_history.sql` | Alter `package_price_history` dengan `price_type` dan constraint. | Replace `change_package_prices`; audit dual price; revoke/grant. | `packages`, price history. STAGING: **TERBUKTI CHECKPOINT OWNER**. |
| 06 `20261003000005_package_timing_config.sql` | Mengisi/menjaga konfigurasi timing paket resmi tanpa tabel baru. | Guard/check untuk mode, slot, jendela check-in, checkout. | Official package catalog. STAGING: **TERBUKTI CHECKPOINT OWNER**. |
| 07 `20261003000006_atomic_package_update.sql` | Tidak membuat tabel; update package price/timing secara atomik. | `update_package`; validasi owner, audit, revoke/grant. | Package schema dan price history. STAGING: **TERBUKTI CHECKPOINT OWNER**. |
| 08 `20261003000007_package_catalog_guard.sql` | Tidak membuat tabel; melindungi katalog resmi dan timing. | Guard/apply official timing, `update_package`, policy/grants direct-write. | Migration 02–07. STAGING: **TERBUKTI CHECKPOINT OWNER**. |
| 09 `20261003000008_create_official_package.sql` | Tidak membuat tabel; entry point pembuatan paket resmi. | `create_official_package`; validasi owner dan grant authenticated. | Catalog guard dan package schema. STAGING: **TERBUKTI CHECKPOINT OWNER**. |
| 10 `20261003000009_lock_package_direct_writes.sql` | Tidak membuat tabel; menutup mutation langsung katalog paket. | Revoke INSERT/UPDATE/DELETE pada `packages`; RPC tetap menjadi entry point. | Package guard. STAGING: **TERBUKTI CHECKPOINT OWNER**. |
| 11 `20261003000010_employee_positions.sql` | Memperluas enum `employee_position` untuk posisi operasional berikutnya. | Tidak ada tabel baru; enum menjadi dependency role/Finance. | `employees`. STAGING: **TERBUKTI CHECKPOINT OWNER**. |
| 12 `20261003000011_role_permission_foundation.sql` | Tidak membuat tabel; menyelaraskan helper akses dan policy/RLS operasional. | `has_employee_position`, `can_view_operations` dan grants/policies terkait. | `user_roles`, `employees`, enum posisi. STAGING: **TERBUKTI CHECKPOINT OWNER**. |
| 13 `20261005000012_checkout_foundation.sql` | Alter alur transaksi/room untuk checkout; tidak membuat tabel baru. | Checkout atomik, room `occupied → dirty`, timestamp dan grants. | `rooms`, `transactions`, role helper. STAGING: **TERBUKTI CHECKPOINT OWNER**. |
| 14 `20261005000013_harden_checkout_rpc.sql` | Tidak membuat tabel; memperketat validasi checkout. | Replace/harden checkout RPC dan privilege. | Checkout foundation. STAGING: **TERBUKTI CHECKPOINT OWNER**. |
| 15 `20261005000014_housekeeping_role_alignment.sql` | Tidak membuat tabel; menyelaraskan akses housekeeping dasar. | Replace role checks pada cleaning RPC/policy. | `employees`, room status, role helper. STAGING: **TERBUKTI CHECKPOINT OWNER**. |
| 16 `20261005000015_room_ready_override.sql` | Tidak membuat tabel; menambah override room menjadi ready. | `override_room_ready(uuid)` dan RLS/grant Owner. | Housekeeping role alignment. STAGING: **TERBUKTI CHECKPOINT OWNER**. |
| 17 `20261006000000_payment_settlement_foundation.sql` | Tidak membuat tabel; menambah entry point pembayaran dan settlement. | `record_transaction_payment(uuid,numeric,text)` serta privilege authenticated. | `payments`, `transactions`, role helper. STAGING: **TERBUKTI CHECKPOINT OWNER**. |
| 18 `20261006000001_require_paid_booking_checkin.sql` | Tidak membuat tabel; check-in booking wajib lunas. | Replace `check_in_booking`, validasi total payment dan rollback. | Payment settlement dan transaksi booking. STAGING: **TERBUKTI CHECKPOINT OWNER**. |

### Pricing, scheduled booking, dan kontrak 10 parameter

| # / filename | Tujuan; tabel/kolom/data | RPC, trigger, index, policy, grant penting | Dependency; status penerapan |
|---|---|---|---|
| 19 `20261006000002_room_type_pricing_catalog.sql` | Alter `room_types` menambah `pricing_group` dan constraint; seed/normalisasi group. | Guard constraint dan policy pricing. | `room_types`, official package catalog. STAGING: **TERBUKTI CHECKPOINT OWNER**. |
| 20 `20261006000003_room_type_mapping.sql` | Data migration mapping 11 room ke Standard/Superior A/Superior B/Deluxe. | Tidak ada RPC baru; menjaga mapping dan room type relation. | `rooms`, `room_types`. STAGING: **TERBUKTI CHECKPOINT OWNER**. |
| 21 `20261006000004_official_package_catalog.sql` | Memvalidasi/menyiapkan 9 paket resmi tanpa membuat tabel baru. | Catalog/timing checks; menjaga nama, durasi, mode. | `packages`, timing engine. STAGING: **TERBUKTI CHECKPOINT OWNER**. |
| 22 `20261006000005_room_type_package_prices.sql` | Membuat tabel `package_room_type_prices` dan seed 27 harga untuk 9 paket × 3 pricing group. | RLS read, unique `(package_id, pricing_group)`, price checks, seed guards. | `packages`, `room_types`; tabel ke-11 pada rekonstruksi Staging. STAGING: **TERBUKTI CHECKPOINT OWNER**. |
| 23 `20261006000006_reservation_room_type_pricing.sql` | Tidak membuat tabel; reservation membaca harga room type/pricing group dan menyimpan snapshot. | Replace `create_reservation` dengan `day_mode` dan database pricing; grants. | `package_room_type_prices`, room type mapping. STAGING: **TERBUKTI CHECKPOINT OWNER**. |
| 24 `20261006000007_scheduled_booking_foundation.sql` | Alter `transactions` menambah `scheduled_check_in/out`, check constraint, dua index partial. | `calculate_scheduled_booking_times`; revoke/grant helper. | Time engine, transactions. STAGING: **TERBUKTI CHECKPOINT OWNER**. |
| 25 `20261006000008_scheduled_reservation_rpc.sql` | Tidak membuat tabel; drop kontrak 9 parameter dan membuat `create_reservation` 10 parameter dengan scheduled check-in opsional. | Validasi jadwal, pricing, payment, lock, grants. | Migration 23–24. STAGING: **TERBUKTI CHECKPOINT OWNER**. |
| 26 `20261006000009_interval_booking_availability.sql` | Tidak membuat tabel; final availability memakai interval booking/check-in. | Replace `create_reservation` 10 parameter; strict overlap, `FOR UPDATE`, index usage, grants. | Scheduled columns/helper. STAGING: **TERBUKTI CHECKPOINT OWNER**; kontrak 10 parameter dilaporkan aktif. |
| 27 `20261006000010_correct_p4_prices.sql` | Data update pada `package_room_type_prices` untuk koreksi P4. | Tidak ada RPC baru; perubahan katalog langsung. | Migration 22. STAGING: **BELUM TERVERIFIKASI**; konflik P4 dicatat di aturan bisnis. |

### Operational calendar dan scheduled check-in fixes

| # / filename | Tujuan; tabel/kolom/data | RPC, trigger, index, policy, grant penting | Dependency; status penerapan |
|---|---|---|---|
| 28 `20261006000011_operational_calendar.sql` | Membuat `operational_calendar` untuk weekday/weekend, holiday, dan Owner override. | `get_operational_day_mode(date)`, RLS read. | Auth user, calendar rules. STAGING: **BELUM TERVERIFIKASI**. |
| 29 `20261006000012_calendar_event_types.sql` | Alter calendar menambah `event_type`, `source_name`, `source_reference` dan checks. | Replace `get_operational_day_mode`; policy compatibility. | `operational_calendar`. STAGING: **BELUM TERVERIFIKASI**. |
| 30 `20261006000013_seed_official_calendar.sql` | Seed tanggal/hari libur official ke `operational_calendar`. | Unique/date conflict handling dan seed data. | Calendar schema/event types. STAGING: **BELUM TERVERIFIKASI**. |
| 31 `20261006000014_authoritative_day_mode.sql` | Tidak membuat tabel; reservation memakai mode hari dari calendar sebagai sumber authoritative. | Replace `create_reservation` 10 parameter; day mode, pricing, grants. | Calendar + scheduled/pricing objects. STAGING: **BELUM TERVERIFIKASI**. |
| 32 `20261007000000_booking_checkin_schedule_guard.sql` | Tidak membuat tabel; check-in tidak boleh melanggar scheduled window. | Replace `check_in_booking`, schedule guard dan grant. | Scheduled booking dan timing engine. STAGING: **BELUM TERVERIFIKASI**. |
| 33 `20261007000001_duration_package_schedule_fix.sql` | Tidak membuat tabel; memperbaiki hitungan durasi package terhadap scheduled check-in. | Replace `check_in_booking`, local date/window guard. | Migration 32, time engine. STAGING: **BELUM TERVERIFIKASI**. |
| 34 `20261007000002_duration_early_checkin_fix.sql` | Tidak membuat tabel; memperbaiki early check-in dan fixed-window boundary. | Replace `check_in_booking`, grants/revokes. | Migration 33 dan package timing. STAGING: **BELUM TERVERIFIKASI**. |
| 35 `20261007000003_duration_midnight_windows_restore.sql` | Tidak membuat tabel; memulihkan window paket yang melewati tengah malam. | Replace/adjust time engine behavior. | Migration 34 dan official package timing. STAGING: **BELUM TERVERIFIKASI**. |
| 36 `20261010000000_revoke_direct_transaction_insert.sql` | Tidak membuat tabel; menutup insert langsung transaksi untuk authenticated/anon. | Revoke table INSERT; reservation/check-in RPC menjadi entry point. | Transactions dan RPC reservation. STAGING: **BELUM TERVERIFIKASI**. |

### Housekeeping, numbering, dan Finance 150

| # / filename | Tujuan; tabel/kolom/data | RPC, trigger, index, policy, grant penting | Dependency; status penerapan |
|---|---|---|---|
| 37 `20261012000000_housekeeping_history.sql` | Membuat `housekeeping_history`; menghubungkan room/transaction/employee dan status cleaning. | Overload `advance_room_cleaning`/`override_room_ready`, transition trigger, RLS/read policy. | `rooms`, `transactions`, `employees`, role helper. STAGING: **BELUM TERVERIFIKASI**. |
| 38 `20261013000000_housekeeping_checklists_maintenance.sql` | Membuat `housekeeping_checklists` dan `housekeeping_maintenance`; menambah reason columns/constraints. | Checklist completion, maintenance recording, cleaning overloads, indexes, RLS/grants. | Housekeeping history dan room/employee. STAGING: **BELUM TERVERIFIKASI**. |
| 39 `20261014000000_official_transaction_housekeeping_numbers.sql` | Membuat sequence TRX/HK, `housekeeping_jobs`, `housekeeping_transaction_resolutions`; menambah job columns/history constraints. | `next_transaction_number`, `next_housekeeping_number`, resolve/record resolution, cleaning/checklist RPCs, indexes, RLS/grants. | Housekeeping history/checklists, existing transaction numbers. STAGING: **BELUM TERVERIFIKASI**. |
| 40 `20261015000000_finance_foundation.sql` | Membuat 11 tabel Finance: settings, commission configs, bank accounts, cash sessions, session allocations, drawer handoffs, expenses, deposits, charge events, refunds, refund allocations; alter `payments`/`transactions`. | Payment/session/commission/refund triggers; RPC open/close session, payment, expense, deposit, refund, commission, summary; RLS, revoke direct writes, authenticated grants. | Operational baseline, payments, employee positions/role helpers. STAGING: **BELUM TERVERIFIKASI**; local Finance evidence PASS. |
| 41 `20261015000001_finance_150_booking_compatibility.sql` | Membuat `finance_reservation_idempotency`; adds minimum-DP snapshot columns on `transactions`. | DP snapshot/payment guards; replaces payment with 5-parameter contract, reservation with 12 parameters adding `_idempotency_key`/`_session_id`; refund source guard, indexes/RLS. | Finance Foundation, calendar, pricing, scheduled booking. STAGING: **BELUM TERVERIFIKASI**; local Finance evidence PASS. |
| 42 `20261015000002_finance_150_supervisor_alignment.sql` | Tidak membuat tabel; aligns Supervisor access and helper behavior. | `finance_is_booking_operator`, replace `open_finance_cash_session`, `check_in_booking`, `create_reservation` 12 parameter; Supervisor SELECT policies/grants. | Finance 40–41, employee position/RLS. STAGING: **BELUM TERVERIFIKASI**; local Finance evidence PASS. |
| 43 `20261015000003_booking_reference_read_privileges.sql` | Tidak membuat tabel; grants authenticated read on `package_room_type_prices` and `operational_calendar`. | Grant SELECT and `get_operational_day_mode`; revoke direct writes. | Tables 22 and 28. STAGING: **BELUM TERVERIFIKASI**. |

## Finance 150 integration checkpoint

Finance Foundation introduces the finance domain; Booking Compatibility adds minimum DP snapshots, idempotency for reservation/payment, five-argument payment recording, `_session_id` assistance, operator audit, and refund-source rules; Supervisor Alignment replaces the callable booking/check-in/session contracts and adds Supervisor read policies; Booking Reference Privileges closes the read surface needed by Booking. The local source/types integrate `finance_cash_sessions`, session selection, DP/pelunasan, `check_in_booking`, commissions, refunds, and Finance UI.

The local contract is intentionally ahead of the reported Staging contract: Staging `create_reservation` has 10 parameters, while Finance 150 local migration 41/42 defines 12. This is a compatibility boundary, not a reason to run the migration automatically. Finance 150 remains local/evidence PASS, **BELUM SELARAS STAGING**, and **bukan production-ready**.

## Supabase Staging checkpoint dan provenance

| Fakta | Status dan batas |
|---|---|
| Project | `Baturaden-25-Staging`; reference Owner `bgtztcfbkcrvcipxbfti`. |
| Repository config | `supabase/config.toml` menunjuk `ijujmxhcifuerkllbbgq`; keterkaitan dengan Staging belum terbukti. |
| Public tables | 11 dilaporkan terlihat. Nama dan kolom exact tetap perlu snapshot katalog. |
| RPC | `create_reservation` 10 parameter, `check_in_booking` dan `record_transaction_payment` dilaporkan tersedia. |
| Finance objects | `finance_cash_sessions`/`finance_session_allocations` belum diverifikasi langsung. Pencarian nama `cash_sessions`/`cash_session_entries` salah namespace penamaan untuk design Finance ini. |
| Migration history | Belum terbukti lengkap; file local ≠ applied remote. |
| Cloudflare | Belum digunakan/dikonfigurasi Owner selama pembangunan; target Worker, binding, route, CORS, dan environment belum diverifikasi. |
| Provenance | Rekonstruksi 9 Drizzle `0000` + `payments` pada `0005` + `package_room_type_prices` pada `06005` = 11 tabel, lalu `06007–00009` mengubah Booking. Ini rekonstruksi artefak, bukan remote ledger. |

## Risiko, strategi, dan informasi yang masih diperlukan

Risiko utama adalah schema drift, migration history kosong/tidak lengkap, kontrak RPC 10-versus-12 parameter, trigger/payment/session behavior, grants/RLS, auth/JWT claim mapping, dan data existing. Finance tidak boleh disimpulkan tidak ada hanya karena tabel dengan nama lama tidak terlihat.

Sebelum Owner mengizinkan tindakan write, diperlukan snapshot read-only: 11 tabel dan seluruh kolom/default/nullable; constraints/indexes/sequences/triggers; `pg_proc` identity args, owner, `SECURITY DEFINER`, search path dan grants untuk RPC; RLS policies/grants; enum labels/extensions; row counts dan null/invalid checks tanpa personal data; Auth/JWT/PostgREST claim mapping; serta backup/PITR dan rollback owner.

Strategi minimum yang aman adalah forward-only reconciliation setelah exact diff katalog. Jangan replay 43 migration, jangan `db push`, jangan repair, jangan reset, jangan menghapus atau membuat ulang Staging, dan jangan mengubah project reference. Isolated clean Staging adalah alternatif dengan risiko lebih rendah, tetapi pembuatan project baru belum diizinkan pada checkpoint ini.

## Checkpoint akhir dokumentasi — 2026-10-14

- Lima dokumen resmi tetap tersedia dan diperbarui tanpa menghapus aturan lama.
- Migration ledger: 6 Drizzle journal entries + 1 sidecar non-journal; 43 Supabase files committed.
- Finance 150: local Browser E2E/TypeScript/build PASS; Staging/Production belum terbukti; bukan production-ready.
- Git HEAD: `37ae7bdbcdb80d9f0ee560ae00554688e6fefecc`; belum push/deploy; unstaged/untracked dilindungi.
- Blocker nyata: remote catalog/history/Auth/JWT/RLS/grants dan schema compatibility belum tersedia secara lengkap.
- Progres dokumentasi tahap ini: **100%**; strategi penyelarasan Staging: **belum dimulai karena menunggu metadata read-only**.
- Satu tindakan minimum berikutnya: ambil snapshot katalog Supabase Staging read-only dan lakukan diff terhadap ledger ini.
