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

- Format historis untuk transaksi: `BTRD25-TRX-000000-26`; transaksi baru memakai `BTRDTRX-000001`.
- Format historis Owner untuk pekerjaan Housekeeping adalah `BTRD25-HK-000000-26`; format baru yang berlaku adalah `BTRDHK-000001`.
- `14000_official_transaction_housekeeping_numbers.sql` adalah histori generator lama berbasis tahun. Migration forward-only `20261019000000_owner_final_numbering.sql` menggantikan default/generator baru tanpa mengubah migration tersebut.
- Sequence final tidak reset pada pergantian tahun; tanggal arsip/filter berasal dari `created_at`/tanggal pencatatan, bukan nomor.
- Baseline dan format historis `BTRD25-000000` tetap dipertahankan untuk pencarian/arsip; transaksi baru memakai `BTRDTRX-*`.
- Relasi yang dirancang: `housekeeping_jobs.transaction_id`, `housekeeping_history.transaction_id`, `housekeeping_history.job_id/job_number`, dan `housekeeping_transaction_resolutions` untuk kandidat checkout yang ambigu.
- `housekeeping_jobs.transaction_id` unik, sedangkan history dapat menyimpan beberapa kejadian; kebutuhan satu transaksi dengan lebih dari satu aktivitas Housekeeping masih harus diverifikasi sebelum menetapkan asumsi baru.
- Source `kamar.tsx` saat ini membaca rooms, room types, dan transactions, tetapi belum membaca `housekeeping_history`/`housekeeping_jobs`; karena itu kartu ROOM belum dapat menampilkan HK resmi atau ❌ checklist.
- Source `housekeeping.tsx` sudah membaca `housekeeping_history` dan menampilkan `job_number` bila tersedia, tetapi masih menampilkan fallback `HK legacy` bila nomor belum ada.

### P0-01 — Nomorator final Owner (2026-10-19)

Keputusan final Owner menetapkan tiga prefix tanpa tahun: `BTRDTRX-000001`, `BTRDHK-000001`, dan `BTRDEXP-000001`. Migration forward-only `20261019000000_owner_final_numbering.sql` tidak mengubah migration historis, nomor lama, relasi transaksi, atau data lama.

- Sequence baru `owner_transaction_number_seq`, `owner_housekeeping_number_seq`, dan `owner_expense_number_seq` berdiri terpisah per kategori, memakai `nextval`, `NO MAXVALUE`, dan tetap aman saat concurrent insert. `lpad(..., 6, '0')` hanya padding minimum; angka ke-1.000.000 menjadi tujuh digit.
- `next_transaction_number()` dan `next_housekeeping_number()` diganti secara forward-only, lalu default transaksi memakai generator baru. Booking, check-in, dan check-out tetap merujuk `transactions.id`/`transaction_number` yang sama sehingga nomor tidak berganti sepanjang siklus transaksi.
- `finance_expenses.expense_number` ditambahkan nullable agar expense lama tidak di-backfill. Expense baru mendapat default `next_expense_number()`, unique partial index, dan constraint format baru. Record expense lama tetap dapat dibaca; pencarian baru mencocokkan nomor, kategori, catatan, dan idempotency key.
- Constraint transaksi dan Housekeeping menerima format Owner baru serta format lama `BTRD25-...`; migration tidak melakukan mass replacement. Relasi `housekeeping_history.job_id/job_number` tetap menjadi identitas pekerjaan, bukan penyamaan angka TRX/HK.
- Blok `sequence_sync` dan query read-only `supabase/reconciliation/owner_final_numbering_preflight.sql` mengambil maksimum dari nomor Owner dan format historis yang dikenal sebelum sequence dipakai. Data contoh di `src/lib/data-contoh.ts` tidak dihitung sebagai nomor terbit.
- P0-01 correction juga menggantikan body trigger legacy `enforce_transaction_identity()` dan memasang ulang `transaction_identity_insert`: `created_by` tetap dipaksa dari `auth.uid()`, tetapi nomor selalu berasal dari `next_transaction_number()` Owner-final; default historis dilepas agar sequence tidak dikonsumsi dua kali.
- Hotfix final P0-01 menjalankan trigger tersebut sebagai `SECURITY DEFINER` dengan `search_path = pg_catalog, public`; EXECUTE langsung dicabut dari `PUBLIC`, `anon`, dan `authenticated`. Generator tiga kategori tetap least-privilege dan tidak dibuka ke role aplikasi; insert resmi role `authenticated` menggunakan trigger, sedangkan Housekeeping/Expense memakai default melalui jalur RPC berizin.
- Pencarian Transaksi menerima nomor baru, nomor resmi lama, dan nomor baseline lama. Arsip/filter tahun tetap memakai `transactions.created_at`/tanggal pencatatan, bukan substring nomor.

### P0-02 — Dashboard operasional tabel kamar terisi (2026-10-19)

- `src/routes/index.tsx` mengganti hanya bagian daftar kamar menjadi tabel `Kamar Sedang Terisi`; tidak ada foto kamar dan bagian Dashboard lain tetap dipertahankan.
- Sumber baris adalah relasi live `transactions.room_id` → `rooms.id` → `room_types.id`. Filter wajib: `transactions.status = 'check_in'`, `rooms.active = true`, dan `rooms.status = 'occupied'`. Booking mendatang serta ready/dirty/cleaning tidak masuk tabel.
- Countdown dihitung lokal dari `transactions.ends_at`, diurutkan berdasarkan sisa waktu. Timer tidak menulis database. Nilai nol/negatif diberi label `WAKTU HABIS` dan tetap tampil sampai RPC Check-out mengubah transaksi/kamar.
- Kolom tabel: kamar + tipe, nama tamu + empat digit WhatsApp, paket, countdown, dan tepat tiga aksi ikon. Detail membuka `DetailTransaksi` dengan `transaction.id`; Hubungi memakai `guest.phone` tersimpan setelah validasi; nomor invalid/nonexistent membuat tombol disabled.
- Check-out melakukan preflight client terhadap status transaksi, status kamar, pembayaran, role, dan sesi Training; konfirmasi memuat kamar/tamu/nomor transaksi. Mutation tetap melalui `check_out_transaction(uuid)` atau `check_out_training_transaction(uuid, uuid)`, lalu refresh transaksi, kamar, dan pembayaran. RPC resmi mengunci transaksi, mengubah kamar `occupied → dirty`, mengisi `checked_out_at`, dan menulis activity log.
- Gap server-side tersebut ditutup oleh P0-02B secara lokal melalui migration `20261019000001_harden_checkout_payment_settlement.sql`; Dashboard tidak diubah ulang. Staging/Production tetap tidak disentuh.

### P0-02B — Hardening Check-out server-side (2026-10-19)

- Sumber kebenaran settlement: `transactions.price_snapshot` sebagai tagihan dasar, `SUM(finance_charge_events.amount)` sebagai kewajiban Extend/Overtime, `SUM(payments.amount)` sebagai penerimaan bruto, dan `SUM(finance_refunds.amount)` sebagai pengurang penerimaan bersih. Settlement wajib memenuhi `payments - refunds = price_snapshot + charge_events`.
- `check_out_transaction(uuid)` mengambil `FOR UPDATE` pada transaksi, charge event, payment, dan refund mutations memakai lock transaksi yang sama, memvalidasi operator melalui `can_frontdesk`, status `check_in`, tagihan valid, lalu mensyaratkan equality settlement. Kurang bayar dan lebih bayar menghasilkan error eksplisit.
- Trigger `payments_transaction_state_guard_trigger` mengambil lock transaksi pada INSERT/UPDATE/DELETE payment dan menolak mutation setelah `check_out`/`cancelled`, sehingga payment yang kalah race tidak masuk setelah checkout.
- Hotfix final menambahkan guard null-safe pada UPDATE charge/refund: `transaction_id` settlement tidak dapat dipindahkan ke transaksi lain. INSERT/UPDATE/DELETE tetap mengambil lock transaksi yang dirujuk dan menolak state tertutup; formula tetap `gross payments - refunds = price_snapshot + charge_events`.
- Setelah settlement PASS, transisi resmi tetap `rooms.occupied → dirty`, `transactions.check_in → check_out`, `checked_out_at`, dan satu activity log. Check-out kedua ditolak oleh status guard.
- Training tetap memakai `check_out_training_transaction(uuid, uuid)`; wrapper menetapkan konteks session assigned sebelum memanggil RPC hardened. Dual identity dan audit Training tetap dipertahankan.
- Runtime PostgreSQL disposable PASS untuk lunas, unpaid, DP-only, gabungan, Extend/Overtime, refund, unrelated/unrecorded payment, invalid amount, duplicate, unauthorized operator, post-checkout payment mutation, concurrency, Housekeeping, dan Training. Migration belum dijalankan remote.

### FASE A integrasi desain v0 — 2026-10-19

Referensi v0 adalah proyek Next.js/React terpisah dengan mock data preview. Source aplikasi asli tetap menjadi sumber fungsi/data. FASE A menambahkan token visual navy/gold oklch di `src/styles.css` dan mengadaptasi presentasi shared Sidebar/Layout pada `src/components/kerangka.tsx`; permission, route, auth, Emergency, live query, RPC, dan data tidak dipindahkan dari v0.

Dashboard v0 memiliki referensi lengkap; komponen `RoomCards`/`mock-data` tidak disalin karena bertentangan dengan tabel P0-02. Login dan halaman operasional selain Dashboard tidak memiliki referensi v0 khusus yang dapat dibuktikan. Matriks lengkap ada di `DOKUMEN_PROYEK/06_MATRIKS_DESAIN_V0.md`.

### FASE B Dashboard v0 — 2026-10-19

`src/routes/index.tsx` kini memakai Hero navy/gold, KPI cards, Activity Feed, Revenue Chart, Payment Breakdown, dan Quick Actions dengan data live aplikasi asli. Revenue berasal dari `payments`; breakdown berasal dari method payment dan `finance_expenses` sesuai akses; Activity berasal dari `activity_logs` dan `employees` untuk Owner. Tidak ada import `mock-data.ts`, foto, cuaca, atau pencarian v0. Tabel P0-02 dan mutation P0-02B tetap berada pada source yang sama.

Browser visual belum diuji. FASE B Dashboard selesai secara lokal; Login dan halaman lain tidak dikerjakan karena tidak memiliki referensi v0 khusus.

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

## Reconciliation Staging dari CSV Owner — 2026-10-15

### Validasi input

File dibaca langsung dari `C:\Users\USER\Downloads\Baturaden25_Staging_Metadata (1).csv` dengan short-name Windows `BATURA~2.CSV` untuk akses shell. Header tepat `category,details`; 245 baris total berarti 244 metadata rows. Hitungan kategori:

| Category | Rows |
|---|---:|
| `tables` | 11 |
| `columns` | 94 |
| `constraints` | 53 |
| `indexes` | 22 |
| `functions` | 25 |
| `triggers` | 21 |
| `policies` | 18 |
| Total metadata | 244 |

CSV hanya berisi catalog metadata dan tidak membaca row bisnis/tamu.

### Schema Staging yang terbukti sesuai

Tabel yang terlihat tepat 11: `activity_logs`, `employees`, `guests`, `package_price_history`, `package_room_type_prices`, `packages`, `payments`, `room_types`, `rooms`, `transactions`, `user_roles`.

Metadata mendukung rekonstruksi baseline berikut:

- Drizzle `0000` core tables dan enum identity/role/status tersedia.
- Drizzle `0005` `payments` tersedia dengan amount/method/kind/recorded_by dan FK transaction.
- `package_room_type_prices` tersedia dengan 27-katalog-compatible columns, unique `(package_id, pricing_group)`, price checks, dan read policy.
- Pricing/timing columns tersedia: package weekday/weekend price, `time_mode`, slot/check-in/checkout times, room `pricing_group`, transaction `day_mode`, `scheduled_check_in`, `scheduled_check_out`, `started_at`, `ends_at`, dan `checked_out_at`.
- Booking constraints/indexes tersedia, termasuk `transactions_scheduled_stay_valid`, `transactions_room_scheduled_check_in_idx`, dan `transactions_room_scheduled_window_idx`.
- Existing trigger surface berisi audit, `updated_at`, room transition, dan transaction identity triggers; tidak ada Finance trigger pada snapshot.

### Schema Staging yang terbukti belum sesuai Finance 150

#### Relation dan columns

Tidak terlihat `operational_calendar`, seluruh 11 tabel Finance Foundation, atau `finance_reservation_idempotency` dari Finance 150 Compatibility. Dengan demikian belum ada:

- `finance_settings`, `finance_commission_configs`, `finance_bank_accounts`;
- `finance_cash_sessions`, `finance_session_allocations`, `finance_drawer_handoffs`;
- `finance_expenses`, `finance_deposits`, `finance_charge_events`;
- `finance_refunds`, `finance_refund_allocations`, `finance_reservation_idempotency`.

`payments` belum memiliki kolom Finance Foundation: `cash_session_id`, `idempotency_key`, `charge_event_id`, commission mode/rate/per-room/rounding/recipient/amount. `transactions` belum memiliki commission snapshot columns maupun Finance 150 minimum-DP snapshot columns: `minimum_dp_mode_snapshot`, `minimum_dp_value_snapshot`, `minimum_dp_amount_snapshot`.

#### Functions/RPC

CSV menunjukkan hanya satu `create_reservation` dengan 10 args:

`(_mode, _room_id, _package_id, _name, _phone, _address, _amount, _method, _day_mode, _scheduled_check_in)`.

Target Finance 150 menggantinya dengan 12 args melalui migration 150001/150002, menambahkan `_idempotency_key` dan `_session_id`. CSV juga hanya menunjukkan `record_transaction_payment(uuid,numeric,text)`, sedangkan target berurutan menjadi 4 args pada Foundation lalu 5 args pada Compatibility.

Function Finance yang tidak terlihat antara lain `open_finance_cash_session`, `close_finance_cash_session`, `get_finance_session_summary`, `record_finance_expense`, `create_finance_deposit`, `decide_finance_deposit`, `create_finance_refund`, commission/settings/bank RPCs, `finance_is_owner_or_supervisor`, `finance_is_booking_operator`, dan Finance trigger functions. `get_operational_day_mode(date)` juga tidak terlihat, padahal dipakai authoritative-day-mode dan Finance 150 reservation path.

Existing `check_in_booking(uuid)` dan `record_transaction_payment(uuid,numeric,text)` adalah dependency/compatibility boundary, bukan bukti Finance sudah aktif.

Untuk `create_reservation` dan `record_transaction_payment`, CSV hanya menunjukkan satu signature masing-masing. Tidak ada bukti overload 12/5 parameter atau duplicate overload pada snapshot; status function owner/body/search_path/grants tetap memerlukan query supplement.

#### Policies, grants, triggers, dan indexes

- 18 policy yang terlihat masih berupa baseline/operational policies; tidak ada `finance_*` policy dan tidak ada Supervisor Finance read policies dari migration 150002.
- `package_room_type_prices_read` sudah ada, tetapi privilege table-level dan routine-level grants tidak tercakup lengkap oleh CSV.
- 21 trigger yang terlihat hanya audit, timestamp, room transition, dan transaction identity. Tidak ada `finance_prepare_payment_trigger`, booking payment guard, final-session guard, DP snapshot trigger, atau refund-source guard.
- 22 index yang terlihat mencakup primary/unique baseline dan scheduled-booking indexes. Tidak ada `payments_idempotency_key_unique`, Finance session/deposit/commission indexes, atau idempotency transaction index.
- Existing `transactions_insert` memakai helper `can_frontdesk`; Finance 150002 menulis ulang policy untuk Owner/Receptionist dan menambahkan Supervisor read-only policies. Semantik `can_frontdesk` serta grants efektif belum cukup dibuktikan dari CSV.

### Risiko terhadap data existing

1. Mengganti `create_reservation` 10 → 12 args dan payment RPC 3 → 5 args dapat memutus PostgREST callers atau meninggalkan overload ambigu bila signature lama tidak ditangani secara tepat.
2. Finance payment trigger akan memperkaya existing `payments` dan memerlukan cash session OPEN. Existing payment rows tidak boleh dipaksa memiliki session/idempotency/commission snapshot tanpa strategi backfill yang disetujui.
3. DP guard dan transaction snapshot trigger dapat menolak booking/payment lama bila diterapkan sebagai constraint retroaktif tanpa audit null/invalid values.
4. Finance closing/refund functions mengunci `finance_cash_sessions`, allocations, payments, expenses, and refunds; belum ada objek untuk diuji terhadap data Staging dan tidak boleh diasumsikan kosong.
5. RLS/policy replacement dapat memperluas atau mengurangi akses Supervisor/Receptionist; `auth.uid()`, JWT claim mapping, function owner, `SECURITY DEFINER`, `search_path`, table privileges, dan routine privileges belum seluruhnya ada di snapshot.
6. Tidak adanya migration-history rows pada snapshot ini belum dapat disimpulkan karena CSV tidak memiliki category `migration_history`; provenance remote tetap belum terbukti.

### Dependency chain yang harus dipenuhi

Untuk Finance 150 minimum, dependency yang terbukti/kurang adalah:

| Dependency | Status CSV |
|---|---|
| Drizzle baseline 0000–0005 | Terbukti melalui 11 tabel/columns/constraints existing. |
| Pricing group + package room prices | Terbukti melalui `room_types.pricing_group` dan `package_room_type_prices`. |
| Scheduled booking 0007–0009 | Terbukti melalui columns, constraints, indexes, dan 10-arg reservation. |
| `operational_calendar` + `get_operational_day_mode` | Tidak terlihat; blocker untuk authoritative day mode/Finance reservation. |
| Employee position/role helpers | Sebagian terlihat; exact body/grants/enum labels perlu catalog query. |
| Finance Foundation 11 tables/columns/triggers/RLS | Tidak terlihat; blocker utama. |
| Finance 150 idempotency/DP/payment/refund compatibility | Tidak terlihat; blocker utama. |
| Supervisor alignment/RPC 12 args/policies | Tidak terlihat; blocker utama. |

### Perubahan yang dapat dibuktikan aman sekarang

- Tidak ada perubahan database yang aman untuk dieksekusi hanya dari snapshot ini.
- Aman secara analitis: mempertahankan seluruh 11 tabel dan data existing; memperlakukan Staging sebagai baseline pre-Finance; menyiapkan diff/plan forward-only; meminta metadata catalog tambahan tanpa row data.
- Tidak aman tanpa metadata tambahan: membuat Finance tables, menambah payment/transaction columns, memasang triggers, mengganti RPC signatures, mengubah policies/grants, atau menandai migration history.

### Satu paket metadata tambahan SELECT-only — LEGACY SPLIT (SUPERSEDED)

CSV sudah cukup untuk memastikan baseline dan gap relation/function signature, sehingga query berikut hanya melengkapi function identity/body attributes, trigger targets, RLS flags, grants, enum labels, target-object presence, dan migration-history existence. Semua statement SELECT/read-only; tidak membaca row bisnis atau data tamu.

```sql
-- Finance 150 Staging reconciliation supplement — SELECT ONLY
SELECT n.nspname AS schema_name,
       c.relname AS relation_name,
       c.relkind,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'supabase_migrations')
  AND (c.relname IN (
    'operational_calendar',
    'finance_settings', 'finance_commission_configs', 'finance_bank_accounts',
    'finance_cash_sessions', 'finance_session_allocations', 'finance_drawer_handoffs',
    'finance_expenses', 'finance_deposits', 'finance_charge_events',
    'finance_refunds', 'finance_refund_allocations', 'finance_reservation_idempotency'
  ) OR n.nspname = 'supabase_migrations');

SELECT p.oid::regprocedure AS identity_signature,
       n.nspname AS schema_name,
       p.proname,
       pg_get_function_identity_arguments(p.oid) AS identity_arguments,
       pg_get_function_result(p.oid) AS result_type,
       p.prosecdef AS security_definer,
       pg_get_userbyid(p.proowner) AS owner_name,
       p.proconfig,
       pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'create_reservation', 'record_transaction_payment', 'check_in_booking',
    'get_operational_day_mode', 'open_finance_cash_session',
    'close_finance_cash_session', 'get_finance_session_summary',
    'record_finance_expense', 'create_finance_deposit', 'decide_finance_deposit',
    'create_finance_refund', 'set_finance_settings',
    'set_finance_commission_config', 'upsert_finance_bank_account',
    'finance_is_owner_or_supervisor', 'finance_is_booking_operator',
    'finance_prepare_payment', 'finance_booking_payment_guard',
    'finance_final_session_guard', 'finance_snapshot_booking_dp',
    'finance_refund_source_session_guard'
  )
ORDER BY p.proname, p.oid::regprocedure::text;

SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       t.tgname AS trigger_name,
       t.tgenabled,
       pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE NOT t.tgisinternal
  AND n.nspname = 'public'
  AND (c.relname IN (
    'payments', 'transactions', 'finance_cash_sessions', 'finance_expenses',
    'finance_deposits', 'finance_refunds'
  ) OR t.tgname ILIKE '%finance%')
ORDER BY c.relname, t.tgname;

SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN (
    'payments', 'transactions', 'package_room_type_prices', 'operational_calendar',
    'finance_settings', 'finance_cash_sessions', 'finance_session_allocations',
    'finance_expenses', 'finance_deposits', 'finance_refunds'
  )
ORDER BY table_name, grantee, privilege_type;

SELECT routine_schema, routine_name, specific_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN (
    'create_reservation', 'record_transaction_payment', 'check_in_booking',
    'open_finance_cash_session', 'close_finance_cash_session',
    'get_finance_session_summary', 'create_finance_refund'
  )
ORDER BY routine_name, specific_name, grantee, privilege_type;

SELECT to_regclass('supabase_migrations.schema_migrations') AS schema_migrations_relation,
       to_regclass('public.operational_calendar') AS operational_calendar_relation,
       to_regclass('public.finance_cash_sessions') AS finance_cash_sessions_relation,
       to_regclass('public.finance_reservation_idempotency') AS finance_idempotency_relation;
```

Enum labels are queried separately with the correct namespace column:

```sql
SELECT t.typname AS enum_name, e.enumsortorder, e.enumlabel
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
  AND t.typname IN ('app_role', 'employee_position', 'room_status', 'transaction_status')
ORDER BY t.typname, e.enumsortorder;
```

### Satu paket metadata SELECT-only — CURRENT ONE-RESULT-SET EXPORT

Gunakan hanya query berikut untuk ekspor CSV. Query menghasilkan satu result set dengan tepat dua kolom: `category` dan `details` JSONB. Paket split di atas dipertahankan hanya sebagai riwayat dan tidak dipakai untuk ekspor baru.

```sql
WITH target_relations(object_name) AS (
  VALUES
    ('public.operational_calendar'::text),
    ('public.finance_settings'::text),
    ('public.finance_commission_configs'::text),
    ('public.finance_bank_accounts'::text),
    ('public.finance_cash_sessions'::text),
    ('public.finance_session_allocations'::text),
    ('public.finance_drawer_handoffs'::text),
    ('public.finance_expenses'::text),
    ('public.finance_deposits'::text),
    ('public.finance_charge_events'::text),
    ('public.finance_refunds'::text),
    ('public.finance_refund_allocations'::text),
    ('public.finance_reservation_idempotency'::text),
    ('public.cash_sessions'::text),
    ('public.cash_session_entries'::text),
    ('supabase_migrations.schema_migrations'::text)
),
target_tables(table_name) AS (
  VALUES
    ('payments'::text),
    ('transactions'::text),
    ('package_room_type_prices'::text),
    ('operational_calendar'::text),
    ('finance_settings'::text),
    ('finance_commission_configs'::text),
    ('finance_bank_accounts'::text),
    ('finance_cash_sessions'::text),
    ('finance_session_allocations'::text),
    ('finance_drawer_handoffs'::text),
    ('finance_expenses'::text),
    ('finance_deposits'::text),
    ('finance_charge_events'::text),
    ('finance_refunds'::text),
    ('finance_refund_allocations'::text),
    ('finance_reservation_idempotency'::text)
),
target_routines(routine_name) AS (
  VALUES
    ('create_reservation'::text),
    ('record_transaction_payment'::text),
    ('check_in_booking'::text),
    ('get_operational_day_mode'::text),
    ('open_finance_cash_session'::text),
    ('close_finance_cash_session'::text),
    ('confirm_finance_drawer_handover'::text),
    ('get_finance_session_summary'::text),
    ('record_finance_expense'::text),
    ('create_finance_deposit'::text),
    ('decide_finance_deposit'::text),
    ('create_finance_refund'::text),
    ('set_finance_settings'::text),
    ('set_finance_commission_config'::text),
    ('upsert_finance_bank_account'::text),
    ('finance_is_owner_or_supervisor'::text),
    ('finance_is_booking_operator'::text),
    ('finance_prepare_payment'::text),
    ('finance_booking_payment_guard'::text),
    ('finance_final_session_guard'::text),
    ('finance_snapshot_booking_dp'::text),
    ('finance_refund_source_session_guard'::text)
)
SELECT category, details
FROM (
  SELECT
    'relation_flags'::text AS category,
    jsonb_build_object(
      'schema_name', n.nspname,
      'relation_name', c.relname,
      'relkind', c.relkind,
      'rls_enabled', c.relrowsecurity,
      'rls_forced', c.relforcerowsecurity
    ) AS details
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public', 'supabase_migrations')
    AND (
      n.nspname = 'supabase_migrations'
      OR format('%I.%I', n.nspname, c.relname) IN (
        SELECT object_name FROM target_relations
      )
    )

  UNION ALL

  SELECT
    'function_metadata'::text AS category,
    jsonb_build_object(
      'identity_signature', p.oid::regprocedure::text,
      'schema_name', n.nspname,
      'routine_name', p.proname,
      'identity_arguments', pg_get_function_identity_arguments(p.oid),
      'result_type', pg_get_function_result(p.oid),
      'security_definer', p.prosecdef,
      'owner_name', pg_get_userbyid(p.proowner),
      'search_path_config', to_jsonb(p.proconfig),
      'function_definition', pg_get_functiondef(p.oid)
    ) AS details
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (SELECT routine_name FROM target_routines)

  UNION ALL

  SELECT
    'trigger_metadata'::text AS category,
    jsonb_build_object(
      'schema_name', n.nspname,
      'table_name', c.relname,
      'trigger_name', t.tgname,
      'enabled', t.tgenabled,
      'trigger_definition', pg_get_triggerdef(t.oid)
    ) AS details
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE NOT t.tgisinternal
    AND n.nspname = 'public'
    AND (
      c.relname IN (SELECT table_name FROM target_tables)
      OR t.tgname ILIKE '%finance%'
    )

  UNION ALL

  SELECT
    'table_grant'::text AS category,
    jsonb_build_object(
      'table_schema', tp.table_schema,
      'table_name', tp.table_name,
      'grantor', tp.grantor,
      'grantee', tp.grantee,
      'privilege_type', tp.privilege_type,
      'is_grantable', tp.is_grantable
    ) AS details
  FROM information_schema.table_privileges tp
  WHERE tp.table_schema = 'public'
    AND tp.table_name IN (SELECT table_name FROM target_tables)

  UNION ALL

  SELECT
    'routine_grant'::text AS category,
    jsonb_build_object(
      'routine_schema', rp.routine_schema,
      'routine_name', rp.routine_name,
      'specific_name', rp.specific_name,
      'grantor', rp.grantor,
      'grantee', rp.grantee,
      'privilege_type', rp.privilege_type,
      'is_grantable', rp.is_grantable
    ) AS details
  FROM information_schema.routine_privileges rp
  WHERE rp.routine_schema = 'public'
    AND rp.routine_name IN (SELECT routine_name FROM target_routines)

  UNION ALL

  SELECT
    'enum'::text AS category,
    jsonb_build_object(
      'enum_schema', n.nspname,
      'enum_name', t.typname,
      'sort_order', e.enumsortorder,
      'label', e.enumlabel
    ) AS details
  FROM pg_type t
  JOIN pg_enum e ON e.enumtypid = t.oid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public'
    AND t.typname IN ('app_role', 'employee_position', 'room_status', 'transaction_status')

  UNION ALL

  SELECT
    'object_presence'::text AS category,
    jsonb_build_object(
      'object_name', tr.object_name,
      'exists', to_regclass(tr.object_name) IS NOT NULL
    ) AS details
  FROM target_relations tr

  UNION ALL

  SELECT
    'migration_history'::text AS category,
    jsonb_build_object(
      'relation_name', 'supabase_migrations.schema_migrations',
      'exists', to_regclass('supabase_migrations.schema_migrations') IS NOT NULL,
      'rows_read', false,
      'note', 'Only relation existence is inspected; migration rows are not read by this package.'
    ) AS details
) AS metadata
ORDER BY category, details::text;
```

### Export correction note — 2026-10-15

Paket sebelumnya terdiri dari beberapa `SELECT`, sehingga ekspor CSV hanya menangkap satu result set terakhir pada sebagian jalur SQL Editor. Solusinya adalah query current di atas: seluruh kategori digabung dengan `UNION ALL` menjadi satu result set konsisten (`category`, `details`). Jika `information_schema` atau definisi function tidak terlihat karena privilege caller, baris yang hilang harus dilaporkan sebagai keterbatasan visibility; query ini tidak mengarang hasil dan tidak membaca data bisnis.

### Incremental reconciliation plan — not executed

1. Confirm target identity and collect the supplement above; do not inspect business rows.
2. Diff exact object identities against Drizzle `0000–0005`, Supabase prerequisites through `06014`, and Finance `15000–15003`.
3. Preserve the 11 existing relations; do not replay the 43-file chain or mark history by table count.
4. If Owner later authorizes writes, create/review a forward-only prerequisite package for `operational_calendar` and Finance Foundation, with explicit guards and a rollback/backup plan.
5. Reconcile `payments`/`transactions` columns and constraints only after null/invalid-value checks and a decision for legacy rows.
6. Replace RPCs only as an atomic compatibility cutover: verify callers, drop exact old signatures only when approved, install 12/5-argument functions, then verify grants/RLS and PostgREST resolution.
7. Add Finance triggers/policies/grants after relation/column creation, then run targeted non-business smoke checks in Staging. No step in this plan has been executed.

## Latest Staging reconciliation checkpoint — 2026-10-15

- CSV evidence: **VALID**; 244 metadata rows across 7 categories.
- Baseline/scheduled schema: **MATCHES RECONSTRUCTION**.
- Finance 150 target: **NOT PRESENT / NOT SELARAS** in the snapshot.
- Concrete blockers: Finance relations and columns absent; `operational_calendar`/authoritative-day-mode absent; RPCs remain legacy 10/3 args; Finance triggers/policies/indexes/grants absent or not represented; function/trigger/privilege details incomplete.
- Reconciliation progress: **40%** — catalog snapshot validated/diffed and local SELECT-only preflight package prepared; incremental write plan not executed.
- No source, migration SQL, database, `.env`, project reference, commit, push, deploy, or application test was changed/run.
- Next minimum action: obtain the supplement query result through the approved read-only Staging channel, then produce the exact forward-only reconciliation package for Owner review.

## Staging reconciliation preparation checkpoint — 2026-10-15

- Local review file: `supabase/reconciliation/finance150_staging_preflight.sql`.
- File type: SELECT-only catalog preflight; no DDL/DML, no row reads, no migration execution.
- Scope: relation flags, Finance column presence, function signatures/owner/search path/body, overload count, trigger definitions, RLS policies, table/routine grants, enum labels, object presence, and migration-history relation existence.
- Execution status: **NOT RUN**.
- Reconciliation package status: **PREPARED FOR REVIEW**, not ready for database execution because backup/rollback, relation flags, exact grants/RLS, trigger details, and legacy data compatibility remain blockers.
- Next checkpoint: collect preflight result through the approved read-only Staging channel, then draft the forward-only migration package without editing historical migrations.

## Finance 150 forward-only package checkpoint — 2026-10-15

File review lokal yang dibuat:

- `supabase/reconciliation/finance150_staging_reconciliation_review.sql` — paket phase-gated forward-only: preconditions, calendar prerequisite, Finance Foundation, Compatibility, Supervisor Alignment, grants/RLS, RPC cutover, legacy-data decision, rollback, dan smoke-test plan. Isinya review specification/commented execution contract; tidak dieksekusi.
- `supabase/reconciliation/finance150_staging_legacy_preflight.sql` — SELECT-only aggregate preflight untuk 11 RLS flags, kualitas legacy `payments`/`transactions`, identitas database, dan kebutuhan backup/backfill. Tidak mengembalikan row individual.

### Urutan dependency dan cutover

1. Preflight identity, relation flags, exact signatures, RLS/grants, trigger definitions, dan aggregate legacy quality.
2. Backup/PITR provider dan rollback owner wajib terkonfirmasi; statusnya tidak dapat dibuktikan dari katalog publik.
3. Operational calendar (`06011–06014`) harus tersedia karena Finance 150 memakai `get_operational_day_mode`.
4. Finance Foundation membuat 11 relation Finance, columns, triggers, RLS, dan RPC dasar.
5. Booking Compatibility membuat idempotency/DP snapshots, lalu mengganti payment 3/4 args menjadi 5 args dan reservation 10 args menjadi 12 args.
6. Supervisor Alignment mengganti function yang disetujui dan menambah policy read-only Supervisor.
7. Reference grants diterapkan terakhir; verifikasi PostgREST/RLS/privilege dilakukan sebelum smoke test.

Tidak ada backfill yang diasumsikan aman. Existing payment/transaction rows harus dinilai melalui aggregate preflight; legacy NULL snapshot/session fields dipertahankan atau dibackfill hanya setelah keputusan Owner. RPC cutover harus atomic agar tidak meninggalkan overload ambigu.

### Blocker sebelum eksekusi

- Relation flags 11 tabel existing belum tersedia pada CSV resmi terakhir.
- Aggregate legacy compatibility belum tersedia.
- Backup/PITR dan rollback owner belum terbukti.
- Exact table/routine grants, RLS flags, trigger definitions, dan function identity target belum lengkap.
- Tidak boleh mengeksekusi Finance Foundation atau RPC cutover sebelum blocker tersebut selesai.

Progress reconciliation: **50%** — diff Staging, phase-gated review package, legacy aggregate guard, dan backup/rollback procedure sudah disiapkan; tidak ada write package yang dieksekusi.

### Backup, restore, dan rollback untuk Supabase Free Plan

- PITR dan downloadable Dashboard backup **tidak diasumsikan tersedia** pada Free Plan. Official Supabase guidance menyarankan logical export berkala dengan Supabase CLI `db dump` dan penyimpanan off-site; backup Dashboard yang dapat diunduh tidak tersedia pada Free Plan.
- Sebelum write: Owner harus membuat logical dump melalui kanal resmi, menyimpan artefak di luar repository, mencatat checksum/waktu/target, dan memverifikasi dump dapat dipulihkan ke PostgreSQL terisolasi tanpa credential masuk ke repo.
- Restore test: pulihkan dump ke database disposable/local isolated, jalankan pemeriksaan schema/catalog dan smoke query, lalu simpan bukti checksum/restore terpisah.
- Rollback sebelum commit transaksi migration: gunakan abort/rollback transaksi bila seluruh package memang atomic.
- Rollback setelah commit: jangan mengandalkan PITR Free Plan; hentikan aplikasi/write, simpan error/catalog state, lalu gunakan logical restore ke target yang dipulihkan sesuai prosedur Owner/provider. Restore langsung ke Staging memerlukan keputusan Owner karena dapat mengganti state existing.
- Status sekarang: **BLOCKED BACKUP/PITR**. Tidak ada backup, restore, migration, atau database mutation yang dilakukan oleh sesi ini.

## Backup/restore test checkpoint — 2026-10-15

- Target tetap `Baturaden-25-Staging` / `bgtztcfbkcrvcipxbfti`; project lama `ijujmxhcifuerkllbbgq` tidak digunakan.
- Local `pg_dump.exe`, `pg_restore.exe`, dan `psql.exe` tersedia dari `.tools/postgresql-test/runtime/pgsql/bin`.
- Docker tidak tersedia di PATH/known location.
- Supabase CLI system-wide tidak tersedia. Bundle CLI sementara ada, tetapi `--version` gagal karena mencoba menulis telemetry di `C:\Users\USER\.supabase`; tidak ada CLI session tersimpan.
- `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_URL`, dan `SUPABASE_DB_PASSWORD` tidak tersedia di environment. Tidak ada credential yang diminta atau ditampilkan di chat.
- Backup dan restore test: **NOT RUN / BLOCKED**. Tidak ada remote connection, backup file, restore target, atau resource sementara yang dibuat.
- Satu instruksi Owner: autentikasi Supabase CLI secara lokal atau siapkan koneksi DB resmi untuk ref `bgtztcfbkcrvcipxbfti` di credential store/secure environment Windows; jangan mengirim token/password ke chat. Setelah itu backup dapat dijalankan dengan `supabase db dump --db-url ...` atau jalur CLI resmi tanpa mengubah `supabase/config.toml`.

### Backup attempt checkpoint — credential file mismatch

`staging.pgpass` ada dan ukurannya 96 bytes, tetapi `psql` tetap mengembalikan `fe_sendauth: no password supplied` untuk host `aws-0-ap-northeast-1.pooler.supabase.com`, port `5432`, database `postgres`, user `postgres.bgtztcfbkcrvcipxbfti`. Ini menunjukkan entry file tidak cocok atau tidak diterima libpq untuk target tersebut. Isinya tidak dibaca/dicetak. Backup dan restore tetap **FAIL/NOT RUN**; file dipertahankan agar Owner memperbaiki mapping secara lokal.

### Supabase Support checkpoint — 2026-10-15

- Tiket resmi Support sudah terkirim untuk Baturaden-25-Staging; dashboard mengonfirmasi tiket tercatat.
- Balasan Support belum diterima; masalah autentikasi belum selesai.
- Dump `staging-20261015-011556.dump` berukuran 0 byte dan invalid; tidak ada checksum valid.
- Restore test belum dilakukan.
- Finance 150 migration ke Staging tetap dilarang sampai backup valid dan restore lokal terisolasi PASS.
- Jangan mengulang rangkaian koneksi identik; gunakan diagnosis baru dari Support sebagai perubahan keadaan berikutnya.

### Support ticket update — 15 Oktober 2026

- Ticket: `SU-508298`.
- Project: Baturaden-25-Staging, ref `bgtztcfbkcrvcipxbfti`.
- Supabase mengirim email konfirmasi penerimaan tiket pada 15 Oktober 2026.
- Email tersebut otomatis dan hanya mengonfirmasi penerimaan, bukan penyelesaian masalah.
- Status: **MENUNGGU RESPONS TEKNIS SUPABASE SUPPORT**.
- Paket Free tidak memiliki jaminan waktu respons.
- Backup/restore tetap **BLOCKED**; Finance 150 migration tetap dilarang sebelum backup valid dan restore terisolasi PASS.

## Checkpoint source Dashboard dan resolver sesi kas — 2026-10-16

Referensi visual Dashboard terbaru Owner: `C:\Users\USER\Downloads\Dasbor Manajemen Homestay Modern.png`. Komponen `src/components/dashboard-modern.tsx` dan kerangka `src/components/kerangka.tsx` harus mempertahankan struktur visual referensi: header search/notifikasi/profil, panel sambutan + kalender + lima KPI, Kamar Terisi + Log Activity, dan tiga panel analitik. Source memakai data live; angka/identitas ilustrasi bukan data produksi.

Keputusan visual yang harus dipertahankan: biru/pastel sebagai identitas; Standard biru pastel; Superior A/B hijau pastel; Deluxe kuning pastel; Check-out merah; TRX pada kartu kamar membuka detail; Log Activity timeline ikon berwarna + waktu; Grafik Pendapatan batang biru dengan filter Harian/Mingguan/Bulanan/Tahunan; Emergency horizontal merah dengan bingkai hitam tipis; Pengaturan di header; Owner/Keluar di sidebar dihapus; logout melalui profil; aksi Check-in Langsung dan Buat Booking.

Resolver `src/lib/sesi-kas.ts` menyatukan konteks sesi untuk `formulir-pemesanan.tsx`, `booking.tsx`, dan `keuangan.tsx`. Urutan konteks adalah sesi `OPEN` milik operator, konteks bantuan Owner/Supervisor yang dipilih di Keuangan, atau satu-satunya sesi `OPEN`. Jika tidak ada sesi sah/konteks bantuan valid, UI memblokir penyimpanan dan tidak membuka sesi baru. `auth.uid()`/`recorded_by` adalah operator aktual; `finance_cash_sessions.opened_by` adalah pemilik sesi. Session storage hanya membawa ID konteks non-rahasia dan bukan batas otorisasi.

Status verifikasi: TypeScript, build, dan `git diff --check` lokal **PASS**. Visual browser belum dinyatakan PASS. Keamanan pemilihan sesi dan kecocokan RLS/RPC Staging belum diuji runtime; tidak ada perubahan database, migration, konfigurasi, atau deploy pada checkpoint ini.

## Status arsitektur live Staging — 2026-10-18

Bagian ini adalah status live terbaru dan supersedes label provisional `BELUM TERVERIFIKASI` pada ledger migration sebelumnya.

### Housekeeping dan Kalender

- `20261012000000_housekeeping_history.sql`, `20261013000000_housekeeping_checklists_maintenance.sql`, dan `20261014000000_official_transaction_housekeeping_numbers.sql`: **COMMIT di Staging**.
- `20261006000011_operational_calendar.sql`, `20261006000012_calendar_event_types.sql`, dan `20261006000013_seed_official_calendar.sql`: **COMMIT di Staging**.
- Kalender live berisi 51 tanggal unik: 35 `national_holiday` dan 16 `collective_leave`.
- `20261006000010_correct_p4_prices.sql` tetap **BLOCKED** dan tidak termasuk jalur Finance.

### Finance 150

- `20261015000000_finance_foundation.sql` sampai `20261015000003_booking_reference_read_privileges.sql`: **COMMIT di Staging**.
- Sebelas tabel Finance Foundation tersedia dengan RLS aktif; `finance_reservation_idempotency` tersedia sebagai compatibility table tambahan.
- Kontrak live final: `create_reservation` 12 parameter, `record_transaction_payment` 5 parameter, `check_in_booking(uuid)`, `check_out_transaction(uuid)`, dan `get_operational_day_mode(date)`.
- Signature lama 10/3 tidak lagi menjadi kontrak aktif.
- Audit source/katalog Finance **PASS** untuk idempotency, overlap/scheduled guard, payment guard, role checks, SECURITY DEFINER, `search_path`, RLS, policy, dan grants.
- Smoke test operasional Staging belum dilakukan; Finance belum production-ready.

### Dual identity dan Training Enforcement

- Model dual identity tersedia: `auth.uid()`/`recorded_by` adalah operator login, sedangkan `finance_cash_sessions.opened_by` adalah pemilik sesi kas.
- Aturan Training Owner telah final: akun sendiri, dua hari kalender, transaksi di bawah Owner/Supervisor, sesi kas penanggung jawab, larangan sesi sendiri, operator aktual, dan label audit `Training`.
- Rancangan Training Enforcement sudah selesai, tetapi implementasi belum dimulai. Belum ada assignment dua hari, helper/RPC server-side, larangan membuka sesi sendiri untuk peserta, atau label audit Training.
- Training Enforcement menjadi blocker penggunaan peserta Training; akun Training dan data uji belum dibuat.

### SOP dan status release

- Codex melakukan validasi teknis bertahap, read-only terlebih dahulu, tanpa mengulang 150 pengujian lokal.
- Owner menjalankan satu rangkaian pengujian menyeluruh setelah fitur wajib siap, termasuk Training Enforcement, lalu menyetujui cleanup data uji dan go-live.
- Status operasional sementara: **BELUM READY**.

### Training Enforcement — implementasi lokal 2026-10-18

Migration lokal `20261018000000_finance_training_enforcement.sql` menambahkan assignment Training dua hari berdasarkan tanggal Asia/Jakarta, status/resolusi Owner, audit berlabel `Training`, validasi sesi kas aktif milik Owner/Supervisor yang ditugaskan, serta guard agar peserta tidak membuka sesi sendiri. Helper role, wrapper RPC untuk reservasi/pembayaran/check-in/expense/deposit/summary, dan trigger audit memakai identitas operator dari `auth.uid()` serta mempertahankan model dual identity Finance 150.

Source lokal telah mengintegrasikan konteks Training ke peran, sesi kas, Booking, pembayaran/check-in, dan Finance. Pure tests, TypeScript, dan build **PASS**; lint file baru **PASS**, sedangkan lint repository **BLOCKED** oleh masalah format/CRLF lama. Migration belum dijalankan ke remote, smoke test runtime belum dilakukan, dan status operasional tetap **BELUM READY**.

### Koreksi enforcement setelah audit FAIL — 2026-10-18

Migration Training sekarang memasang guard backend pada transaksi, pembayaran, expense, deposit, sesi kas, allocation, handoff, charge, refund, dan konfigurasi Finance. Guard menolak mutation peserta tanpa konteks session assigned yang divalidasi terhadap assignment aktif, supervisor, status `OPEN`, dan tanggal Asia/Jakarta.

`can_frontdesk` dan summary legacy juga diperketat; `check_out_transaction` hanya dapat dipanggil peserta melalui `check_out_training_transaction`. Audit assignment/session/operator diturunkan server-side dan tidak lagi memakai `assignment_id` dari GUC. Sesi `OPEN` lama peserta tidak ditutup otomatis, tetapi semua penggunaan/mutation backend diblokir.

Pure negative tests, TypeScript, dan build **PASS**. SQL runtime lokal dan Staging **NOT TESTED**; lint dashboard masih terhambat format/CRLF lama. Status operasional tetap **BELUM READY**.

### SQL runtime Training lokal — 2026-10-18

Cluster PostgreSQL 17.11 temporary dibuat terisolasi, baseline dump lokal dipulihkan, 42 migration prasyarat dijalankan tanpa P4 `060010`, lalu Training migration berhasil COMMIT dan rerun idempotency PASS. Runtime membuktikan assignment dua hari, supervisor/session validation, blokir sesi lama, blokir RPC legacy, dual identity payment, check-out wrapper, audit server-side, serta regresi Owner/Receptionist.

Temuan runtime pada trigger Finance 150 `finance_prepare_payment` diperbaiki di migration Training agar sesi supervisor assigned sah bagi peserta tanpa mengubah `recorded_by` operator. Uji numbering lama pernah terhambat constraint baseline `BTRD25-######`; P0-01 kini menyiapkan migration forward-only yang mempertahankan format lama dan menetapkan generator `BTRDTRX-*`/`BTRDHK-*`/`BTRDEXP-*`. Fixture PostgreSQL disposable untuk migration baru PASS, termasuk safe start, preservasi nomor lama, default expense, dan ekspansi tujuh digit. Full baseline/Staging belum dijalankan, Staging/Production tidak disentuh, dan status tetap **BELUM READY**.


## Arsitektur runtime terverifikasi — checkpoint 21 Oktober 2026

- **Code path**: GitHub `main` → Lovable project editor `017f6e78-15f2-4d07-a38c-87cb185279bf`; latest SHA cocok `47e760b0`. Sinkronisasi editor tidak sama dengan tindakan publish/deploy.
- **Database aktual yang diuji**: Lovable Cloud Supabase dari project tersebut, bukan proyek Supabase Staging `bgtztcfbkcrvcipxbfti`; test demo tercatat live. Pertahankan mapping Owner/Supervisor/Auth.
- **Finance**: `finance_cash_sessions`, `finance_expenses`, allocation, refund, deposit dan summary/RPC; 12 tabel finance dengan RLS. RPC security-definer diperketat; 6 helper terpisah dicabut anon/PUBLIC dan tetap diizinkan untuk authenticated. Closing saldo minus disimpan di `closing_snapshot.expected_cash` tanpa alokasi negatif.
- **Nomorator**: trigger `transaction_identity_insert` memanggil SECURITY DEFINER `enforce_transaction_identity` → `next_transaction_number`; `housekeeping_jobs.job_number` dan `finance_expenses.expense_number` memiliki generator resmi independen. `anon` dan `authenticated` tidak dapat langsung EXECUTE 3 generator; `postgres` diizinkan. Transaksi historis tidak di-backfill; sequence transaksi di-seed dari legacy maks (19) sebelum penerbitan nomor 20.
- **Housekeeping runtime**: `advance_room_cleaning` mengecek role, active room berstatus `dirty`, lalu mencatat jobs + history dan status `cleaning`; belum smoke pada Lovable karena tidak ada dirty room. Dua HK history legacy tidak memiliki nomor.
- **Booking UI**: `useTable('transactions')` dan `useTable('guests')` dengan refresh keduanya pada save sukses; mencegah fallback `Tamu` dari cache lama. Frontend PR #10 merged, browser rerun belum dibuktikan.
- **Check-in**: `check_in_booking` SECURITY DEFINER memastikan booking, tamu/room/package, price/day_mode, tanggal jadwal Asia/Jakarta, pelunasan penuh, status room READY; lalu UPDATE status room occupied dan transaction check_in. **Pemeriksaan jam tepat scheduled_check_in belum ditegakkan oleh RPC** (tanggal saja) sehingga butuh hardening/keputusan implementasi sebelum dianggap lengkap.
- **Recovery**: backup `pixel-perfect-homestay-hub_261021.backup` custom PG berhasil restore application/Auth compatible via PG 17.11 portable; full platform restore/PITR belum teruji. Snapshot demo dan riwayat perubahan tidak boleh dibersihkan tanpa instruksi Owner.
- **Batas scope**: Finance dan nomorator LIVE, beberapa fitur Training/Checkout settlement/Dashboard bersifat lokal/branch dengan status masing-masing; tidak ada bukti seluruh pekerjaan lokal Codex otomatis sudah live. Rilis produksi operasional menunggu uji role, pelunasan, checkout, HK dan GO Owner.
