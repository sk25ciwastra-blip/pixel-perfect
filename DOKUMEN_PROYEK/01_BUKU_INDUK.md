# Baturaden 25 Homestay V1.0 — Buku Induk Proyek

**Tanggal pencatatan:** 2026-10-13<br>
**Status dokumen:** AKTIF — dokumen induk permanen<br>
**Repository:** `pixel-perfect-read`
**Lingkup:** source aplikasi, baseline Drizzle, migrasi Supabase, keputusan Owner, status Staging, dan riwayat perubahan.

## KEBIJAKAN UTAMA OWNER — PRA-OPERASIONAL

**Baturaden 25 Homestay V1.0 masih dalam tahap pembangunan dan pengujian, BELUM beroperasi secara resmi.**

Seluruh transaksi, booking, tamu, pembayaran, Housekeeping, dan catatan yang dibuat selama pembangunan dianggap **DATA DEMO/TESTING**, kecuali Owner menetapkannya secara khusus sebagai data operasional.

Data demo boleh diubah, diperbaiki, diganti, atau dihapus untuk pengembangan dan pengujian. Data demo tidak boleh diperlakukan sebagai data bisnis sungguhan yang wajib diselamatkan, dan tidak boleh menghambat perbaikan arsitektur, nomorator, relasi, atau alur aplikasi.

Kebijakan ini **bukan izin otomatis** untuk menghapus database atau mengubah Cloud. Sebelum reset, truncate, delete massal, migrasi destruktif, atau tindakan destruktif lain, identifikasi lingkungan, cakupan data, dan dampaknya lalu minta persetujuan Owner. Konfigurasi, akun Owner, aturan bisnis, struktur penting, dan dokumentasi proyek tetap harus dilindungi. Data yang belum jelas statusnya harus dikonfirmasi terlebih dahulu.

Sebelum go-live wajib ada persiapan data bersih agar data testing tidak tercampur dengan data operasional baru. Struktur database, aturan bisnis, konfigurasi, dan hak akses yang disetujui harus dipertahankan. Kebijakan reset nomorator saat go-live **BELUM DIPUTUSKAN OWNER**.

## Tujuan

Dokumen ini adalah peta utama proyek agar keputusan dan pekerjaan tidak hilang ketika sesi ChatGPT, Codex, Lovable, atau kontributor berganti. Detail dikelompokkan pada:

- [Aturan bisnis](02_ATURAN_BISNIS.md)
- [Status fitur](03_STATUS_FITUR.md)
- [Riwayat perubahan](04_RIWAYAT_PERUBAHAN.md)
- [Arsitektur sistem](05_ARSITEKTUR_SISTEM.md)

## Status proyek saat ini

| Item | Status | Bukti / catatan |
|---|---|---|
| Baseline Drizzle `0000–0005` | TERUJI/DISETUJUI | Dilaporkan berhasil di Baturaden-25-Staging. |
| Migrasi Supabase | 26/40 tercatat pada checkpoint Owner | Baseline/22 migrasi sebelumnya ditambah 00006–00009; riwayat migrasi formal Cloud belum tersedia. |
| Migrasi `00006–00009` | TERUJI/DISETUJUI | Dipasang di Staging dan diverifikasi Owner: signature 10 parameter, helper jadwal, kolom, serta index tersedia. |
| Owner | TERUJI/DISETUJUI | Akun Owner dibuat dan role Owner diverifikasi di Staging. |
| `room_types` | TERUJI/DISETUJUI | 4 tipe resmi dan pricing group tersedia. |
| `rooms` | TERUJI/DISETUJUI | Standard 5, Superior A 1, Superior B 3, Deluxe 2; total 11. |
| `packages` | TERUJI/DISETUJUI | Tepat 9 paket resmi, aktif, harga/durasi/timing sesuai seed Owner. |
| Harga per tipe kamar | TERUJI/DISETUJUI | Migrasi `20261006000005` berhasil; katalog 27 kombinasi. |
| Keputusan UI Booking | TERUJI/DISETUJUI — UI SAJA | Owner menyatakan tampilan Booking yang diperiksa sesuai; alur backend tetap belum seluruhnya teruji. |
| Keputusan UI ROOM | DIKERJAKAN | Owner menyatakan sebagian sesuai; label, HK card, TRX/HK link, dan checklist masih perlu revisi. |
| Nomorator TRX/HK | SIAP UJI / TERBLOKIR MIGRASI | Format resmi dicatat; generator `14000` belum terpasang pada status 22/40. |
| TypeScript | PASS | `bun x tsc --noEmit` exit code 0. |
| Build aplikasi | PASS | `bun run build` exit code 0; ada warning deprecation `inputValidator()`. |
| Lint | BLOCKED | `bun run lint` menghasilkan 9.179 error formatting/CRLF dan 12 warning repository-wide. |
| PostgreSQL runtime lokal | PASS | PostgreSQL portable EDB 17.11 pada cluster sementara port 55432; cluster sudah dihentikan. |
| PostgreSQL Cloud/Staging | TERUJI/DISETUJUI | Owner memverifikasi hasil pemasangan 00006–00009; riwayat formal `schema_migrations` tetap tidak tersedia. |
| Status operasi resmi | PRA-OPERASIONAL | Aplikasi belum dinyatakan beroperasi resmi; seluruh data testing mengikuti kebijakan data demo Owner. |
| Persiapan go-live | BELUM SELESAI | Checklist lingkungan, pembersihan data demo, relasi, nomorator, akses, dan pengujian akhir belum selesai. |

## Ringkasan isi buku induk

- **78 aturan bisnis/SOP** ber-ID permanen pada `02_ATURAN_BISNIS.md`.
- **28 catatan fitur + 6 area rencana** pada `03_STATUS_FITUR.md`.
- **30 riwayat proyek + 8 riwayat Git** pada `04_RIWAYAT_PERUBAHAN.md`.
- **5 dokumen permanen** pada folder `DOKUMEN_PROYEK`.

## Arti status

- **DISETUJUI OWNER:** keputusan bisnis telah dinyatakan atau dikonfirmasi Owner.
- **DIRENCANAKAN:** ada rancangan atau file kerja, tetapi belum menjadi hasil yang teruji.
- **DIKERJAKAN:** implementasi sedang ada di source/migrasi atau sedang direvisi.
- **SIAP UJI:** artefak siap diuji, tetapi belum ada bukti uji Staging yang dicatat.
- **TERUJI/DISETUJUI:** hasil uji atau verifikasi berhasil dan diterima sesuai fakta yang tercatat.
- **BELUM TERVERIFIKASI:** fakta, tanggal keputusan, atau hasil belum dapat dibuktikan dari repository/Staging yang tersedia.
- **BLOCKED:** pemeriksaan belum dapat diselesaikan karena alat atau dependensi tertentu tidak tersedia.

## Panduan membuka dokumen untuk Owner

### Windows File Explorer

1. Buka File Explorer.
2. Tempel lokasi repository berikut pada address bar:

   `C:\Users\USER\Documents\Codex\2026-10-02\codex-tolong-baca-dan-analisis-repositori\work\pixel-perfect-read\DOKUMEN_PROYEK`

3. Buka salah satu file `.md` dengan Notepad, WordPad, atau editor Markdown.

### VS Code

1. Buka VS Code.
2. Pilih **File → Open Folder**.
3. Pilih folder repository `pixel-perfect-read`.
4. Di Explorer kiri, buka folder `DOKUMEN_PROYEK`.
5. Mulai dari `01_BUKU_INDUK.md`, lalu ikuti tautan ke empat dokumen lain.

## Cara melihat riwayat perubahan Git

Di terminal pada root repository:

```text
git log --oneline --decorate --all
git log --follow -- DOKUMEN_PROYEK/02_ATURAN_BISNIS.md
git log --follow -- DOKUMEN_PROYEK/04_RIWAYAT_PERUBAHAN.md
git diff -- DOKUMEN_PROYEK/
git status --short
```

Riwayat Git menunjukkan perubahan file, bukan otomatis persetujuan Owner. Persetujuan bisnis tetap harus dicatat pada [02_ATURAN_BISNIS.md](02_ATURAN_BISNIS.md).

## Prosedur wajib perubahan berikutnya

Setiap permintaan fitur atau revisi Owner wajib melakukan seluruh langkah berikut:

1. Catat aturan baru atau perubahan pada [02_ATURAN_BISNIS.md](02_ATURAN_BISNIS.md) dengan ID permanen.
2. Perbarui status fitur pada [03_STATUS_FITUR.md](03_STATUS_FITUR.md).
3. Catat keputusan, implementasi, pengujian, dan persetujuan pada [04_RIWAYAT_PERUBAHAN.md](04_RIWAYAT_PERUBAHAN.md).
4. Perbarui [05_ARSITEKTUR_SISTEM.md](05_ARSITEKTUR_SISTEM.md) bila alur data, permission, RPC, atau lokasi source berubah.
5. Jangan diam-diam mengubah aturan yang sudah berstatus **DISETUJUI OWNER**.
6. Pisahkan SQL review dari folder migrasi resmi sampai Owner menyetujui eksekusi.
7. Jangan membuat Git commit tanpa persetujuan Owner.

## Checklist go-live yang wajib disiapkan

- Verifikasi project dan environment yang benar.
- Tandai dan bersihkan data DEMO/TESTING sesuai persetujuan Owner; jangan menghapus konfigurasi atau akun Owner.
- Periksa relasi transaksi, tamu, pembayaran, kamar, dan Housekeeping.
- Verifikasi format dan sequence nomorator TRX/HK; jangan menetapkan reset tahunan tanpa keputusan Owner.
- Verifikasi akun, role, posisi, RLS, privilege, dan akses menu.
- Jalankan pengujian akhir booking, check-in, checkout, pembayaran, Housekeeping, Finance, dan tampilan.
- Catat tanggal implementasi, tanggal pengujian, dan persetujuan go-live secara terpisah.

## Empat jenis tanggal yang wajib dibedakan

- **Tanggal keputusan:** kapan Owner menetapkan aturan. Jika tidak ada bukti, tulis `BELUM TERVERIFIKASI`.
- **Tanggal implementasi:** kapan perubahan masuk source/migrasi atau Staging.
- **Tanggal pengujian:** kapan hasil diuji dan apa buktinya.
- **Tanggal persetujuan Owner:** kapan Owner menyatakan hasil diterima. Ini berbeda dari tanggal commit atau tanggal implementasi.

## Informasi yang belum dapat diverifikasi

- Tanggal formal setiap keputusan Owner belum tercatat sebagai tanggal terpisah.
- Riwayat migrasi formal Cloud belum dapat diverifikasi karena `supabase_migrations.schema_migrations` tidak ditemukan.
- Migrasi `00006–00009` sudah dipasang dan diverifikasi Owner di Staging; signature RPC aktif adalah 10 parameter.
- Dependensi eksternal di luar source repository yang mungkin masih memanggil RPC 9 parameter belum dapat diverifikasi.
- Runtime PostgreSQL lokal sudah diuji PASS pada cluster terisolasi; SQL Cloud/Staging belum dijalankan.
- Implementasi biaya tamu tambahan dan cetak ulang struk belum terverifikasi.
- Implementasi kartu ROOM berbasis HK, format TRX/HK baru di Staging, serta relasi runtime transaksi–Housekeeping belum terverifikasi.
- Aturan reset sequence ketika tahun berganti masih BELUM DIPUTUSKAN.
- Proses pembersihan data demo dan checklist go-live belum dijalankan.
- Status produksi/deploy tidak disimpulkan dari build lokal.

## Pembaruan implementasi ROOM + DASHBOARD — 2026-10-13

- Menu sidebar memakai penulisan normal `Dashboard`, `Room`, Booking, Transaksi, dan seterusnya; label kecil kartu kamar tetap `ROOM` kapital.
- Kartu ROOM memakai data live, status resmi TERSEDIA/TERISI/PERLU DIBERSIHKAN/SEDANG DIBERSIHKAN, TRX aktif yang dapat dibuka, serta HK/checklist hanya jika record resmi tersedia.
- Jika tabel atau record Housekeeping belum tersedia, kartu ROOM menampilkan fallback jujur dan tidak membuat nomor HK palsu.
- DASHBOARD mempertahankan countdown lokal per detik dan pengurutan kamar TERISI berdasarkan `ends_at`; timer tidak melakukan query Supabase per detik.
- Perawatan Berkala kini menampilkan kategori ringkas yang dapat diklik; daftar task, jatuh tempo, riwayat, petugas, checklist, catatan, dan pencatatan muncul setelah kategori dipilih.
- Room tidak lagi memiliki input pencarian; filter status tetap tersedia. Judul halaman menjadi Status Room dengan keterangan dinamis jumlah Room.
- Kartu kategori Perawatan Berkala hanya menjadikan aksi Lihat Daftar sebagai elemen klik.
- Transaksi dikelompokkan berdasarkan tanggal `created_at` terbaru, tanpa mengubah perhitungan pembayaran atau pendapatan.
- Transaksi memiliki pencarian nomor resmi/full atau pencocokan ketat digit urut tanpa mencocokkan tahun/prefiks.
- Baris Transaksi menampilkan Check-in dari `started_at`, Check-out dari `checked_out_at`, dan `—` bila timestamp belum tersedia; tombol Check-out tidak ada di halaman/detail Transaksi.
- RIW-029 dikoreksi melalui RIW-030: visual Booking dipulihkan ke desain Owner pra-RIW-029, sedangkan Transaksi mengikuti karakter visual tersebut.
- TypeScript dan build lulus; lint file ROOM lulus tanpa error, sedangkan lint repository luas tetap memiliki masalah formatting lama.

## SOP permanen Owner

SOP-01 sampai SOP-06 pada [02_ATURAN_BISNIS.md](02_ATURAN_BISNIS.md) adalah prosedur kerja resmi: jangan mengulang pekerjaan selesai, jadikan aturan Owner sebagai acuan, kerjakan instruksi secara utuh, berikan panduan membuka alat pada sesi baru, pilih cara paling sederhana yang aman, dan perlakukan seluruh data pembangunan sebagai DEMO/TESTING sampai go-live.

Pada sesi baru, alat kerja dianggap tertutup. Owner hanya perlu membuka alat yang disebutkan dalam langkah kerja. Data demo tidak boleh dihapus sekarang tanpa pemeriksaan environment, cakupan, dampak, dan persetujuan eksplisit Owner.

## Checkpoint permanen Finance 150 dan Staging — 2026-10-14

Bagian ini adalah checkpoint terbaru dan tidak mengubah kebijakan pra-operasional di atas.

### Hasil Finance 150 lokal

- Browser E2E lokal: **PASS**.
- Booking, DP minimum 40%, pelunasan, check-in, sesi kas Receptionist, pemisahan operator/session owner, dan kecocokan UI Keuangan dengan database: **PASS** berdasarkan evidence lokal dan laporan runtime yang tersedia.
- Tidak ditemukan transaksi atau payment duplikat pada skenario idempotency yang diuji.
- TypeScript: **PASS**.
- Build: **PASS**.
- Finance 150 **bukan production-ready** dan belum menjadi bukti deployment Cloud/Staging.

### Git checkpoint

- Branch: `main`.
- HEAD: `37ae7bdbcdb80d9f0ee560ae00554688e6fefecc` (`feat(finance): integrate Finance 150 booking payments and cash sessions`).
- Commit berisi 58 path: 43 migration Supabase dan 15 file integrasi source.
- Belum push dan belum deploy.
- Perubahan unstaged/untracked tetap dilindungi untuk review Owner; tidak boleh dihapus, ditimpa, atau diasumsikan bagian dari commit.

Evidence `%TEMP%` Finance 150 memiliki beberapa manifest intermediate dengan ukuran staged berbeda (42, 47, dan 58 path). Manifest tersebut adalah artefak proses sebelumnya, bukan status Git baru. Status permanen mengikuti repository saat ini: HEAD `37ae7bd...`, 43 migration Supabase, 15 source integration, belum push/deploy. Laporan Cloud read-only juga hanya menyatakan target **PARTIALLY VERIFIED**; tidak ada akses remote yang mengubah kesimpulan ini.

### Rekonstruksi Staging dari artefak lokal

Checkpoint Owner menyebut Baturaden-25-Staging dengan project reference `bgtztcfbkcrvcipxbfti`, 11 tabel `public`, `create_reservation` 10 parameter, `check_in_booking` tersedia, dan `record_transaction_payment` tersedia. Repository lokal menunjuk `ijujmxhcifuerkllbbgq` pada `supabase/config.toml`; keduanya belum terbukti identik.

Rekonstruksi paling masuk akal adalah: Drizzle `0000` membuat 9 tabel inti; Drizzle `0005` menambah `payments` menjadi 10; Supabase `20261006000005` membuat `package_room_type_prices` menjadi 11; Supabase `20261006000007–00009` menambah kolom/index/helper scheduled booking dan memfinalkan RPC 10 parameter. Ini adalah rekonstruksi berdasarkan artefak lokal dan checkpoint Owner, bukan bukti migration history remote.

Finance memakai nama `finance_cash_sessions` dan `finance_session_allocations`. Tidak ditemukannya nama lama `cash_sessions` atau `cash_session_entries` tidak cukup untuk menyimpulkan Finance sudah atau belum ada.

### Status migration dan langkah minimum

Repository memiliki 6 migration Drizzle yang tercatat di journal, 1 file sidecar Drizzle di luar journal, dan 43 migration Supabase. File repository tidak disamakan dengan migration yang sudah berjalan di Staging. Migration history remote, schema exact, auth/JWT claim mapping, RLS, grants, dan objek Finance Staging masih perlu snapshot katalog read-only.

Langkah minimum berikutnya: ambil snapshot metadata katalog Supabase Staging yang tepat, bandingkan dengan ledger pada [05_ARSITEKTUR_SISTEM.md](05_ARSITEKTUR_SISTEM.md), lalu buat rencana forward-only bila diperlukan. Jangan mengulang E2E Finance 150, menjalankan migration, `db push`, repair, reset, atau mengubah Staging tanpa keputusan Owner berikutnya.

Checkpoint ini mengikuti motto Owner: **“Jika ada yang mudah, kenapa harus susah.”**
