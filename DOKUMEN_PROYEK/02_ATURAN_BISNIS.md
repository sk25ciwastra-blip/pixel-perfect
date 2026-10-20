# Baturaden 25 Homestay V1.0 — Aturan Bisnis

**Tanggal pencatatan dokumen:** 2026-10-13<br>
**Sumber utama:** pernyataan Owner dalam konteks proyek, migrasi SQL lokal, verifikasi Staging yang dilaporkan, dan source aplikasi.<br>
**Catatan:** tanggal keputusan formal ditulis `BELUM TERVERIFIKASI` bila tidak ada tanggal eksplisit.

## Identitas aturan

Setiap aturan memiliki ID permanen. ID tidak boleh dipakai ulang atau diganti; revisi dibuat sebagai entri baru yang merujuk ID sebelumnya.

## Catatan validasi runtime

Pada 2026-10-13, aturan waktu sembilan paket, katalog 27 harga, pricing group Superior, P4 Standard 80.000/90.000, booking/check-in, overlap, locking, dan rollback diuji pada PostgreSQL portable terisolasi. Hasil pengujian tidak mengubah aturan bisnis dan tidak menjadi bukti bahwa Staging Cloud sudah berubah.

## Master kamar dan paket

| ID | Aturan | Status | Tanggal dicatat | Tanggal keputusan | Sumber | Fitur terkait |
|---|---|---|---|---|---|---|
| AB-ROOM-001 | Tipe kamar resmi: Standard, Superior A, Superior B, Deluxe. | TERUJI/DISETUJUI | 2026-10-13 | BELUM TERVERIFIKASI | Seed dan verifikasi Owner di Staging; migrasi `06002` | Master kamar |
| AB-ROOM-002 | Mapping kamar: Standard 06,07,08,09,12; Superior A 11; Superior B 02,03,04; Deluxe 05,10. Kamar 01 tidak diubah oleh mapping. | TERUJI/DISETUJUI | 2026-10-13 | BELUM TERVERIFIKASI | Migrasi `06003` dan verifikasi Staging | Master kamar, booking |
| AB-ROOM-003 | Superior A dan Superior B memakai pricing group `superior`. | TERUJI/DISETUJUI | 2026-10-13 | BELUM TERVERIFIKASI | Seed room type dan verifikasi Staging | Pricing kamar |
| AB-PACK-001 | Sembilan paket resmi: P2, P4, P6, P12, P24, PP/Paket Pagi, PM/Paket Malam, PH/Paket Harian, PW/Paket Mingguan. | TERUJI/DISETUJUI | 2026-10-13 | BELUM TERVERIFIKASI | Seed Owner dan verifikasi Staging | Master paket |
| AB-PACK-002 | Semua sembilan paket resmi aktif setelah seed awal Staging. | TERUJI/DISETUJUI | 2026-10-13 | BELUM TERVERIFIKASI | Verifikasi Owner di Staging | Master paket |

## Durasi dan timing paket

`slot_start_time` adalah waktu slot bila digunakan. `duration_minutes`, mode, dan jendela berikut adalah nilai yang tercatat pada aturan Owner dan migrasi canonical lokal.

| ID | Paket | Durasi | Mode | Slot | Jam check-in | Checkout | Status | Tanggal dicatat | Tanggal keputusan | Sumber / fitur |
|---|---|---:|---|---|---|---|---|---|---|---|
| AB-TIME-P2 | Paket 2 Jam | 120 menit | `duration_midnight_cap` | — | 06:00–23:30 | — | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Seed Owner, migrasi `00007`; timing paket |
| AB-TIME-P4 | Paket 4 Jam | 240 menit | `duration_midnight_cap` | — | 06:00–22:30 | — | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Koreksi Owner; timing paket |
| AB-TIME-P6 | Paket 6 Jam | 360 menit | `duration_midnight_cap` | — | 04:30–19:30 | — | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Koreksi Owner; timing paket |
| AB-TIME-P12 | Paket 12 Jam | 720 menit | `duration` | — | — | — | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Seed Owner; timing paket |
| AB-TIME-P24 | Paket 24 Jam | 1440 menit | `duration` | — | — | — | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Seed Owner; timing paket |
| AB-TIME-PP | Paket Pagi | 450 menit | `fixed_window` | 08:30 | 08:00–12:00 | 16:00 | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Seed Owner; timing paket |
| AB-TIME-PM | Paket Malam | 600 menit | `fixed_window` | 22:00 | 21:30–04:00 | 08:00 | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Seed Owner; timing paket |
| AB-TIME-PH | Paket Harian | 1380 menit | `fixed_window` | 13:00 | 12:00–04:00 | 12:00 | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Seed Owner; timing paket |
| AB-TIME-PW | Paket Mingguan | 10080 menit | `fixed_days_checkout` | — | — | 12:00 | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Seed Owner; timing paket |

## Harga resmi

Semua angka di bawah adalah `weekday/weekend` dalam Rupiah. Kolom package-level legacy `packages.price`, `weekday_price`, dan `weekend_price` menggunakan nilai Standard untuk kompatibilitas; katalog per tipe kamar menjadi sumber harga transaksi setelah migrasi `00005`.

| ID | Paket | Standard | Superior | Deluxe | Status | Tanggal dicatat | Tanggal keputusan | Sumber / fitur |
|---|---|---:|---:|---:|---|---|---|---|
| AB-PRICE-P2 | P2 / Paket 2 Jam | 70.000 / 80.000 | 80.000 / 90.000 | 90.000 / 100.000 | DISETUJUI OWNER, TERUJI | 2026-10-13 | BELUM TERVERIFIKASI | Migrasi `06005`, seed Owner; pricing |
| AB-PRICE-P4 | P4 / Paket 4 Jam | 80.000 / 90.000 | 90.000 / 100.000 | 100.000 / 110.000 | DISETUJUI OWNER, TERUJI | 2026-10-13 | BELUM TERVERIFIKASI | Seed Owner dan `06005`; P4 package-level dikoreksi 80.000/90.000 |
| AB-PRICE-P6 | P6 / Paket 6 Jam | 110.000 / 120.000 | 120.000 / 130.000 | 130.000 / 140.000 | DISETUJUI OWNER, TERUJI | 2026-10-13 | BELUM TERVERIFIKASI | Migrasi `06005`; pricing |
| AB-PRICE-P12 | P12 / Paket 12 Jam | 150.000 / 170.000 | 160.000 / 180.000 | 170.000 / 190.000 | DISETUJUI OWNER, TERUJI | 2026-10-13 | BELUM TERVERIFIKASI | Migrasi `06005`; pricing |
| AB-PRICE-P24 | P24 / Paket 24 Jam | 200.000 / 220.000 | 210.000 / 230.000 | 220.000 / 240.000 | DISETUJUI OWNER, TERUJI | 2026-10-13 | BELUM TERVERIFIKASI | Migrasi `06005`; pricing |
| AB-PRICE-PP | PP / Paket Pagi | 115.000 / 135.000 | 125.000 / 145.000 | 135.000 / 155.000 | DISETUJUI OWNER, TERUJI | 2026-10-13 | BELUM TERVERIFIKASI | Migrasi `06005`; pricing |
| AB-PRICE-PM | PM / Paket Malam | 125.000 / 145.000 | 135.000 / 155.000 | 145.000 / 165.000 | DISETUJUI OWNER, TERUJI | 2026-10-13 | BELUM TERVERIFIKASI | Migrasi `06005`; pricing |
| AB-PRICE-PH | PH / Paket Harian | 170.000 / 190.000 | 180.000 / 200.000 | 190.000 / 210.000 | DISETUJUI OWNER, TERUJI | 2026-10-13 | BELUM TERVERIFIKASI | Migrasi `06005`; pricing |
| AB-PRICE-PW | PW / Paket Mingguan | 800.000 / 800.000 | 1.000.000 / 1.000.000 | 1.200.000 / 1.200.000 | DISETUJUI OWNER, TERUJI | 2026-10-13 | BELUM TERVERIFIKASI | Migrasi `06005`; pricing |

**Catatan konflik yang wajib dipantau:** migrasi lokal `20261006000010_correct_p4_prices.sql` memuat koreksi P4 Standard menjadi 90.000/100.000. Nilai itu bertentangan dengan aturan package-level Owner yang dicatat di atas dan belum dianggap disetujui; migrasi tersebut belum termasuk status 22/40.

## Booking, check-in, dan pembayaran

| ID | Aturan | Status | Tanggal dicatat | Tanggal keputusan | Sumber | Fitur terkait |
|---|---|---|---|---|---|---|
| AB-BOOK-001 | Harga transaksi harus dihitung dari database melalui room → room type → pricing group → package → weekday/weekend; browser tidak menjadi sumber total transaksi. | DIKERJAKAN / SIAP UJI | 2026-10-13 | BELUM TERVERIFIKASI | Migrasi `00006`, `00008`, `00009` lokal; reservasi | Booking, pricing |
| AB-BOOK-002 | `transactions.price_snapshot` menyimpan total resmi yang dipilih saat transaksi. | DIKERJAKAN / SIAP UJI | 2026-10-13 | BELUM TERVERIFIKASI | Migrasi `00006–00009`; transaksi | Booking |
| AB-BOOK-003 | Booking membutuhkan tanggal/jam check-in terjadwal setelah alur scheduled booking dipasang. | DIKERJAKAN / SIAP UJI | 2026-10-13 | BELUM TERVERIFIKASI | Migrasi `00008–00009`; booking | Booking |
| AB-BOOK-004 | Kamar `occupied` boleh menerima booking masa depan jika interval tidak overlap; kamar harus aktif. | DIKERJAKAN / SIAP UJI | 2026-10-13 | BELUM TERVERIFIKASI | Migrasi `00009`; booking | Booking |
| AB-BOOK-005 | Booking ditolak jika overlap dengan booking lain atau transaksi `check_in` aktif pada kamar yang sama. Interval yang tepat berbatasan checkout diperbolehkan. | DIKERJAKAN / SIAP UJI | 2026-10-13 | BELUM TERVERIFIKASI | Review SQL `00009`; booking | Booking |
| AB-CHECK-001 | Check-in langsung harus membayar lunas; booking yang belum lunas tidak boleh di-check-in. | DIKERJAKAN / SIAP UJI | 2026-10-13 | BELUM TERVERIFIKASI | Migrasi `06001`, `00008`, `00009`; check-in | Check-in |
| AB-CHECK-002 | Check-in mengubah kamar ready menjadi occupied dan menyimpan waktu mulai/selesai berdasarkan paket. | DIKERJAKAN / SIAP UJI | 2026-10-13 | BELUM TERVERIFIKASI | Migrasi canonical/check-in; check-in | Check-in |
| AB-CHECK-003 | Check-out wajib menghitung ulang settlement database: `SUM(payments.amount) - SUM(finance_refunds.amount)` harus sama dengan `transactions.price_snapshot + SUM(finance_charge_events.amount)`. Kurang bayar dan lebih bayar ditolak; payment/charge/refund mutation mengambil lock transaksi dan ditolak setelah closed/cancelled. | DISETUJUI OWNER / SIAP UJI LOKAL | 2026-10-19 | 2026-10-19 | P0-02B correction dan migration `20261019000001_harden_checkout_payment_settlement.sql` | Check-out, pembayaran, Extend/Overtime, refund, Finance |
| AB-PAY-001 | Metode pembayaran yang ditemukan: Cash, QRIS, Transfer. | BELUM TERVERIFIKASI | 2026-10-13 | BELUM TERVERIFIKASI | Schema Drizzle dan RPC pembayaran; belum ada keputusan Owner bertanggal | Pembayaran |
| AB-PAY-002 | Payment dicatat terkait `transaction_id`; pembayaran tambahan tidak boleh melebihi sisa tagihan. | DIKERJAKAN / SIAP UJI | 2026-10-13 | BELUM TERVERIFIKASI | Migrasi `06000`; pembayaran | Pembayaran |
| AB-PAY-003 | `kind` pembayaran membedakan `dp` dan `payment`. | BELUM TERVERIFIKASI | 2026-10-13 | BELUM TERVERIFIKASI | Baseline Drizzle `0005` dan RPC reservasi; belum ada keputusan Owner bertanggal | Pembayaran |

## Rencana resmi enam area

| ID | Area / keputusan Owner | Status | Tanggal dicatat | Tanggal keputusan | Sumber | Fitur terkait |
|---|---|---|---|---|---|---|
| AB-PLAN-001 | Perencanaan resmi dipertahankan dalam enam area: DASHBOARD, ROOM, BOOKING, TRANSAKSI, FINANCE, dan TIM & AKSES. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Keputusan Owner pada pembaruan terpadu | Perencanaan proyek |
| AB-UI-DASH-001 | Menu Dashboard; kamar TERISI menampilkan countdown realtime dan diurutkan dari waktu tersisa paling pendek. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Keputusan Owner dan audit `src/routes/index.tsx` | Dashboard |
| AB-UI-DASH-010 | Dashboard memakai tabel `Kamar Sedang Terisi`, bukan kartu/foto kamar. Hanya transaksi `check_in` dengan kamar aktif berstatus `occupied` yang tampil; booking mendatang, ready, dirty, dan cleaning tidak tampil. | DISETUJUI OWNER | 2026-10-19 | 2026-10-19 | P0-02 Owner dan `src/routes/index.tsx` | Dashboard |
| AB-UI-DASH-011 | Tabel diurutkan berdasarkan sisa waktu paling sedikit. Countdown yang habis tetap tampil sebagai `WAKTU HABIS` sampai Check-out berhasil; status kamar tidak diubah otomatis oleh timer. | DISETUJUI OWNER | 2026-10-19 | 2026-10-19 | P0-02 Owner dan implementasi lokal | Dashboard |
| AB-UI-DASH-012 | Setiap baris memiliki tepat tiga aksi: Detail transaksi (biru), Hubungi WhatsApp (hijau), dan Check-out (merah). Aksi WhatsApp hanya aktif bila nomor lengkap tersimpan dan valid; Check-out tunduk pada role, pembayaran, konfirmasi, dan RPC resmi. | DISETUJUI OWNER | 2026-10-19 | 2026-10-19 | P0-02 Owner, RPC `check_out_transaction`, dan source lokal | Dashboard, Check-out, akses |
| AB-UI-BOOK-001 | Tampilan Booking yang diperiksa Owner dipertahankan: pengelompokan tanggal kedatangan, kartu nomor/tipe kamar, nama tamu + empat digit terakhir WhatsApp, nomor transaksi klik, Hubungi, Check-in, status BOOKING, serta kelompok AKAN DATANG/RIWAYAT. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Pemeriksaan Owner dan `src/routes/booking.tsx` | Booking |
| AB-UI-ROOM-001 | Nama area/menu menjadi ROOM; status tampil sebagai TERSEDIA, TERISI, PERLU DIBERSIHKAN, dan SEDANG DIBERSIHKAN. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Keputusan Owner; source saat ini masih memakai Kamar/Siap | ROOM |
| AB-UI-ROOM-002 | Tipe kamar ditampilkan kapital: STANDARD, SUPERIOR A, SUPERIOR B, DELUXE; harga kamar tidak ditampilkan pada kartu; pencarian, filter, dan tombol Ubah dipertahankan. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Keputusan Owner dan `src/routes/kamar.tsx` | ROOM |
| AB-UI-ROOM-003 | Kartu ROOM harus menampilkan TRX klik untuk kamar TERISI, HK klik untuk kamar TERSEDIA, dan kekurangan/kerusakan bertanda ❌ beserta keterangannya jika data Housekeeping tersedia; data tidak boleh dikarang. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Keputusan Owner; source saat ini belum memuat HK history/jobs di kartu | ROOM, Housekeeping |
| AB-UI-TRANS-001 | Area TRANSAKSI direncanakan mengelompokkan berdasarkan tanggal transaksi dibuat dan menampilkan TRX resmi, nama tamu + empat digit WhatsApp, kamar, nominal, dan status. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Keputusan Owner; source saat ini belum memenuhi seluruh tampilan | Transaksi |
| AB-UI-FIN-001 | Area FINANCE merencanakan Pendapatan, Tunai, QRIS, Transfer Bank, dan Pengeluaran tanpa penghitungan ganda. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Keputusan Owner dan route `keuangan.tsx`; Finance migration belum terpasang | Finance |
| AB-UI-ACCESS-001 | Nama area/menu Karyawan menjadi TIM & AKSES; peran Receptionist, Housekeeping, Supervisor, Inspector, dan Investor dipertahankan tanpa mengubah RLS/hak akses database. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Keputusan Owner, `kerangka.tsx`, `peran.tsx` | Tim & Akses |

## Nomorator resmi

| ID | Aturan | Status | Tanggal dicatat | Tanggal keputusan | Sumber | Fitur terkait |
|---|---|---|---|---|---|---|
| AB-NUM-001 | Nomor transaksi baru Receptionist memakai format `BTRD25-TRX-000000-26`. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Keputusan Owner; format generator pada migrasi `14000` | Transaksi |
| AB-NUM-002 | Nomor pekerjaan Housekeeping memakai format `BTRD25-HK-000000-26`. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Keputusan Owner; format generator pada migrasi `14000` | Housekeeping |
| AB-NUM-003 | Seri TRX dan HK terpisah; nomor urutnya tidak harus sama. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Keputusan Owner | Transaksi, Housekeeping |
| AB-NUM-004 | Format lama `BTRD25-000000` tidak digunakan untuk transaksi baru. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Keputusan Owner; baseline masih memiliki default lama | Transaksi |
| AB-NUM-005 | Nomor TRX/HK lama tidak diganti sembarangan; kebutuhan migrasi/backfill harus diaudit dan tidak dijalankan otomatis. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Keputusan Owner; preflight `14000` menghentikan migrasi bila nomor duplikat | Data migration |
| AB-NUM-006 | Aturan pergantian tahun, reset urutan, dan apakah sequence reset setiap tahun belum diputuskan. | BELUM DIPUTUSKAN | 2026-10-13 | BELUM TERVERIFIKASI | Audit generator `14000`: suffix tahun memakai `YY`, sequence tidak memiliki reset tahunan | Nomorator |

### Keputusan Owner final — P0-01 (2026-10-19)

Entri `AB-NUM-001` sampai `AB-NUM-006` di atas adalah histori keputusan sebelumnya. Untuk nomor baru, entri berikut menjadi aturan yang berlaku dan menggantikan format/tahun lama tanpa mengubah arsip.

| ID | Aturan final | Status | Tanggal keputusan | Implementasi lokal |
|---|---|---|---|---|
| AB-NUM-007 | Nomor transaksi baru memakai `BTRDTRX-000001`; satu seri kategori transaksi, tidak ada kode tahun, tidak reset, dan nomor yang sama dipertahankan dari Booking sampai Check-out. | DISETUJUI OWNER | 2026-10-19 | `owner_transaction_number_seq` + `next_transaction_number()` |
| AB-NUM-008 | Nomor Housekeeping baru memakai `BTRDHK-000001`; seri terpisah dari transaksi, tidak ada kode tahun, dan tidak reset. | DISETUJUI OWNER | 2026-10-19 | `owner_housekeeping_number_seq` + `next_housekeeping_number()` |
| AB-NUM-009 | Nomor Pengeluaran baru memakai `BTRDEXP-000001`; seri terpisah, dibuat otomatis oleh database, dan dicari bersama tanggal pencatatan. | DISETUJUI OWNER | 2026-10-19 | `finance_expenses.expense_number` + `owner_expense_number_seq` |
| AB-NUM-010 | Generator menggunakan `nextval` sequence database dan unique index; aman terhadap input bersamaan. Setelah `999999`, padding bertambah tanpa mengulang nomor. | DISETUJUI OWNER | 2026-10-19 | Migration `20261019000000_owner_final_numbering.sql` |
| AB-NUM-011 | Titik awal sequence dihitung dari nilai terbesar yang ditemukan pada format Owner dan format historis kategori terkait. Nomor lama tidak di-backfill, diganti, atau dihapus; nomor lama tetap diterima constraint dan dapat dicari. | DISETUJUI OWNER | 2026-10-19 | `owner_final_numbering_preflight.sql` dan blok `sequence_sync` |
| AB-NUM-012 | Arsip/filter tahun memakai `created_at` atau tanggal pencatatan, bukan nomorator. | DISETUJUI OWNER | 2026-10-19 | Route Transaksi mengelompokkan `transactions.created_at`; nomor tidak memuat tahun |

Nomor pada `src/lib/data-contoh.ts` tetap data contoh antarmuka dan bukan bukti nomor yang pernah diterbitkan. Nomor aktual wajib dibaca dari database melalui preflight read-only. Karena sesi ini tidak memiliki koneksi database lokal/remote yang boleh ditulis, migration menentukan titik awal saat dijalankan pada clone/database target; Staging dan Production tidak disentuh.

## Relasi riwayat transaksi–Housekeeping

| ID | Aturan | Status | Tanggal dicatat | Tanggal keputusan | Sumber | Fitur terkait |
|---|---|---|---|---|---|---|
| AB-REL-001 | Setiap transaksi harus dapat ditelusuri ke riwayat Housekeeping kamar dan siklus penggunaan yang relevan, serta sebaliknya, tanpa menghapus riwayat lama. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Keputusan Owner; migrasi `14000` menyiapkan `transaction_id`, `job_id`, dan resolution | Transaksi, Housekeeping |
| AB-REL-002 | Pengaitan memakai identitas data yang benar, bukan menyamakan angka urut TRX/HK; jika ada lebih dari satu kandidat aktivitas, pengaitan menjadi kebutuhan verifikasi/desain, bukan asumsi otomatis. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Keputusan Owner dan fungsi `resolve_housekeeping_transaction` | Transaksi, Housekeeping |

## Housekeeping

| ID | Aturan | Status | Tanggal dicatat | Tanggal keputusan | Sumber | Fitur terkait |
|---|---|---|---|---|---|---|
| AB-HK-001 | Urutan status kamar: ready → occupied → dirty → cleaning → ready. | DIKERJAKAN | 2026-10-13 | BELUM TERVERIFIKASI | Baseline Drizzle dan migrasi `05014` | Housekeeping |
| AB-HK-002 | Check-out mengubah kamar occupied menjadi dirty dan mencatat `checked_out_at`. | DIKERJAKAN / SIAP UJI | 2026-10-13 | BELUM TERVERIFIKASI | Migrasi `05012–05013` | Check-out, housekeeping |
| AB-HK-003 | Housekeeping atau Supervisor dapat menjalankan perpindahan cleaning; Owner/Supervisor dapat melakukan override READY untuk kamar dirty/cleaning. | DIKERJAKAN / SIAP UJI | 2026-10-13 | BELUM TERVERIFIKASI | Migrasi `05014–05015` | Housekeeping, akses |
| AB-HK-004 | History, checklist, maintenance, dan nomor pekerjaan housekeeping direncanakan melalui migrasi `12000–14000`; belum terpasang pada status 22/40. | DIRENCANAKAN | 2026-10-13 | BELUM TERVERIFIKASI | File migrasi lokal `12000–14000` | Housekeeping |

## Akses pengguna

| ID | Aturan | Status | Tanggal dicatat | Tanggal keputusan | Sumber | Fitur terkait |
|---|---|---|---|---|---|---|
| AB-AUTH-001 | Identitas dan role operasional berasal dari Lovable Cloud: `user_roles` terpisah dari `employees`; bukan storage browser. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | `AGENTS.md` dan baseline Drizzle | Auth, akses |
| AB-AUTH-002 | Role aplikasi: owner dan employee; posisi employee: receptionist, housekeeping, supervisor, inspector, investor. | DIKERJAKAN / SIAP UJI | 2026-10-13 | BELUM TERVERIFIKASI | Drizzle `0000`, migrasi `00010–00011`, source `peran.tsx` | Auth, akses |
| AB-AUTH-003 | Pembuatan akun employee dilakukan melalui server function berizin Owner; password dikelola provider auth dan tidak disimpan sebagai data aplikasi. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | `AGENTS.md`, `src/lib/employee.functions.ts` | Karyawan, auth |
| AB-AUTH-004 | RLS dan SECURITY DEFINER/RPC menjadi kontrol server; UI route guard tidak menggantikan kontrol database. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | `AGENTS.md`, migrasi role/permission, `__root.tsx` | Semua modul |

## Finance dan struk

| ID | Aturan / rancangan | Status | Tanggal dicatat | Tanggal keputusan | Sumber | Fitur terkait |
|---|---|---|---|---|---|---|
| AB-FIN-001 | Finance Foundation mencakup cash session, opening/closing, allocation, expense, deposit, refund, commission snapshot, dan entry payment/charge idempoten. | DIRENCANAKAN | 2026-10-13 | BELUM TERVERIFIKASI | `20261015000000_finance_foundation.sql`, belum terpasang | Finance |
| AB-FIN-002 | Migrasi Finance men-seed konfigurasi commission percentage 8% dan memerlukan Owner pada `user_roles`. | DIRENCANAKAN / BELUM TERVERIFIKASI | 2026-10-13 | BELUM TERVERIFIKASI | Finance Foundation lokal | Finance |
| AB-FIN-003 | Booking wajib memiliki DP minimum dinamis dari `finance_settings`; nilai awal Owner adalah 40% dan perubahan hanya boleh dilakukan Owner. Snapshot mode, persentase, dan nominal minimum disimpan pada transaksi agar histori tidak berubah. | DIKERJAKAN / SIAP UJI LOKAL | 2026-10-13 | BELUM TERVERIFIKASI | Keputusan Owner dan migration lanjutan lokal Finance 150 | Booking, Finance |
| AB-FIN-004 | Minimum DP dihitung sebagai `CEIL(total_transaksi × persentase / 100)` ke rupiah utuh, tanpa pembulatan ke ribuan; DP tidak boleh melebihi total transaksi. | DIKERJAKAN / SIAP UJI LOKAL | 2026-10-13 | BELUM TERVERIFIKASI | Keputusan Owner dan validasi lokal | Booking, Finance |
| AB-FIN-005 | Pembayaran dan pembuatan booking memakai idempotency key UUID; retry dengan payload sama mengembalikan catatan lama, sedangkan payload berbeda ditolak. | DIKERJAKAN / SIAP UJI LOKAL | 2026-10-13 | BELUM TERVERIFIKASI | Keputusan Owner dan migration lanjutan lokal | Booking, pembayaran |
| AB-FIN-006 | Pemilik sesi kas dan operator login dipisahkan; Owner/Supervisor dapat membantu sesi Receptionist melalui `_session_id`, sementara `recorded_by` tetap mencatat operator sebenarnya. | DIKERJAKAN / SIAP UJI LOKAL | 2026-10-13 | BELUM TERVERIFIKASI | Keputusan Owner dan migration lanjutan lokal | Sesi kas, audit |
| AB-FIN-007 | Refund mempertahankan mode komisi transaksi: PERCENTAGE mengurangi dasar komisi, PER_ROOM hanya menjadi nol pada refund penuh, dan OFF tetap nol; koreksi dicatat terpisah tanpa mengubah payment asli, termasuk sumber OWNER_FUNDS. Refund boleh merujuk transaksi/payment dari sesi FINAL, tetapi sumber dana kas baru wajib OWNER_FUNDS atau sesi OPEN lain yang berwenang. | DIKERJAKAN / SIAP UJI LOKAL | 2026-10-13 | BELUM TERVERIFIKASI | Keputusan Owner dan migration Finance 150 | Refund, komisi, closing |
| AB-GUEST-001 | Maksimal 2 tamu tidak dikenai biaya tambahan. Tamu ketiga dan seterusnya dikenai Rp50.000 per orang; rumus tambahan adalah `max(jumlah_tamu - 2, 0) × 50.000`. Biaya masuk total transaksi dan pendapatan. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Konfirmasi Owner pada pembaruan Buku Induk; belum ditemukan implementasi pada source/migrasi | Booking, pricing, pendapatan |
| AB-REC-001 | Selain aturan salinan pada AB-REC-002, format isi dan kewenangan struk belum ditemukan sebagai spesifikasi teknis terverifikasi. | BELUM TERVERIFIKASI | 2026-10-13 | BELUM TERVERIFIKASI | Audit repository/source; belum ada implementasi struk yang dapat dibuktikan | Struk, transaksi |
| AB-REC-002 | Cetakan pertama tidak diberi label salinan. Cetakan kedua bertuliskan `SALINAN 1`/`COPY 1`, cetakan ketiga `SALINAN 2`/`COPY 2`, dan seterusnya. Jumlah pencetakan dicatat per transaksi. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Konfirmasi Owner pada pembaruan Buku Induk; belum ditemukan implementasi pada source/migrasi | Struk, transaksi |

## Kebijakan data demo, keamanan destruktif, dan go-live

| ID | Aturan | Status | Tanggal dicatat | Tanggal keputusan | Sumber | Fitur terkait |
|---|---|---|---|---|---|---|
| AB-ENV-001 | Baturaden 25 Homestay V1.0 masih PRA-OPERASIONAL; belum digunakan secara resmi. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Keputusan Owner pada pembaruan Buku Induk | Environment, go-live |
| AB-DATA-001 | Transaksi, booking, tamu, pembayaran, Housekeeping, dan catatan pengujian selama pembangunan adalah DATA DEMO/TESTING kecuali ditetapkan khusus sebagai operasional. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Keputusan Owner | Data, testing |
| AB-DATA-002 | Data demo boleh diubah, diperbaiki, diganti, atau dihapus untuk pengembangan/pengujian dan tidak boleh menghambat perbaikan arsitektur, nomorator, relasi, atau alur. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Keputusan Owner | Data, testing |
| AB-SEC-001 | Kebijakan data demo bukan izin otomatis untuk reset database, truncate, delete massal, migrasi destruktif, atau perubahan Cloud. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Keputusan Owner | Keamanan, operasi |
| AB-SEC-002 | Sebelum tindakan destruktif, identifikasi environment, cakupan, dan dampak; minta persetujuan Owner. Lindungi konfigurasi, akun Owner, aturan bisnis, struktur penting, dan dokumentasi. Data berstatus tidak jelas harus dikonfirmasi. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Keputusan Owner | Keamanan, operasi |
| AB-GOLIVE-001 | Sebelum go-live harus ada persiapan data bersih; data testing tidak boleh tercampur dengan transaksi, booking, tamu, pembayaran, atau pekerjaan Housekeeping operasional baru. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Keputusan Owner | Go-live, data |
| AB-GOLIVE-002 | Struktur database, aturan bisnis, konfigurasi, dan hak akses yang disetujui dipertahankan selama persiapan data bersih. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Keputusan Owner | Go-live, arsitektur |
| AB-GOLIVE-003 | Checklist go-live wajib mencakup verifikasi environment, pembersihan data demo, pemeriksaan relasi, nomorator resmi, akun/akses, dan pengujian akhir. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Keputusan Owner | Go-live |
| AB-NUM-007 | Kebijakan nomorator saat go-live, termasuk apakah urutan dimulai kembali dari awal, BELUM DIPUTUSKAN OWNER dan tidak boleh ditetapkan sendiri. | BELUM DIPUTUSKAN | 2026-10-13 | BELUM TERVERIFIKASI | Keputusan Owner | Go-live, nomorator |

## Catatan implementasi ROOM + DASHBOARD

**Tanggal pencatatan:** 2026-10-13<br>
**Tanggal keputusan Owner:** BELUM TERVERIFIKASI<br>
**Status:** DIKERJAKAN / SIAP UJI<br>
**Sumber:** source lokal setelah pemasangan dan verifikasi migrasi `00006–00009`; tidak menambah atau mengubah aturan harga, paket, timing, pembayaran, atau nomorator.

- ROOM menggunakan label TERSEDIA, TERISI, PERLU DIBERSIHKAN, dan SEDANG DIBERSIHKAN; tipe kamar ditampilkan kapital.
- Sidebar memakai gaya penulisan normal Dashboard, Room, Booking, Transaksi, Tamu, dan Housekeeping; kapitalisasi label kartu ROOM tidak berlaku untuk sidebar.
- TRX pada kamar TERISI berasal dari transaksi `check_in` aktif dan dapat membuka detail transaksi.
- HK dan tanda ❌ hanya ditampilkan dari record Housekeeping/checklist resmi yang tersedia; aplikasi tidak membuat nomor HK pengganti.
- DASHBOARD menghitung countdown dari `ends_at` di browser dan mengurutkan kamar TERISI berdasarkan sisa waktu, tanpa query Supabase setiap detik.
- Perawatan Berkala menampilkan kategori dan jumlah pekerjaan jatuh tempo berdasarkan task live; detail, petugas, checklist, catatan, dan simpan tetap berada di dalam kategori yang dipilih.
- Halaman Room tidak menggunakan pencarian; filter status tetap dipertahankan. Judul halaman menggunakan Status Room dan jumlah Room berasal dari data live.
- Aksi kategori Perawatan Berkala menggunakan teks Lihat Daftar sebagai tombol keyboard-accessible; permukaan kartu bukan tombol.
- Transaksi dikelompokkan berdasarkan tanggal transaksi dibuat (`created_at`), bukan tanggal checkout.
- Pencarian nomor transaksi numerik mencocokkan nilai nomor urut setelah nol depan dinormalisasi; tahun dan prefiks tidak menjadi dasar pencocokan.
- Tampilan Check-in/Check-out aktual memakai `started_at`/`checked_out_at`; `ends_at` dan jadwal booking tidak menggantikan timestamp aktual.
- Halaman Transaksi tidak menyediakan aksi Check-out; aksi operasional tersebut tetap berada pada Dashboard.

## Koreksi RIW-029 — desain Booking sebagai acuan

**Tanggal pencatatan:** 2026-10-13<br>
**Tanggal keputusan Owner:** BELUM TERVERIFIKASI<br>
**Status:** SIAP UJI<br>
**Sumber:** Koreksi Owner terhadap RIW-029.

Desain Booking yang telah disetujui Owner adalah acuan visual yang harus dipertahankan: kotak identitas kamar di kiri, tipe kamar di atas nomor kamar, identitas tamu/TRX di tengah, aksi dan status di kanan. Penyempurnaan Daftar Transaksi mengikuti karakter visual tersebut; Booking tidak didesain ulang.

## SOP permanen Owner

| ID | SOP | Status | Tanggal dicatat | Tanggal keputusan | Sumber | Fitur terkait |
|---|---|---|---|---|---|---|
| SOP-01 | Sebelum memulai tugas, audit status fitur dan riwayat perubahan. Jangan mengulang pekerjaan yang selesai kecuali Owner meminta revisi. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Instruksi Owner | Semua pekerjaan |
| SOP-02 | Aturan bisnis yang sudah ditetapkan dan disetujui dalam dokumen proyek adalah acuan resmi dan tidak boleh diganti berdasarkan asumsi developer/AI. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Instruksi Owner | Semua fitur |
| SOP-03 | Setiap tugas dikerjakan secara utuh dengan dependensi, batas perubahan, pengujian, dan pembaruan dokumentasi; hindari instruksi terpotong dan revisi berulang. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Instruksi Owner | Proses pengembangan |
| SOP-04 | Pada sesi baru, anggap ChatGPT, Codex, Lovable, PowerShell, dan alat kerja tertutup. Sebelum meminta langkah teknis, berikan panduan membuka alat yang diperlukan dengan nama menu, lokasi, dan urutan yang mudah diikuti. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Instruksi Owner | Operasional sesi |
| SOP-05 | Gunakan cara yang paling sederhana, aman, mudah dirawat, dan tidak menambah kompleksitas yang tidak diperlukan: “Jika ada yang mudah, kenapa harus yang sulit?” | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Instruksi Owner | Arsitektur, proses |
| SOP-06 | Seluruh data selama pembangunan adalah DEMO/TESTING. Target sebelum go-live adalah dataset operasional bersih/kosong; pembersihan destruktif tetap memerlukan pemeriksaan environment, cakupan, dampak, dan persetujuan eksplisit Owner. Akun Owner, konfigurasi, struktur database, aturan bisnis, dokumentasi, dan keputusan reset nomorator wajib dilindungi. | DISETUJUI OWNER | 2026-10-13 | BELUM TERVERIFIKASI | Instruksi Owner | Data demo, go-live |

## SOP permanen tambahan — 2026-10-14

| ID | SOP | Status | Tanggal dicatat | Tanggal keputusan | Sumber | Fitur terkait |
|---|---|---|---|---|---|---|
| SOP-07 | Anggap seluruh jendela ChatGPT, Codex, PowerShell, browser, dan alat kerja tertutup ketika sesi baru dimulai. Berikan langkah membuka alat kerja dengan lokasi dan urutan yang jelas. | DISETUJUI OWNER | 2026-10-14 | BELUM TERVERIFIKASI | Instruksi Owner | Operasional sesi |
| SOP-08 | Urutan sumber kebenaran adalah keputusan resmi Owner, source/migration yang benar-benar ada, hasil pengujian terbukti, checkpoint terbaru, lalu catatan historis. Jika bertentangan, catat konflik dan jangan mengarang kepastian. | DISETUJUI OWNER | 2026-10-14 | BELUM TERVERIFIKASI | Instruksi Owner | Semua fitur |
| SOP-09 | Bedakan Local, Supabase Staging, Production, dan Cloudflare yang belum dikonfigurasi. Hasil satu lingkungan tidak boleh dipakai sebagai bukti lingkungan lain. | DISETUJUI OWNER | 2026-10-14 | BELUM TERVERIFIKASI | Instruksi Owner | Environment, deployment |
| SOP-10 | Hentikan audit berulang. Audit hanya dilakukan bila ada perubahan signifikan, blocker konkret, atau permintaan Owner. Pekerjaan yang sudah PASS tidak diulang tanpa alasan tersebut. | DISETUJUI OWNER | 2026-10-14 | BELUM TERVERIFIKASI | Instruksi Owner | Proses pengembangan |

## Aturan dokumentasi dan checkpoint

Setiap pekerjaan yang selesai harus memperbarui bagian relevan dari lima dokumen resmi. Laporan akhir wajib menyebut pekerjaan selesai, PASS/FAIL, file berubah, commit terakhir, blocker nyata, langkah berikutnya, dan persentase progres tahap terkait. Commit, push, deploy, migration, perubahan database remote, dan tindakan destruktif tetap memerlukan otorisasi Owner yang terpisah.

## Catatan aturan environment — reconciliation Staging 2026-10-15

Snapshot katalog Staging adalah bukti schema/metadata saja, bukan bukti bahwa Finance 150 sudah aktif. Tabel dan RPC existing tidak boleh diubah hanya karena migration lokal menyediakan definisi baru. Perubahan Finance harus forward-only, mempertahankan data transaksi/payment existing, dan menunggu diff exact untuk function identity, grants, RLS, trigger, dan migration history.

Absennya nama lama `cash_sessions` atau `cash_session_entries` bukan bukti absennya Finance; kontrak lokal memakai `finance_cash_sessions` dan `finance_session_allocations`. Pada snapshot kali ini kedua nama Finance tersebut memang belum terlihat, sehingga Finance Foundation tetap menjadi dependency yang belum diterapkan/terverifikasi.

Preflight reconciliation lokal boleh memuat katalog metadata dan pemeriksaan keberadaan objek, tetapi tidak boleh menjadi migration terselubung. File `supabase/reconciliation/finance150_staging_preflight.sql` harus tetap SELECT-only sampai Owner menyetujui paket forward-only terpisah.

## Keputusan UI Dashboard dan sesi kas — 2026-10-16

| ID | Keputusan Owner | Status | Tanggal dicatat | Sumber / fitur terkait |
|---|---|---|---|---|
| AB-UI-DASH-002 | Dashboard modern mengikuti referensi `C:\Users\USER\Downloads\Dasbor Manajemen Homestay Modern.png` sedekat mungkin; data harus berasal dari database, bukan angka ilustrasi. | DISETUJUI OWNER / SIAP UJI VISUAL | 2026-10-16 | Referensi visual Owner, `dashboard-modern.tsx` |
| AB-UI-DASH-003 | Warna kartu kamar: Standard biru pastel, Superior A/B hijau pastel, Deluxe kuning pastel. Tombol Check-out merah dan nomor transaksi pada kartu dapat membuka detail transaksi. | DISETUJUI OWNER / SIAP UJI VISUAL | 2026-10-16 | Keputusan warna Owner, Dashboard |
| AB-UI-DASH-004 | Log Activity memakai timeline dengan ikon berwarna dan waktu; Grafik Pendapatan memakai batang biru dengan filter Harian/Mingguan/Bulanan/Tahunan. | DISETUJUI OWNER / SIAP UJI VISUAL | 2026-10-16 | Dashboard |
| AB-UI-DASH-005 | Emergency horizontal merah dengan bingkai hitam tipis berada di bawah sidebar; Pengaturan berada di header; blok Owner dan tombol Keluar di sidebar dihapus; logout tetap melalui profil. | DISETUJUI OWNER / SIAP UJI VISUAL | 2026-10-16 | `kerangka.tsx`, Dashboard |
| AB-UI-DASH-006 | Aksi utama Dashboard bernama Check-in Langsung dan Buat Booking; visual browser belum dinyatakan PASS sampai dikonfirmasi Owner. | DISETUJUI OWNER / BELUM TERVERIFIKASI VISUAL | 2026-10-16 | Dashboard |
| AB-FIN-007 | Check-in Langsung dan pelunasan Booking tidak meminta dropdown sesi kas. Resolver memakai sesi kerja `OPEN`; operator aktual dan pemilik sesi tetap terpisah; Owner/Supervisor dapat membantu sesi sesuai otorisasi. | DISETUJUI OWNER / SIAP UJI LOKAL | 2026-10-16 | `sesi-kas.ts`, `formulir-pemesanan.tsx`, `booking.tsx`, `keuangan.tsx` |
| AB-FIN-008 | Jika sesi kas sah tidak tersedia atau konteks bantuan belum valid, transaksi diblokir dan sistem tidak membuka sesi baru secara otomatis. ID konteks browser bukan batas keamanan; RPC/server tetap menjadi sumber otorisasi. | DISETUJUI OWNER / BELUM TERVERIFIKASI RUNTIME | 2026-10-16 | Finance 150, sesi kas |

## Addendum status implementasi Staging — 2026-10-18

- Housekeeping 01–03 dan Kalender 01–03 telah **COMMIT di Staging** `bgtztcfbkcrvcipxbfti`; Kalender memiliki 51 tanggal unik, 35 `national_holiday`, dan 16 `collective_leave`.
- Finance 150000–150003 telah **COMMIT di Staging**. RLS, signature RPC final, idempotency, scheduled/overlap guard, dan model dual identity Owner/Supervisor telah diaudit secara read-only; smoke test operasional belum dilakukan.
- Training adalah status assignment server-side yang menempel pada akun sendiri selama tepat dua hari kalender. Aturan Owner bersifat final: transaksi memakai sesi aktif Owner/Supervisor, peserta tidak membuka sesi sendiri, `auth.uid()` tetap operator aktual, dan audit diberi label `Training`.
- Implementasi Training Enforcement belum dimulai. Sampai enforcement backend tersedia dan diuji, peserta Training belum boleh digunakan untuk operasional.
- `20261006000010_correct_p4_prices.sql` tetap **BLOCKED** dan tidak boleh dijalankan tanpa keputusan Owner baru.
- SOP pengujian resmi: Codex melakukan pemeriksaan teknis bertahap; Owner melakukan satu rangkaian uji menyeluruh setelah semua fitur wajib siap. Status operasional tetap **BELUM READY**.

### Implementasi Training Enforcement lokal — 2026-10-18

Aturan Owner untuk peserta Training tetap berlaku: login dengan ID sendiri, dua hari kalender Asia/Jakarta, pengawasan Owner/Supervisor yang ditugaskan, penggunaan sesi kas aktif penanggung jawab, larangan membuka sesi kas sendiri, operator dari `auth.uid()`, dan audit berlabel `Training`. Implementasi lokal menambahkan assignment server-side, guard sesi kas/RPC, wrapper Finance, trigger audit, serta integrasi UI; tidak mengubah aturan dual identity Finance 150.

Status: **SIAP REVIEW LOKAL, BELUM READY OPERASIONAL**. Migration `20261018000000_finance_training_enforcement.sql` belum dijalankan ke remote. Pengujian pure, TypeScript, dan build **PASS**; runtime Staging dan smoke test belum dilakukan.

### Koreksi enforcement setelah audit FAIL — 2026-10-18

Guard database kini mencakup RPC lama check-out, closing, expense, deposit, payment, booking, check-in, sesi kas, serta mutation Finance lain. Check-out peserta wajib melalui wrapper dengan session assigned; assignment, supervisor, session, dan operator audit ditentukan server-side. Sesi lama peserta tidak diubah otomatis dan hanya ditandai untuk penyelesaian Owner.

Status tetap **SIAP REVIEW LOKAL, BELUM READY OPERASIONAL** karena migration belum dipasang dan runtime Staging belum diuji.

### Hasil SQL runtime Training lokal — 2026-10-18

Pengujian pada cluster temporary terisolasi membuktikan assignment dua hari Asia/Jakarta, supervisor assigned, larangan sesi sendiri dan sesi lama, penolakan RPC legacy, dual identity payment, check-out Training, dan audit `Training`. `finance_prepare_payment` diperketat hanya untuk konteks Training yang tervalidasi; jalur normal Owner/Receptionist tetap lulus.

Status: **PASS LOKAL / BELUM READY OPERASIONAL**. Migration belum dipasang remote. Uji nomor transaksi resmi penuh tertahan oleh constraint format lama pada fixture lokal dan tidak diubah dalam task ini.
