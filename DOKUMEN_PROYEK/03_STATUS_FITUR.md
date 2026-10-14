# Baturaden 25 Homestay V1.0 — Status Fitur

**Tanggal pencatatan:** 2026-10-13<br>
**Kaidah:** file atau kode yang ada tidak otomatis berarti fitur selesai. Status harus mengikuti bukti Staging, uji lokal, dan persetujuan Owner.

## Rencana resmi enam area

| Area | Keputusan Owner | Kondisi source saat ini | Status implementasi | Pengujian yang sudah/belum dilakukan | Pekerjaan berikutnya |
|---|---|---|---|---|---|
| DASHBOARD | Menu Dashboard; kamar TERISI countdown realtime dan urut waktu tersisa paling pendek. | `src/routes/index.tsx` menghitung countdown tiap detik secara lokal dan mengurutkan `ends_at` terpendek; sidebar sudah memakai Dashboard. | SIAP UJI | TypeScript/build PASS; runtime dan pemeriksaan visual terbaru belum dicatat. | Uji localhost dengan data Staging dan konfirmasi tampilan Owner. |
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
| Checkout atomik | SIAP UJI | Migrasi `05012–05013` terpasang; runtime belum diuji. | AB-HK-002 |
| Housekeeping status dasar | SIAP UJI | Source lokal memakai overload 1-parameter yang sudah tersedia pada Staging; overload dengan catatan dari migrasi Housekeeping berikutnya belum diperlukan untuk alur dasar. | AB-HK-001–003 |
| Housekeeping history/checklist/maintenance/numbering | DIRENCANAKAN | Migrasi `12000–14000` tersedia lokal tetapi belum terpasang. | AB-HK-004 |
| Nomorator resmi TRX/HK | SIAP UJI / TERBLOKIR MIGRASI | `14000` mendefinisikan sequence dan generator format resmi, tetapi migrasi belum terpasang; belum termasuk uji runtime nomorator. | AB-NUM-001–006 |
| Relasi transaksi–Housekeeping | DIRENCANAKAN / SIAP UJI | Migrasi `14000` menyiapkan `housekeeping_jobs.transaction_id`, history `transaction_id/job_id`, dan resolution ambiguity; ROOM belum menampilkan relasi HK. | AB-REL-001–002 |
| Operational calendar | DIRENCANAKAN | Migrasi `06011–06014` tersedia lokal tetapi belum terpasang. | AB-BOOK-003–005 |
| Finance Foundation | DIRENCANAKAN | `20261015000000_finance_foundation.sql` tersedia lokal, belum terpasang dan belum diuji. | AB-FIN-001–002 |
| Biaya tamu tambahan | BELUM TERVERIFIKASI | Audit source/migrasi tidak menemukan `guest_count`, rumus Rp50.000, atau integrasi biaya ke `price_snapshot`/pendapatan. | AB-GUEST-001 |
| Cetak ulang struk | BELUM TERVERIFIKASI | Audit source/migrasi tidak menemukan print counter, label SALINAN/COPY, atau alur pencetakan. | AB-REC-002 |
| Struk/receipt umum | BELUM TERVERIFIKASI | Sebagian spesifikasi di AB-REC-002 sudah disetujui Owner, tetapi implementasi teknis belum terbukti. | AB-REC-001–002 |
| Data bersih pra-go-live | BELUM SELESAI | Kebijakan data demo sudah disetujui, tetapi identifikasi/pembersihan data, pemeriksaan relasi, dan verifikasi environment belum dilakukan. | AB-ENV-001, AB-DATA-001–002, AB-GOLIVE-001–003 |
| Checklist go-live | DIRENCANAKAN | Checklist verifikasi environment, data bersih, relasi, nomorator, akun/akses, dan pengujian akhir belum dijalankan. | AB-GOLIVE-003, AB-NUM-007 |
| Dashboard countdown | SIAP UJI | Countdown lokal dan sorting `ends_at` tersedia; build PASS, runtime/visual localhost belum diuji ulang. | BELUM ADA ID ATURAN KHUSUS |
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

## Audit empat fitur — 2026-10-13

- **Pencarian Transaksi:** SIAP UJI. Parser membaca nomor legacy `BTRD25-000018` dan format resmi `BTRD25-TRX-...`; angka satu digit dicari parsial pada nomor urut, angka minimal dua digit dicocokkan tepat setelah normalisasi nol depan.
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
