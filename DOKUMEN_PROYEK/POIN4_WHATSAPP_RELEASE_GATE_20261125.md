# Gate Rilis Poin 4/7 — Template WhatsApp
**Tanggal checkpoint:** 25 November 2026 (WIB)
**PR:** #145 (DRAFT / HOLD) · **Issue:** #144
**Status keputusan:** **NO-GO untuk migrasi/publish**; akses dan preflight struktur LIVE sudah diperoleh (lihat addendum).

## Lingkungan yang benar-benar diperiksa
- Supabase connector hanya menampilkan **Baturaden-25-Staging** (`bgtztcfbkcrvcipxbfti`), PostgreSQL 17.11.
- **Pada checkpoint awal ini**, Supabase connector hanya memberi akses staging. Addendum di bawah mencatat temuan lanjutan saat LIVE ditemukan melalui Lovable.
- Semua pemeriksaan staging adalah `SELECT` metadata / `list_migrations` saja. Tidak ada DDL, DML, feature flag, deploy, publish, atau transaksi keuangan.

## Hasil preflight staging — 12 persyaratan
| Objek | Hasil |
|---|---|
| public.user_roles | 🟢 PRESENT |
| public.employees | 🟢 PRESENT |
| public.transactions | 🟢 PRESENT |
| public.app_role | 🟢 PRESENT |
| public.has_role(uuid, public.app_role) | 🟢 PRESENT |
| public.receipt_template_versions | 🔴 MISSING |
| public.finance_training_current_user_is_restricted() | 🔴 MISSING |
| public.read_payment_confirmation_refunds(uuid) | 🔴 MISSING |
| public.whatsapp_template_versions | 🔴 MISSING (expected until migration) |
| public.whatsapp_template_audit | 🔴 MISSING (expected until migration) |
| public.owner_save_whatsapp_template(text,text) | 🔴 MISSING (expected until migration) |
| public.read_active_whatsapp_template(text) | 🔴 MISSING (expected until migration) |

Migration history in staging covers an October 2026 baseline; this does **not** prove which migrations are installed on LIVE.

## Evidence on branch
- `supabase/pending/20261125_whatsapp_templates_owner_only.sql`: proposed new tables/RPC/permissions (not executed).
- `supabase/pending/20261125_whatsapp_templates_readonly_preflight.sql`: read-only metadata preflight.
- `scripts/whatsapp-template-postgres-fixture.sql`: isolated PostgreSQL authorization/versioning tests, including fail-closed missing Training guard.
- Latest focused CI to date: [run #45521288051](https://github.com/sk25ciwastra-blip/pixel-perfect/actions/runs/45521288051) PASS (previous branch checkpoint).

## Addendum verifikasi database Lovable LIVE — 25 November 2026

**Sumber verifikasi:** Lovable `Pixel Perfect Homestay Hub` (`project_id: 017f6e78-15f2-4d07-a38c-87cb185279bf`), akun Owner workspace. Proyek berstatus **published** dan databasenya **enabled, stack supabase**. Proyek ini berbeda dari koneksi Supabase staging `bgtztcfbkcrvcipxbfti`.

**Metode:** `get_project`, `get_database_status`, `query_database` dengan **SELECT metadata saja**. Tidak ada perubahan Cloud.

| Syarat objek LIVE | Hasil |
|---|---|
| `public.user_roles`, `public.employees`, `public.transactions` | 🟢 PRESENT |
| `public.app_role`, `public.has_role(uuid, app_role)` | 🟢 PRESENT |
| `public.receipt_template_versions` | 🟢 PRESENT |
| `public.finance_training_current_user_is_restricted()` | 🟢 PRESENT |
| `public.read_payment_confirmation_refunds(uuid)` | 🟢 PRESENT |
| `public.whatsapp_template_versions`, `public.whatsapp_template_audit` | 🔴 MISSING, new migration not applied |
| `public.owner_save_whatsapp_template(text,text)`, `public.read_active_whatsapp_template(text)` | 🔴 MISSING, new migration not applied |

**Metadata yang dikonfirmasi:** `employees.user_id` uuid, `position` enum `employee_position`, `active` boolean; `user_roles.user_id` uuid, `role` enum `app_role`; `transactions.id` uuid; `receipt_template_versions.header_config` jsonb. Enumerasi posisi mencakup receptionist, housekeeping, supervisor, inspector, investor.

**Fungsi LIVE:** `has_role` dan fungsi Training ada sebagai `SECURITY DEFINER`; `read_payment_confirmation_refunds(_transaction_id uuid)` juga ada; yang terakhir menyetel `search_path` kosong. Fungsi `finance_training_current_user_is_restricted()` mengembalikan `finance_training_is_restricted(auth.uid())`. Eksistensi fungsi **tidak sama dengan** bukti seluruh UAT role PASS.

**Perubahan keputusan:** penghalang *missing Training/refund dependencies* hanya berlaku di staging, **tidak berlaku di LIVE** yang diinspeksi. Preflight struktur LIVE **🟢 SELESAI**. Akan tetapi migrasi WhatsApp tetap **🔴 NO-GO** sampai backup/restore test, approval Owner, release review dan browser UAT disiapkan. Jangan mengasumsikan CIs atau audit metadata sudah menjadi bukti recoverability.

### Checklist sisa (LIVE)
1. 🟢 Identifikasi Lovable project LIVE dan keterkaitan backend—terverifikasi dengan koneksi Lovable.
2. 🟢 Cek 12 objek dan tipe dasar serta fungsi Training/refund—SELECT-only selesai.
3. 🔴 Pastikan backup terverifikasi dan pemulihan teruji; tidak tersedia bukti pada pemeriksaan ini.
4. 🔴 Audit mendalam implikasi migrasi, grants dan fungsi SECURITY DEFINER di target sebelum apply.
5. 🔴 Persetujuan Owner eksplisit untuk migrasi SQL perubahan, merge dan publikasi.
6. 🔴 UAT nyata Owner/Receptionist/Supervisor/Housekeeping/Training dan kasus refund/ledger, tanpa transaksi keuangan baru tanpa izin.

## Addendum gerbang backup dan restore — 25 November 2026, 08.04 WIB

**Sumber baseline saat ini:** `Lovable.query_database` terhadap proyek LIVE yang telah diidentifikasi di atas, query katalog PostgreSQL **SELECT-only**. Ini bukan hasil uji restore.

| Fingerprint skema public | LIVE 25 Nov (metadata SELECT) | Snapshot 19 Nov (dokumen handoff) |
|---|---:|---:|
| Base tables | **45** | 39 |
| RLS enabled | **45** | 39 |
| Functions | **113** | 97 |
| Indexes | **119** | 101 |
| Policies | **61** | 57 |
| Triggers noninternal | **53** | 43 |
| Foreign keys | **87** | 79 |

**Catatan:** Pembanding 19 Nov adalah snapshot pada tanggal berbeda. Selisih ini tidak serta-merta menandakan kerusakan; artinya backup lama **tidak terbukti** mengembalikan kondisi LIVE yang terbaru. Arsip lain yang diverifikasi 21 Nov mempunyai 40 tabel public; pembandingan ke 45 tabel 25 Nov juga menunjukkan perlunya backup baru sebelum perubahan.

**Bukti backup historis yang benar-benar tersedia di Library privat:**
- `B25_RESTORE_ISOLATED_HANDOFF_20261119.md`: backup 19 Nov CRC dan SHA-256 lulus, tetapi restore di mesin pemeriksa tidak berjalan karena binari PostgreSQL tidak tersedia. Instruksi sebelumnya hanya mengizinkan restore uji **lokal terisolasi**, tanpa akses ke staging/LIVE.
- `LAPORAN_VERIFIKASI_BACKUP_BATURADEN_25_HOMESTAY_20261121.md`: backup `pixel-perfect-homestay-hub_261120.backup` (932.519 byte; SHA-256 `1b59a846ac400088c07216eabcbed3c9e333b386aa55e64fae3e745e432253dc`), 88/88 frame Zstd terverifikasi dan inventaris 40 tabel public cocok pada saat ekspor. **Tidak ada pg_restore/full restore PASS**; Auth/Storage dan permission rollback tidak terbukti.
- Skrip `b25_restore_isolated.py` **sudah ada di Library** dan tidak perlu dibuat ulang.
- Arsip backup aktual **tidak terpasang dalam runtime pemeriksaan 25 Nov**; perintah `pg_restore`, `postgres`, dan `docker` juga tidak tersedia. Backup tidak boleh dikirim/ditaruh di GitHub karena memuat data tamu/keuangan/Auth.

### Keputusan gerbang backup (25 Nov)
- 🟢 SELESAI: Identifikasi lokasi laporan historis dan skrip restore yang sudah ada; tidak mengulang uji checksum lama.
- 🟢 SELESAI: Fingerprint schema LIVE 25 Nov, metadata SELECT saja.
- 🔴 BELUM: Validasi backup **segar** yang mencakup keadaan LIVE sebelum migrasi, termasuk waktu/cakupan dan checksum aslinya.
- 🔴 BELUM: `pg_restore --list`/TOC dengan versi alat kompatibel; uji restore database Supabase-kompatibel **terisolasi** dengan perbandingan tabel/fungsi/RLS/ACL, serta protokol Auth dan Storage.
- 🔴 BELUM: Bukti pemulihan/rollback dengan izin Owner; jangan mencobanya pada LIVE.
- 🔴 NO-GO: apply SQL, merge, publish, deploy sampai bukti dan persetujuan terpisah dipenuhi.

**Rute paling aman:** backup baru lewat mekanisme privat Lovable; cek checksum dan waktu; gunakan isolated restore yang sudah terdokumentasi dalam lingkungan Supabase-kompatibel; *jangan unggah dump ke repo/CI GitHub*. Setelah bukti restore memadai, tinjau dan minta persetujuan terpisah untuk migrasi empat objek WhatsApp.

## Addendum uji dump/restore sintetis (bukan backup LIVE) — 25 November 2026

- 🟢 KODE: `scripts/whatsapp-template-synthetic-restore.sh` ditambahkan untuk menjalankan fixture PostgreSQL 17, membuat **dump sintetis** dengan `pg_dump -Fc`, melakukan `pg_restore` ke database **sementara baru** dan memeriksa dua versi template, satu versi aktif, tiga audit row, fungsi RPC serta flag RLS.
- 🟢 PASS TERBUKTI: GitHub Actions [run #45523664772](https://github.com/sk25ciwastra-blip/pixel-perfect/actions/runs/45523664772) **SUCCESS** pada commit `7e02f6da776dd33c32b8ab2eadb2dad2c57d48ba`: fixture izin/versi, arsip sintetis `pg_dump`, pemulihan ke database dummy baru dengan `pg_restore`, pemeriksaan struktur dan audit, tes Bun, build, serta TypeScript. Pengujian hanya menggunakan data dummy.
- 🔴 BATAS: `--no-owner --no-acl` sengaja tidak membuktikan pemulihan privilege/RLS policy/keutuhan Auth/Storage. Data fixture hanya dummy, **tidak berisi data tamu atau backup LIVE**.
- 🔴 BACKUP LIVE: arsip segar dan restore penuh ke Supabase-compatible isolated environment tetap merupakan **syarat terpisah** sebelum migrasi, tidak dapat digantikan oleh uji sintetis.

## Addendum keamanan revisi serentak dan pencarian backup — 25 November 2026

- 🟢 **Tes concurrency:** `scripts/whatsapp-template-synthetic-restore.sh` kini mensimulasikan dua sesi Owner menyimpan jenis template yang sama secara paralel. Postcheck mewajibkan 4 versi berurutan, satu ACTIVE, dan 7 baris audit (versi awal 2 dengan 3 audit). Ini menguji kunci revisi transaksi tanpa mengubah Cloud.
- 🟢 **Pencarian sumber backup:** ditelusuri Library privat, Google Drive yang terhubung dan runtime terisolasi. Belum ditemukan **arsip backup LIVE baru** yang dapat diakses untuk full restore. Penelusuran tidak membuktikan bahwa Owner tidak menyimpan backup di tempat lain.
- 🔴 **Gate restore LIVE:** tetap BLOCKED sampai arsip privat terbaru tersedia dan berhasil dipulihkan di lingkungan terpisah yang kompatibel dengan Supabase, dengan laporan fingerprint/schema/RLS/ACL/otorisasi yang dapat diaudit.
- 🔴 **Larangan:** jangan memindahkan backup yang mungkin memuat data tamu/Auth/finansial ke repositori GitHub, artifacts CI publik, chat, atau target staging/LIVE.
- **Bukti CI concurrency:** periksa GitHub Actions yang sesuai commit `e9da6dd9edd12c701d9dad36fa603249b30a980c`. Jangan menyatakan semua gate PASS sebelum job selesai.

## Addendum verifikasi paritas validator — 25 November 2026

- 🟢 KODE: `src/lib/whatsapp-template-core.ts` menyamakan larangan karakter kontrol CR dengan SQL `owner_save_whatsapp_template`. Line feed (LF) untuk paragraf pesan tetap diperbolehkan.
- 🟢 KODE TES: `scripts/whatsapp-template-core.test.ts` menguji LF diterima serta CR dan CRLF ditolak; `scripts/whatsapp-template-postgres-fixture.sql` menolak CR dari Owner RPC server.
- 🔴 CI: [Focused Gate #45526495442](https://github.com/sk25ciwastra-blip/pixel-perfect/actions/runs/45526495442) belum selesai saat pembaruan pertama. Jangan tandai PASS sebelum hasil workflow sukses.
- 🔴 Backup LIVE: arsip terbaru tetap belum ditemukan melalui sumber yang terhubung; tidak ada bukti restore penuh. Tidak ada perubahan Cloud.

## Addendum pemeriksaan posisi LIVE dan izin baca — 25 November 2026

- 🟢 SQL fixture PostgreSQL di CI kini memakai `public.employee_position` enum yang cocok dengan metadata Lovable LIVE: receptionist, housekeeping, supervisor, inspector, investor. Sebelumnya fixture menyederhanakannya sebagai `text`.
- 🟢 Ditambahkan pemeriksaan **penolakan akses template untuk Inspector dan Investor** dengan role employee aktif, selain Housekeeping, nonaktif, Training, anon. Tidak ada grant baru.
- 🟢 **GitHub Actions run #45527505680 SUCCESS** pada commit `dcb5d0e8c4aba4b240b4f1a7bb951d03fff0086c`: PostgreSQL synthetic fixture & restore, regresi Bun, build, TypeScript PASS.
- 🟢 Backups: diperiksa ulang berkas yang tersedia di percakapan; tidak ada backup PostgreSQL LIVE baru yang terlampir. Connector Lovable yang tersedia mendukung membaca database, **bukan aksi unduh backup**; jangan mengklaim arsip telah dibuat.
- 🔴 **Prasyarat Owner/ops untuk langkah berikutnya:** backup LIVE terbaru melalui saluran privat dan bukti restorasi **isolated** sesuai handoff 19/21 Nov; jangan kirim dump berisi tamu/Auth/keuangan ke GitHub/CI publik.
- 🔴 Migrasi SQL, merge, deploy, publish, UAT LIVE tetap HOLD sampai gerbang bukti backup dan persetujuan eksplisit terlewati.

## Instruksi operasional ekspor backup PRIVAT (tanpa migrasi) — 25 November 2026

**Akses target:** Lovable project [Pixel Perfect Homestay Hub](https://lovable.dev/projects/017f6e78-15f2-4d07-a38c-87cb185279bf), bukan Supabase staging. Connector Lovable yang tersedia **tidak menyediakan action export/download backup**, sehingga pengunduhan harus dilakukan oleh Owner dari UI akun Lovable; tidak boleh diganti dengan menyalin data sensitif via SQL/chat/GitHub.

**Langkah Owner minimal yang aman:**
1. Di proyek Lovable, buka **More → Database → Manage → Settings** (pada UI lama bisa berada di Cloud → Overview → Advanced settings). Temukan **Export project data / Export data** dan pilih ekspor **Database**. Nama/lokasi mungkin berbeda di versi UI tertentu; jangan menekan tombol **Restore / Remove / Reset**.
2. Unduh file `.backup` asli dari tautan ekspor atau bagian **Storage** privat milik proyek; jangan mengganti nama/mengekstrak/menyunting isinya. Simpan di folder **lokal privat di luar folder Git**, idealnya direktori terenkripsi.
3. Jangan unggah `.backup` ke GitHub, workflow artifacts publik, email umum, atau chat. Cukup sampaikan **tanggal/waktu ekspor dan nama arsip** secara teks (tanpa isi data maupun kredensial); untuk proses restore lokal, path privat hanya diberikan ke runner yang benar-benar berjalan di PC privat.
4. Pastikan ekspor menyertakan cakupan tabel dan Auth sesuai mekanisme penyedia, tetapi jangan menganggap itu menyertakan **file fisik Storage, secrets, atau kredensial**. Bukti pemulihan tabel, RLS/ACL, Auth dan Storage tetap diuji terpisah.

**Versi alat:** Laporan 21 Nov menyebut backup 20 Nov dibuat oleh **pg_dump 18.7** dengan format arsip `PGDMP 1.16` dan kompresi Zstd. Skrip Windows lama `b25_restore_windows_portable.py` **dikunci ke hash/ukuran arsip 19 November dan toolchain PG17**; karena itu **jangan menggunakannya begitu saja untuk arsip baru**. Pilih toolchain `pg_restore` versi kompatibel dengan arsip yang benar-benar diterima dan PostgreSQL target *isolated*, lalu verifikasi TOC lebih dahulu. Uji restore tidak boleh menyentuh Cloud LIVE/staging.

**Keputusan setelah ekspor:** arsip ditemukan ≠ validasi restore PASS. Migrasi tetap NO-GO hingga checksum, pembacaan TOC, pemulihan terisolasi, pembandingan fingerprint terbaru, dan persetujuan Owner yang terpisah terbukti.

## Addendum backup 25 November 2026 — arsip privat berhasil diverifikasi integritasnya

**Perubahan gerbang:** backup LIVE terbaru kini **TERSEDIA**, bukan lagi sekadar bucket kosong. Owner mengunggah `pixel-perfect-homestay-hub_261125.backup.zip` secara privat, dan `storage.objects` LIVE dikonfirmasi dengan **SELECT metadata saja**.

| Bukti | Hasil |
|---|---|
| Bucket `database_export_25_11_26` | 🟢 Private (`public=false`), 1 objek |
| Objek Cloud Storage | `pixel-perfect-homestay-hub_261125.backup`, 1.014.628 byte; dibuat 2026-11-25 01:50:59 UTC |
| ZIP diterima (lokal privat) | 1.014.806 byte, 1 entry, CRC PASS |
| File `.backup` dari ZIP | 1.014.628 byte; ukuran cocok dengan objek bucket |
| SHA-256 ZIP | `19761478eff92fc2a583084aa14a303cc4b7fcf987ada8e47725f3bcb80785bc` |
| SHA-256 berkas `.backup` | `e50c1823b62bbd25786cf03b12508ef989bebeb176cf4f526e262086b5c234f2` |
| Format PostgreSQL | `PGDMP` 1.16, header valid |
| Kompresi | 97/97 frame Zstandard berhasil didekompresi |
| Inventaris CREATE TABLE | 45 `public`, 27 `auth`, 10 `storage`; jumlah `public` sesuai fingerprint LIVE 25 Nov |

**Batas bukti:** ukuran Cloud Storage yang cocok dengan file ZIP **tidak membuktikan identitas checksum objek Cloud** (hash Cloud belum dibandingkan). Analisis header dan payload frame **tidak sama dengan `pg_restore --list` atau restore skema/data penuh**. Tidak ada `pg_restore` di runtime pemeriksa; RLS/ACL/Auth/Storage pemulihan **belum PASS**. `CREATE TABLE` count saja tidak membuktikan persamaan setiap definisi.

**Keputusan gerbang:** 🟢 backup baru ditemukan, integritas ZIP/PGDMP/frame terverifikasi dan inventaris skema cocok secara jumlah; 🔴 restore PostgreSQL terisolasi, ACL/Auth/Storage parity dan jalur pemulihan nyata belum selesai. PR #145 tetap DRAFT/HOLD dan tidak ada migrasi/publish.

**Keamanan:** backup ZIP/.backup tidak diunggah ke GitHub/CI, tidak ada SQL DML/DDL pada Cloud. Laporan JSON tanpa data tamu/keuangan hanya boleh dibagikan sebagai metadata.

## Release gates (all required, sequential)
1. 🟢 Identify correct Lovable LIVE project and database (done via connector); 🔴 approved change window still pending.
2. 🟢 Execute **only read-only** structural preflight on LIVE (done); 🔴 independent final security review still pending.
3. 🔴 Confirm verified, recoverable backup, tested rollback strategy, and audit snapshot. Do not assume a `DROP TABLE` script is a safe rollback once Owner versions exist.
4. 🔴 Resolve missing dependencies in the actual target (if any) through their separately approved migrations; never weaken Training/finance guards to bypass missing functions.
5. 🔴 Review SQL role grants, SECURITY DEFINER, token allowlists, and schema parity independently.
6. 🔴 Explicit Owner approval is required **before** any Cloud DDL, merge, deploy, or publish. Apply only the approved migration to the approved target.
7. 🔴 UAT using actual Owner / Supervisor / Receptionist / Housekeeping / Training roles, including no automatic WhatsApp sending, PDF/ledger consistency, and copy-time invalidation. No new financial transaction unless separately authorized.
8. 🔴 Recheck GitHub CI and ensure PR is reviewed before merging. Announce separate LIVE release decision.

## Explicit NO-GO conditions
- Project identity unverified, missing owner/Training/refund guard, live source mismatch, no restore proof, or inconclusive role UAT.
- Failure of template audit/version tests, permission boundaries, stale-ledger copying checks or any regression in PDF/JPG/thermal 58 mm.
- Missing approval for production-altering operation.

**Owner rule:** 🟢 denotes completed, evidenced tasks; 🔴 denotes pending/blocked tasks. Do not call full Poin 4 complete until LIVE role/UAT and release gates pass.
