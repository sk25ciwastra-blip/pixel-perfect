# Baturaden 25 Homestay V1.0 — Status Fitur

**Tanggal pencatatan:** 2026-10-13<br>
**Kaidah:** file atau kode yang ada tidak otomatis berarti fitur selesai. Status harus mengikuti bukti Staging, uji lokal, dan persetujuan Owner.

## Rencana resmi enam area

| Area | Keputusan Owner | Kondisi source saat ini | Status implementasi | Pengujian yang sudah/belum dilakukan | Pekerjaan berikutnya |
|---|---|---|---|---|---|
| DASHBOARD | Dashboard operasional memakai tabel Kamar Sedang Terisi dengan tiga aksi resmi. | `src/routes/index.tsx` hanya menampilkan transaksi `check_in` pada kamar aktif berstatus `occupied`, mengurutkan countdown, mempertahankan waktu habis, dan menyediakan Detail/Hubungi/Check-out. | SIAP UJI LOKAL | TypeScript/build/pure test PASS; browser visual dan runtime UI belum tersedia. Check-out server-side hardened dan lulus PostgreSQL isolated runtime. | Owner review dan uji UI/runtime target. |
| ROOM | Revisi label ROOM, status, tipe kapital, TRX/HK klik, dan indikator ❌ dari data Housekeeping. | `src/routes/kamar.tsx` membaca rooms, room types, transaksi aktif, history, dan checklist; tanpa input pencarian; judul Status Room dan jumlah Room dinamis. | SIAP UJI | TypeScript/lint/build PASS; runtime UI Staging belum dicatat. | Uji localhost dengan data HK resmi; migrasi Housekeeping berikutnya tetap diperlukan untuk job/relasi lengkap. |
| BOOKING | Tampilan yang diperiksa Owner sudah sesuai; tidak dijadwalkan desain ulang. | `src/routes/booking.tsx` mengelompokkan jadwal, menampilkan kamar/tipe, nama + empat digit phone, TRX klik, Hubungi, Check-in, status, Akan Datang/Riwayat. | TERUJI/DISETUJUI — UI SAJA | Persetujuan visual Owner; alur RPC/pembayaran/check-in belum lulus runtime. | Pertahankan desain; uji alur setelah migrasi `00006–00009`. |
| TRANSAKSI | Kelompok tanggal transaksi, TRX resmi, nama + empat digit WhatsApp, kamar, nominal, status. | `src/routes/transaksi.tsx` menampilkan daftar, TRX klik, nama, kamar, tanggal, nominal, status, countdown/check-out; belum mengelompokkan tanggal atau menampilkan empat digit WhatsApp. | DIKERJAKAN | Source diaudit; belum ada uji UI/runtime terhadap kebutuhan Owner. | Tambahkan grouping/detail sesuai aturan setelah format TRX siap; jangan ubah data lama sembarangan. |
| FINANCE | Pendapatan, Tunai, QRIS, Transfer Bank, Pengeluaran tanpa penghitungan ganda. | `src/routes/keuangan.tsx` memanggil RPC cash session, expense, deposit, refund, commission; Finance Foundation belum terpasang pada Staging. | SIAP UJI / TERBLOKIR DEPENDENSI | Source diaudit; belum ada uji runtime database Finance. | Selesaikan dependency/migrasi Finance dan verifikasi rekonsiliasi tanpa double count. |
| TIM & AKSES | Nama menu Karyawan menjadi Tim & Akses; posisi dan hak akses Owner dipertahankan. | Source masih memakai judul/menu Karyawan; `peran.tsx`, root guard, dan server functions sudah mendukung posisi. | DIKERJAKAN | TypeScript/build PASS; RLS/runtime akses belum diuji dalam sesi ini. | Ubah label UI saja setelah persetujuan teknis; jangan mengubah RLS/hak database. |

| Fitur | Status | Fakta dan bukti | Keterkaitan aturan |
|---|---|---|---|
| Auth dan sesi pengguna | DIKERJAKAN / SIAP UJI | `src/integrations/supabase`, `peran.tsx`, `__root.tsx`; Owner Staging sudah dibuat dan diverifikasi. | AB-AUTH-001–004 |
| Role dan posisi employee | DIKERJAKAN / SIAP UJI | Migrasi `00010–00011` terpasang; source mendukung lima posisi employee. | AB-AUTH-002–004 |
| Master room type | TERUJI/DISETUJUI | 4 tipe tersedia dan Superior A/B berada pada group `superior`. | AB-ROOM-001, AB-ROOM-003 |
| Master rooms | TERUJI/DISETUJUI | 11 kamar diverifikasi: 5 Standard, 1 Superior A, 3 Superior B, 2 Deluxe. | AB-ROOM-002 |
| Katalog 9 paket | TERUJI/DISETUJUI | `public.packages` tepat 9 paket, seluruhnya aktif; harga/durasi/timing diverifikasi Owner. | AB-PACK-001–002, AB-TIME-* |
| Harga package-level compatibility | TERUJI/DISETUJUI | Seed final telah disiapkan; P4 package-level 80.000/90.000. | AB-PRICE-* |
| Harga paket per room group | TERUJI/DISETUJUI | Migrasi `00005` berhasil, guard 27 kombinasi. | AB-PRICE-* |
| Form booking/check-in | TERUJI LOKAL / SIAP UJI CLOUD | Source `formulir-pemesanan.tsx` dan SQL final berhasil dipakai pada database sementara; RPC belum terpasang Cloud. | AB-BOOK-*, AB-CHECK-* |
| Pricing transaction dari database | TERUJI LOKAL / SIAP UJI CLOUD | Lookup pricing group dan P4 Weekday/Weekend berhasil diuji runtime; Cloud belum berubah. | AB-BOOK-001–002 |
| Scheduled booking | TERUJI LOKAL / SIAP UJI APLIKASI | Migrasi `00006–00009` sudah dipasang dan diverifikasi Owner di Staging; alur UI/runtime aplikasi belum diuji ulang. | AB-BOOK-003–005 |
| Overlap booking vs booking | TERUJI LOKAL | Overlap ditolak dan booking adjacent diterima pada uji runtime; race dua Receptionist menghasilkan satu sukses/satu penolakan. | AB-BOOK-005 |
| Overlap booking vs check-in aktif | TERUJI LOKAL | Booking pada kamar occupied non-overlap diterima; overlap active check-in ditolak. | AB-BOOK-005 |
| Pembayaran tambahan | TERUJI LOKAL / TERBLOKIR FINANCE TRANSITION | Source lokal cocok dengan RPC 3-parameter `06000`; Finance Foundation berikutnya memakai signature 4-parameter dan membutuhkan penyesuaian lanjutan. | AB-PAY-001–003, AB-FIN-001 |
| Check-in wajib lunas | TERUJI LOKAL / SIAP UJI CLOUD | Check-in lunas, kurang bayar, rollback, same-transaction booking check-in, dan race dua Receptionist PASS pada database uji. | AB-CHECK-001 |
| Check-out server-side settlement | PASS LOKAL / STAGING BELUM DIUJI | Migration `20261019000001` menghitung `payments - refunds` terhadap `price_snapshot + charge_events`, mengunci transaksi, menolak under/overpayment, menolak mutation setelah closed, dan mempertahankan Housekeeping/Training. | AB-CHECK-003 |
| Checkout atomik | SIAP UJI | Migrasi `05012–05013` terpasang; runtime belum diuji. | AB-HK-002 |
| Housekeeping status dasar | SIAP UJI | Source lokal memakai overload 1-parameter yang sudah tersedia pada Staging; overload dengan catatan dari migrasi Housekeeping berikutnya belum diperlukan untuk alur dasar. | AB-HK-001–003 |
| Housekeeping history/checklist/maintenance/numbering | DIRENCANAKAN | Migrasi `12000–14000` tersedia lokal tetapi belum terpasang. | AB-HK-004 |
| Nomorator resmi TRX/HK | IMPLEMENTASI LOKAL / SIAP UJI | Format Owner final `BTRDTRX-*` dan `BTRDHK-*` diterapkan forward-only pada migration `20261019000000`; format lama tetap diterima dan tidak di-backfill. | AB-NUM-007–012 |
| Relasi transaksi–Housekeeping | DIRENCANAKAN / SIAP UJI | Migrasi `14000` menyiapkan `housekeeping_jobs.transaction_id`, history `transaction_id/job_id`, dan resolution ambiguity; ROOM belum menampilkan relasi HK. | AB-REL-001–002 |
| Operational calendar | DIRENCANAKAN | Migrasi `06011–06014` tersedia lokal tetapi belum terpasang. | AB-BOOK-003–005 |
| Finance Foundation | DIRENCANAKAN | `20261015000000_finance_foundation.sql` tersedia lokal, belum terpasang dan belum diuji. | AB-FIN-001–002 |
| Biaya tamu tambahan | BELUM TERVERIFIKASI | Audit source/migrasi tidak menemukan `guest_count`, rumus Rp50.000, atau integrasi biaya ke `price_snapshot`/pendapatan. | AB-GUEST-001 |
| Cetak ulang struk | BELUM TERVERIFIKASI | Audit source/migrasi tidak menemukan print counter, label SALINAN/COPY, atau alur pencetakan. | AB-REC-002 |
| Struk/receipt umum | BELUM TERVERIFIKASI | Sebagian spesifikasi di AB-REC-002 sudah disetujui Owner, tetapi implementasi teknis belum terbukti. | AB-REC-001–002 |
| Data bersih pra-go-live | BELUM SELESAI | Kebijakan data demo sudah disetujui, tetapi identifikasi/pembersihan data, pemeriksaan relasi, dan verifikasi environment belum dilakukan. | AB-ENV-001, AB-DATA-001–002, AB-GOLIVE-001–003 |
| Checklist go-live | DIRENCANAKAN | Checklist verifikasi environment, data bersih, relasi, nomorator, akun/akses, dan pengujian akhir belum dijalankan. | AB-GOLIVE-003, AB-NUM-007 |
| Dashboard operasional P0-02 | SIAP UJI LOKAL / BLOCKER SERVER PAYMENT | Tabel hanya memuat check-in + kamar occupied, countdown expired tetap tampil, Detail memakai ID transaksi, WhatsApp memakai nomor tersimpan, dan Check-out memakai RPC resmi. | AB-UI-DASH-010–012 |
| Kategori Perawatan Berkala | SIAP UJI | `src/components/perawatan-berkala.tsx` menampilkan kategori dinamis dari task live, jumlah jatuh tempo, detail setelah klik, riwayat, petugas, checklist, catatan, dan RPC pencatatan. | Housekeeping maintenance |
| Pengelompokan Transaksi | SIAP UJI | `src/routes/transaksi.tsx` mengelompokkan berdasarkan tanggal `created_at` WIB terbaru; urutan transaksi di dalam kelompok juga terbaru terlebih dahulu. | Transaksi |
| Pencarian dan layout Transaksi | SIAP UJI | Pencarian full nomor atau digit urut ketat, identitas tamu kapital dengan separator `∙`, layout room kiri, identitas/TRX di sebelahnya, Check-in/Check-out di tengah, status tiga label di kanan, dan tanpa tombol Check-out di halaman/detail. Schema lokal menyediakan `started_at` dan `checked_out_at`; `ends_at` tidak digunakan. | Transaksi |
| Judul Daftar Transaksi | SIAP UJI | Judul halaman menjadi Daftar Transaksi, deskripsi tetap Daftar transaksi tamu, placeholder menjadi Cari nomor transaksi, dan tombol Check-in Langsung dipertahankan. | Transaksi |
| Penyempurnaan visual Booking | SIAP UJI | Desain pra-RIW-029 dipulihkan: kotak Room terpisah di kiri, tipe/nomor besar, identitas/TRX di tengah, aksi/status di kanan; nomor transaksi diperbesar sedikit agar terbaca; logika Booking tetap dipertahankan. | Booking UI |
| Koreksi RIW-029 | SIAP UJI | Perubahan Booking yang mengikuti Transaksi dibatalkan secara selektif; Transaksi menggunakan karakter visual Booking yang disetujui. | Booking, Transaksi |
| Navigasi HP/desktop | DIKERJAKAN | `src/components/kerangka.tsx` dan route tree tersedia; visual formal terbaru tidak terverifikasi dalam audit ini. | Arsitektur UI |

## Makna status fitur

- **DIRENCANAKAN:** ada rancangan/file, belum menjadi fitur Staging.
- **DIKERJAKAN:** source atau migrasi mulai tersedia.
- **SIAP UJI:** dependensi utama tersedia, tetapi belum ada bukti uji runtime yang tercatat.
- **TERUJI/DISETUJUI:** hasil sudah diverifikasi dan diterima berdasarkan fakta yang dicatat.
- **BELUM TERVERIFIKASI:** belum cukup bukti untuk status lain.

## FASE A integrasi desain v0 — 2026-10-19

- Referensi v0 yang tersedia hanya shared Dashboard shell dan komponennya: Sidebar, HeroHeader, KPI, Room, Activity, Quick Actions, Revenue, Payment Donut, serta amount visibility.
- Token navy/gold v0 ditambahkan secara selektif dan Sidebar/layout asli diadaptasi tanpa mengubah auth, role guard, route, Emergency, data live, atau P0-01/P0-02/P0-02B.
- Login, Kamar, Booking, Transaksi, Tamu, Housekeeping, Keuangan, Karyawan, dan Pengaturan tidak memiliki referensi halaman v0 yang dapat dibuktikan; tidak diubah.
- Dashboard detail v0 ditunda ke FASE B agar tabel `Kamar Sedang Terisi` dan tiga aksi resmi P0-02 tidak tergantikan oleh mock `RoomCards`.
- Matriks permanen: `DOKUMEN_PROYEK/06_MATRIKS_DESAIN_V0.md`.

## FASE B Dashboard v0 — 2026-10-19

- Hero Dashboard, KPI Cards, Activity Feed, Revenue Chart, Payment Breakdown, dan Quick Actions telah diadaptasi secara lokal menggunakan data live aplikasi asli.
- `mock-data.ts` v0 tidak digunakan. Revenue memakai `payments.created_at/amount`; breakdown memakai payment method dan `finance_expenses` hanya bila role memiliki akses; Activity memakai `activity_logs` untuk Owner.
- Tabel `Kamar Sedang Terisi`, tiga aksi, P0-01 nomorator, P0-02B Check-out, Finance, Training, sesi kas, dual identity, dan Emergency tidak diubah.
- Status: **SELESAI LOKAL / BROWSER VISUAL BELUM DIUJI**.

## Audit empat fitur — 2026-10-13

- **Pencarian Transaksi:** SIAP UJI. Parser membaca nomor Owner final `BTRDTRX-...`, nomor legacy `BTRD25-000018`, dan format resmi historis `BTRD25-TRX-...`; angka satu digit dicari parsial pada nomor urut, angka minimal dua digit dicocokkan tepat setelah normalisasi nol depan.
- **Hover Perawatan Berkala:** SIAP UJI. Kartu kategori tidak lagi mengubah latar atau border saat hover; tindakan tetap berada pada tombol `Lihat Daftar`.
- **Pencarian Tamu:** SIAP UJI. Pencarian tetap langsung saat mengetik, mendukung substring nama dan nomor WhatsApp yang dinormalisasi, termasuk awalan `62`/`0` tanpa mengubah data tersimpan.
- **Status Room:** SIAP UJI. Filter status dihapus, header diberi divider, kartu dikelompokkan Standard/Superior/Deluxe sesuai urutan Owner, dan Room 01 tetap ditampilkan sebagai `ROOM LAINNYA` karena status legacy/demo belum dapat dipastikan dari source/migrasi.

## Finance 150 — implementasi lokal terkoordinasi — 2026-10-13

- Status: **SIAP UJI LOKAL / BELUM AKTIF CLOUD**.
- Migration lanjutan lokal `20261015000001_finance_150_booking_compatibility.sql` menambahkan snapshot minimum DP, idempotency booking/payment, sesi bantuan Owner/Supervisor, audit operator, validasi mutasi sesi, dan rekonsiliasi koreksi refund.
- Kontrak lokal `record_transaction_payment` menjadi lima parameter dengan `_idempotency_key` wajib secara source/types dan `_session_id` opsional untuk bantuan sesi.
- Default minimum DP lokal diatur melalui `finance_settings` menjadi PERCENTAGE 40 pada row yang belum pernah diubah Owner; rumus minimum memakai CEIL ke rupiah utuh.
- TypeScript/build/pure-function tests lulus; lint target masih terhambat oleh formatting/CRLF lama pada file lokal yang sudah berubah.
- Tidak ada SQL/migration yang dijalankan di Cloud/Staging dan belum ada bukti runtime Finance Staging.
- Temuan audit authoritative day mode dan deposit pada sesi FINAL telah dikoreksi di source migration lokal; refund setelah closing memakai sumber OWNER_FUNDS atau sesi OPEN, sedangkan sesi FINAL hanya menjadi referensi historis. Runtime SQL belum diuji.

## Addendum checkpoint Finance 150 — 2026-10-14

Status terbaru menggantikan pembacaan lama yang menyatakan E2E Finance belum selesai, tetapi tidak mengubah batas lingkungan:

- Browser E2E lokal Finance 150: **PASS** untuk Booking, DP 40%, pelunasan, check-in, sesi kas Receptionist, operator/session owner, UI Keuangan, dan idempotency tanpa duplikasi.
- TypeScript dan build: **PASS**.
- Finance 150: **PASS lokal / BELUM TERVERIFIKASI Staging / bukan production-ready**.
- Commit lokal: `37ae7bdbcdb80d9f0ee560ae00554688e6fefecc`, branch `main`, belum push/deploy.
- Perubahan unstaged/untracked tetap berada di luar commit dan harus diperlakukan sebagai perubahan Owner yang dilindungi.

## Addendum status Staging dan migration — 2026-10-14

Project reference Staging dari Owner adalah `bgtztcfbkcrvcipxbfti`; konfigurasi repository menunjuk `ijujmxhcifuerkllbbgq`. Staging dilaporkan memiliki 11 tabel public, `create_reservation` 10 parameter, `check_in_booking`, dan `record_transaction_payment`. Migration history remote, objek Finance, Auth/JWT claim mapping, RLS, grants, dan kesamaan schema belum terverifikasi penuh.

Rekonstruksi 11 tabel berasal dari Drizzle `0000` (9), Drizzle `0005` (`payments`, total 10), dan Supabase `20261006000005` (`package_room_type_prices`, total 11). Supabase `20261006000007–00009` diperlakukan sebagai perubahan Booking yang dilaporkan terpasang, bukan sebagai tabel baru. Nama Finance yang benar adalah `finance_cash_sessions` dan `finance_session_allocations`; pencarian nama `cash_sessions`/`cash_session_entries` tidak boleh dijadikan kesimpulan.

Langkah berikutnya adalah snapshot katalog Staging read-only dan perbandingan dengan ledger migration lokal. Tidak ada migration yang boleh dijalankan sebelum rencana kompatibilitas aman dan persetujuan Owner.

## Reconciliation schema Staging — 2026-10-15

- Snapshot katalog valid: 11 tables, 94 columns, 53 constraints, 22 indexes, 25 functions, 21 triggers, 18 policies.
- **Sesuai dengan baseline:** 11 tabel operasional, room/package pricing group, 27 price rows table, scheduled booking columns/indexes, `create_reservation` 10 parameter, `check_in_booking(uuid)`, dan `record_transaction_payment(uuid,numeric,text)`.
- **Belum sesuai Finance 150:** seluruh tabel Finance, `finance_reservation_idempotency`, `operational_calendar`, kolom Finance pada `payments`/`transactions`, Finance triggers, Finance policies, Finance RPCs, dan kontrak 12-parameter reservation.
- **Belum cukup untuk eksekusi:** function body/owner/search_path/grants, RLS enabled flags, trigger definitions/function targets, table privileges, routine privileges, dan migration-history rows.
- Status Finance: **BLOCKED DEPENDENCY / BELUM SELARAS STAGING**. Tidak mengulang E2E, TypeScript, build, atau audit Finance 150 lokal.

File preflight SELECT-only lokal tersedia untuk melengkapi relation flags, column presence, function overloads, trigger/policy metadata, grants, enum, object presence, dan migration-history existence. File belum dijalankan.

Paket review lokal Finance 150 sekarang dipisah menjadi reconciliation plan forward-only dan legacy aggregate preflight. Status tetap **BLOCKED SEBELUM EKSEKUSI** sampai backup/PITR, relation flags, RLS/grants, dan hasil kompatibilitas data tersedia.

Backup/restore test Staging juga **BLOCKED AKSES**: pg_dump/pg_restore/psql lokal tersedia, tetapi Supabase CLI belum authenticated dan jalur resmi DB URL/credential tidak tersedia secara lokal. Tidak ada akses remote atau backup yang dicoba.

## Addendum Support dan backup Staging — 2026-10-15

- Tiket resmi Supabase Support untuk `bgtztcfbkcrvcipxbfti`: **TERKIRIM**, belum terselesaikan dan belum ada balasan.
- Backup PostgreSQL: **FAIL / 0% terverifikasi**. Dump 0 byte tidak valid dan tidak boleh dipakai.
- Restore terisolasi: **BELUM DILAKUKAN**.
- Finance 150 Staging: **BLOCKED**. Migration tidak boleh dijalankan sebelum backup valid, checksum, dan restore lokal terisolasi PASS.
- Jangan mengulang tes koneksi identik atau audit Finance 150 tanpa diagnosis baru dari Support.

Update Support: tiket `SU-508298` dikonfirmasi melalui email otomatis pada 15 Oktober 2026. Status masih menunggu respons teknis; email penerimaan bukan penyelesaian. Backup/restore tetap BLOCKED dan Finance 150 tidak boleh dimigrasikan ke Staging sebelum backup valid serta restore terisolasi PASS.

## UX sesi kas otomatis — 2026-10-16

- Dropdown manual **Sesi kas pembayaran** di Check-in Langsung dihapus. Konteks sesi ditentukan otomatis dari sesi `OPEN` milik operator.
- Owner/Supervisor menggunakan konteks sesi bantuan yang dipilih pada halaman Keuangan; bila hanya ada satu sesi `OPEN`, sesi tersebut dipakai otomatis. Bila konteks bantuan tidak sah atau belum tersedia, transaksi diblokir dan tidak membuka sesi baru.
- Operator aktual tetap dicatat oleh server melalui `auth.uid()`/`recorded_by`, sedangkan pemilik sesi kas tetap berasal dari `finance_cash_sessions.opened_by`.
- Pelunasan Booking menggunakan resolver konteks yang sama. Perubahan hanya pada UX/source; database, RPC, migration, dan aturan Finance 150 tidak diubah.

## Finalisasi Dashboard modern — 2026-10-16

- Referensi wajib: `C:\Users\USER\Downloads\Dasbor Manajemen Homestay Modern.png`.
- Implementasi mempertahankan data database dan fungsi yang sudah ada, dengan target visual: biru/pastel, panel sambutan + kalender, lima KPI, Kamar Terisi, timeline Log Activity, serta tiga panel analitik.
- Warna kartu kamar: Standard biru pastel, Superior A/B hijau pastel, Deluxe kuning pastel. Check-out merah dan TRX pada kartu dapat membuka detail.
- Grafik Pendapatan memakai batang biru dan filter Harian, Mingguan, Bulanan, Tahunan. Emergency horizontal merah dengan bingkai hitam tipis berada di bawah sidebar. Pengaturan berada di header; Owner/Keluar di sidebar dihapus; logout tetap di profil.
- Aksi Dashboard: Check-in Langsung dan Buat Booking. Angka/identitas ilustrasi tidak dipakai sebagai data operasional.
- TypeScript: **PASS**. Build: **PASS**. `git diff --check`: **PASS**. Pemeriksaan visual browser: **BELUM PASS / MENUNGGU KONFIRMASI OWNER**.

## Status UX sesi kas setelah koreksi — 2026-10-16

- Dropdown sesi kas di Check-in Langsung dan pelunasan Booking dihapus.
- `src/lib/sesi-kas.ts` menjadi resolver bersama untuk sesi `OPEN` milik operator, konteks bantuan Owner/Supervisor, dan fallback satu-sesi.
- Tanpa sesi valid, transaksi diblokir; sistem tidak membuka sesi baru pada setiap Check-in.
- `recorded_by`/`auth.uid()` tetap mencatat operator aktual, sedangkan `finance_cash_sessions.opened_by` tetap mencatat pemilik sesi.
- Context ID pada session storage hanya penunjuk UI non-rahasia. Keamanan pemilihan sesi belum diuji runtime terhadap database/Staging; otorisasi final tetap harus berasal dari RPC/RLS/server.

## Addendum status live Staging — 2026-10-18

Checkpoint ini supersedes status provisional sebelum migrasi Housekeeping, Kalender, dan Finance diterapkan.

| Area | Status terbaru | Bukti / batasan |
|---|---|---|
| Housekeeping 01–03 | COMMIT STAGING | History, checklist, maintenance, job/numbering, resolution, RLS, policy, dan RPC tersedia. |
| Kalender 01–03 | COMMIT STAGING | 51 tanggal unik: 35 `national_holiday`, 16 `collective_leave`; aturan Owner untuk weekday/weekend telah direview. |
| Finance 150000–150003 | COMMIT STAGING | 11 tabel Finance Foundation + compatibility idempotency, RLS aktif, signature RPC final sesuai. |
| Finance code audit | PASS BERDASARKAN KODE | Idempotency, payment guard, scheduled/overlap guard, role checks, SECURITY DEFINER, search path, RLS, dan grants telah diaudit read-only. |
| Finance smoke test Staging | BELUM DIUJI | Belum ada booking/payment/session test yang mengubah data. |
| Dual identity | TERSEDIA / BELUM DIUJI OPERASIONAL | `auth.uid()`/`recorded_by` berbeda dari `finance_cash_sessions.opened_by`; runtime assistance belum diuji. |
| Training Enforcement | BLOCKER / BELUM DIMULAI | Assignment dua hari, validasi sesi Owner/Supervisor, larangan sesi sendiri, dan label audit `Training` belum diimplementasikan. |
| Harga P4 `060010` | BLOCKED | Isi migration bertentangan dengan katalog P4 yang disetujui Owner. |
| Status operasional | BELUM READY | Menunggu implementasi Training Enforcement, smoke test Staging, cleanup data uji, dan persetujuan akhir Owner. |

SOP pengujian: Codex melanjutkan validasi teknis bertahap tanpa mengulang pengujian Finance lokal; Owner menjalankan satu rangkaian pengujian menyeluruh setelah fitur wajib siap.

### Checkpoint Training Enforcement lokal — 2026-10-18

| Area | Status | Bukti / batasan |
|---|---|---|
| Assignment dua hari Asia/Jakarta | SIAP LOKAL | Migration baru dan fungsi server-side tersedia lokal. |
| Enforcement sesi kas dan dual identity | SIAP LOKAL | Guard, validasi assigned session, dan wrapper Finance tersedia lokal. |
| Audit operator + label `Training` | SIAP LOKAL | Trigger audit memakai `auth.uid()` dan label tetap. |
| Integrasi UI | SIAP LOKAL / BELUM RUNTIME | Booking, pembayaran/check-in, Finance, peran, dan sesi kas terintegrasi; belum diuji runtime. |
| Migration remote | BELUM | Tidak dijalankan ke Staging/Production. |
| Pengujian operasional | BELUM | Smoke test dan cleanup data uji menunggu persetujuan Owner. |
| Progres Training | 70% lokal | Status operasional tetap **BELUM READY**. |

### Koreksi setelah audit bypass Training — 2026-10-18

| Area | Status terbaru | Bukti / batasan |
|---|---|---|
| Guard RPC lama | SIAP LOKAL | Guard database memblokir check-out, closing, expense, deposit, payment, booking, check-in, dan mutation Finance lain tanpa konteks assigned. |
| Sesi kas lama peserta | DIBLOKIR BACKEND | Tidak ditutup atau diubah otomatis; penggunaan sesi sendiri ditolak. |
| Audit assignment/session/operator | SIAP LOKAL | Assignment diturunkan server-side dari `auth.uid()` dan session valid; GUC assignment tidak lagi dipercaya. |
| Pengujian negatif | PASS STATIS | Skenario bypass RPC lama, sesi sendiri, sesi salah/tertutup, dan assignment audit palsu tercakup pure tests. |
| SQL runtime/Staging | NOT TESTED | Migration belum dijalankan dan belum ada test database lokal terisolasi. |
| Progres Training | 85% lokal | Status operasional tetap **BELUM READY**. |

### Hasil SQL runtime lokal — 2026-10-18

| Area | Status | Bukti / batasan |
|---|---|---|
| Isolated PostgreSQL cluster | PASS | Cluster temporary terpisah; server sudah dimatikan setelah test. |
| Migration Training | PASS LOKAL | Apply dan rerun idempotency berhasil; P4 `060010` tidak dijalankan. |
| Assignment/session enforcement | PASS | Dua hari, supervisor assigned, sesi salah/tertutup/sesi lama ditolak. |
| Legacy Finance bypass | PASS | Booking, payment, check-in, check-out, expense, deposit, summary, closing ditolak tanpa context valid. |
| Valid Training payment/check-out | PASS | Dual identity payment berhasil; check-out wrapper berhasil; audit tercatat 3 event dengan operator/session/supervisor benar. |
| Owner/Receptionist regression | PASS | Helper operator Owner dan Receptionist normal bernilai true. |
| Supervisor normal regression | NOT TESTED | Restart cluster temporary terhalang shared-memory stale setelah shutdown; tidak ada remote impact. |
| Official transaction numbering | HISTORIS / DISESUAIKAN P0-01 | Fixture pernah memiliki check lama `BTRD25-######`; migration forward-only P0-01 kini menerima format lama dan mengarahkan transaksi baru ke `BTRDTRX-*`. Runtime fixture PostgreSQL disposable PASS; full Staging belum dijalankan. |
| Staging/Production | NOT TESTED | Tidak diakses atau diubah. |
| Progres Training | 90% lokal | Status operasional tetap **BELUM READY**. |

### Dashboard / Sidebar / Emergency / Logo — checkpoint lokal

| Area | Status | Bukti / batasan |
|---|---|---|
| Aksi cepat Dashboard | PASS LOKAL | Check-in Langsung dan Buat Booking menuju form resmi yang sudah ada; tidak ada duplikasi transaksi. |
| Sidebar gelap | PASS LOKAL | Navigasi dan hak akses dipertahankan; tampilan desktop gelap dan mobile tetap responsif. |
| Emergency UI | BLOCKED BACKEND | Konfirmasi dan pesan blocker tersedia; backend notification/audit recipient belum tersedia, sehingga tidak ada sukses palsu. |
| Logo Owner | PASS LOKAL | Varian transparan `1383×448` dibuat dari raster Owner dengan penghapusan latar hitam terhubung tepi; sumber asli tidak ditimpa. |

### Revisi visual grafik dan modal Dashboard — checkpoint lokal

| Area | Status | Bukti / batasan |
|---|---|---|
| Modal Check-in/Booking | PASS KODE | Dashboard memakai `FormulirPemesanan` resmi; overlay, close, refresh, dan close-on-success terintegrasi tanpa navigasi halaman. |
| Emergency modal | PASS KODE / BLOCKED BACKEND | Modal aplikasi menggantikan dialog browser; pengiriman tetap BLOCKED karena backend notifikasi belum tersedia. |
| Grafik paired bars | PASS KODE / NOT TESTED VISUAL | SVG responsif tanpa scrollbar, tujuh hari, dua batang, skala nonlinear, warna/tooltip/legenda; browser tidak tersedia untuk validasi visual. |
| Visual browser 1920/1366/mobile | NOT TESTED | Tidak ada browser target pada environment ini; tidak dinyatakan PASS visual. |

Koreksi ukuran grafik terakhir: tinggi SVG ditargetkan 240px mobile dan 260px desktop, tanpa scrollbar horizontal; label sumbu memakai `0`, `100K`, `500K`, `1.000K`, `3.000K`, `6.000K`. Visual browser tetap **NOT TESTED**.

### Checkpoint 1 Dashboard Owner — 2026-10-18 — ROLLBACK OWNER

- Referensi final `Dasbor Homestay Bandung Modern.png` telah diperiksa visual pada 1536×1024.
- Perubahan visual Checkpoint 1 dibatalkan secara terbatas; route Dashboard dikembalikan ke `Ringkasan` sebelum Checkpoint 1.
- `kerangka.tsx` juga dikembalikan selektif ke baseline visual Git: sidebar putih, logo blok `25`, header standar, dan kontainer `max-w-5xl`; aset PNG modern tidak lagi aktif.
- Perubahan fungsional sebelumnya, termasuk Booking/Check-in, countdown, Finance, Training Enforcement, audit log, role/permission, dan Emergency modal dipertahankan.
- Aset proyek sebelumnya dipertahankan; tidak ada perubahan database, migration, Staging, Production, commit, push, atau deploy.
# P0-01 — Nomorator Owner final (2026-10-19)

- Status lokal: **IMPLEMENTASI SELESAI / SIAP UJI**.
- Format baru: `BTRDTRX-000001`, `BTRDHK-000001`, `BTRDEXP-000001`; tanpa tahun, tidak reset, dan seri tiap kategori terpisah.
- Migration lokal: `supabase/migrations/20261019000000_owner_final_numbering.sql`.
- Audit read-only: `supabase/reconciliation/owner_final_numbering_preflight.sql`.
- Kompatibilitas: nomor `BTRD25-000000`, `BTRD25-TRX-000000-YY`, dan `BTRD25-HK-000000-YY` tetap diterima serta tidak diubah. Expense lama tanpa kolom nomor baru tetap nullable dan tidak di-backfill.
- Titik awal: dihitung dari maksimum nomor yang tersimpan pada database saat migration/preflight dijalankan. Data contoh UI tidak dihitung. Sesi ini tidak memiliki izin/koneksi untuk membaca database Staging/Production dan tidak menyentuhnya.
- Staging: **TIDAK DISENTUH / BELUM DIVERIFIKASI**.
- P0 berikutnya: **STOP — menunggu instruksi Owner**.


## STATUS TERBARU — 21 Oktober 2026 (bedakan environment)

| Fitur/lingkungan | Status/bukti |
|---|---|
| Finance schema Lovable | **PASS LIVE** — patch commit `2b7cb860`; 12 tabel dengan RLS; hardening 6 helper commit `26282e6` |
| Closing negatif dan pergantian sesi | **PASS LIVE DEMO** — -Rp50.000 FINAL; alokasi 0; sesi berikutnya OPEN Rp0 |
| Nomorator Transaksi | **PASS LIVE** — `BTRDTRX-000020` diterbitkan; legacy `BTRD25-000019` tetap |
| Nomorator Pengeluaran | **PASS LIVE** — `BTRDEXP-000001` diterbitkan; expense legacy nullable tetap |
| Nomorator Housekeeping | **INSTALLED / BELUM LIVE TEST** — sequence/RPC aktif; dua history legacy tetap; menunggu kamar dirty dari checkout yang sah |
| Booking + pembayaran DP | **PASS LIVE DEMO** — 2 booking @ Rp70.000, DP QRIS @ Rp28.000, sisa @ Rp42.000 |
| Booking nama tamu | **FIX MERGED** PR #10, editor Lovable sync; uji browser sesudah merge belum PASS |
| Frontend Finance | **FIX MERGED** PR #9, editor sync; web Finance dan closing negatif diuji langsung |
| Pelunasan, Check-in, Check-out demo terjadwal | **BELUM TEST** — 22 Okt kamar 06 jam 14.00 dan 07 jam 15.00 WIB |
| Training, role per staf, dual identity, settlement checkout hardening penuh | **STATUS TERPISAH; belum dibuktikan semuanya di Lovable runtime**, meskipun beberapa lulus lokal Codex |
| GitHub main ↔ Lovable editor | **SYNC** pada commit `47e760b0`; published build tidak otomatis terverifikasi |
| Backup/restore | Custom backup 21 Okt dipulihkan kompatibel lokal; restore penuh layanan/pasca commit belum teruji |
| Supabase Staging | **BUKAN** database Lovable; jangan samakan status |

**OPERASIONAL SEMENTARA: kandidat / belum GO.** Butuh uji alur inti, kewenangan staf, dan checkpoint persetujuan Owner; **100% seluruh roadmap belum dapat diklaim**. Persentase progres harus dihitung dari scope/task yang telah dipetakan, bukan berdasarkan klaim migrasi tunggal.
