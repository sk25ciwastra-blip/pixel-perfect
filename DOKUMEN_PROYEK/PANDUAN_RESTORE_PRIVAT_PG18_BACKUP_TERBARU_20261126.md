# Baturaden 25 Homestay — Panduan uji restore privat backup LIVE terbaru

**Tanggal:** 26 November 2026 (WIB)  
**Status:** prosedur/alat **tersedia dalam PR review**, **belum ada backup LIVE baru, belum ada restore LIVE yang PASS, dan belum ada izin aktivasi SQL Overtime**.

## Alasan membuat alat baru

Backup privat `pixel-perfect-homestay-hub_261125.backup.zip` dari 25 November berisi **45** tabel publik, sedangkan LIVE telah memiliki **51** pada audit 26 November. Enam tabel tambahan mencakup dua tabel penawaran, dua tabel template WhatsApp, dan dua tabel profil homestay. Backup 25 Nov **tidak dapat dijadikan satu-satunya pemulihan aplikasi terkini**. Supabase Staging memiliki **33 tabel** dan tidak dipakai sebagai lokasi restore. Bukti sintetis rollback PR #181 tetap PASS tetapi tidak menggantikan full restore.

## Berkas dan keamanan

- `scripts/b25_restore_private_windows_pg18.py`: pengganti runner Windows lama yang **tidak lagi terkunci ke ZIP 25 November**. Dapat membaca ZIP ekspor LIVE baru, meminta SHA-256 independen untuk mode restore, memeriksa header PGDMP dan `pg_restore --list`, membandingkan **nama tabel** dengan manifest, kemudian *opsional* memulihkan ke cluster PG18 baru yang hanya listen `127.0.0.1`.
- `DOKUMEN_PROYEK/B25_LIVE_CATALOG_SNAPSHOT_20261126.json`: **metadata publik saja**, hasil `SELECT` dari LIVE 26 Nov; **51 tabel publik**, 51 tabel RLS, 123 fungsi, 63 policies, 134 indexes, 55 triggers dan 95 foreign keys. **Manifest adalah snapshot tanggal tersebut**, bukan jaminan tidak berubah.
- `scripts/test_b25_restore_private_pg18.py`: tes Python dengan **ZIP sintetis palsu**, tanpa dump nyata.
- Workflow GitHub hanya mengetes keamanan parser/metadata pada ZIP sintetis palsu. **Tidak ada backup sensitif dikirim ke GitHub, CI, atau repo.**
- Runner **hanya untuk Windows** dengan PostgreSQL 18 tools terpercaya (`pg_restore.exe`, `initdb.exe`, `pg_ctl.exe`, `createdb.exe`, `psql.exe`). Jalur koneksi, database dan port target Cloud **tidak dapat diisi dari CLI**: fungsi restore selalu memakai cluster/temp database lokal baru dan SCRAM.

**Status pengujian pengaman:** **9/9 unit test PASS** pada [GitHub Actions run #45753838684](https://github.com/sk25ciwastra-blip/pixel-perfect/actions/runs/45753838684) untuk ZIP **sintetis** dan metadata LIVE 51 tabel. Pengujian ini **tidak** menjalankan PostgreSQL 18 restore nyata dan tidak membuktikan kompatibilitas backup baru yang belum ada. Skrip tetap dalam PR review hingga di-merge sesuai izin Owner.

## Gerbang sebelum memulai — ekspor baru harus tersedia

**Ekspor terbaru saat audit masih 25 Nov.** Owner perlu mendapatkan **file ZIP asli ekspor LIVE setelah skema 51 tabel** lewat Lovable Cloud di akun sendiri, lalu menyimpannya **di luar direktori GitHub**, misalnya folder privat lokal yang terenkripsi. Jangan unggah backup ke ChatGPT, GitHub, Google Drive publik, staging, atau CI. Backup baru mungkin membutuhkan PostgreSQL tooling lebih mutakhir jika formatnya berubah; script ini secara sengaja memerlukan versi 18 dan akan STOP bila tidak kompatibel.

Catat tanggal/jam ekspor dan checksum yang diverifikasi secara independen dari sumber yang dipercaya. **SHA yang hanya dihitung dari ZIP yang sama tidak membuktikan asal-usulnya**.

Sebelum memakai ZIP baru, **periksa kembali katalog LIVE read-only dan bandingkan manifest**. Jika ada tabel tambahan atau perubahan definisi setelah 26 November, buat **snapshot baru yang ditinjau Owner**; jangan menyiasati pemeriksaan dengan mengurangi ekspektasi atau menyesuaikan hasil secara asal.

## Penggunaan Windows PowerShell (lokal, tidak mengakses Cloud)

Lakukan **inspeksi saja** dulu (tidak ada database lokal yang dibuat):

```powershell
py -3 scripts\b25_restore_private_windows_pg18.py `
  --backup "D:\B25-PRIVATE\backup-live-terbaru.backup.zip" `
  --manifest "DOKUMEN_PROYEK\B25_LIVE_CATALOG_SNAPSHOT_20261126.json" `
  --postgres-bin "D:\PostgreSQL18\bin" `
  --mode inspect `
  --report "D:\B25-PRIVATE\b25-inspect-report.json"
```

Inspeksi menghasilkan status **`INSPECT_PASS_TOC_AND_TABLE_NAMES_ONLY`** jika ZIP/PGDMP/TOC cocok dan 51 nama tabel ditemukan. **Bukan bukti restore.** Bila ZIP 25 November digunakan, pemeriksaan wajib gagal dengan `BACKUP_TABLE_SET_DIFFERS_FROM_CURRENT_LIVE`.

Setelah arsip baru lolos TOC dan SHA ZIP sudah diverifikasi secara **independen**, lakukan **restore hanya di komputer lokal**:

```powershell
py -3 scripts\b25_restore_private_windows_pg18.py `
  --backup "D:\B25-PRIVATE\backup-live-terbaru.backup.zip" `
  --manifest "DOKUMEN_PROYEK\B25_LIVE_CATALOG_SNAPSHOT_20261126.json" `
  --postgres-bin "D:\PostgreSQL18\bin" `
  --mode restore `
  --ack-isolated-restore `
  --expected-zip-sha256 "<SHA256-ZIP-ASLI-YANG-SUDAH-TERVERIFIKASI>" `
  --report "D:\B25-PRIVATE\b25-restore-report.json"
```

Status `LOCAL_RESTORE_PASS_LIMITED_NOT_CLOUD_RECOVERY` berarti **sebagian pemulihan skema/data lokal dan hitungan katalog** lulus (tabel/fungsi/policy/index/trigger/FK). Perhatikan runner memakai `--no-owner --no-acl`, sehingga tidak membuktikan hak akses role asli, Auth login, file fisik Storage, secrets, perilaku API Supabase, ataupun cutover Cloud. Hasil runner ini **tidak boleh sendiri mengubah NO-GO menjadi GO**.

Jika timbul `LOCAL_RESTORE_FAILED_DEPENDENCIES_OR_COMPATIBILITY`, `BACKUP_TABLE_SET_DIFFERS_FROM_CURRENT_LIVE`, checksum mismatch, atau kegagalan shutdown cluster lokal: **STOP**, simpan laporan metadata privat untuk dianalisis, **jangan** mencoba restore pada Cloud LIVE/Staging sebagai jalan pintas.

## Diagnostik ketika RESTORE gagal (hasil nyata 26 November 2026)

Owner telah melakukan pemeriksaan pada ZIP privat `pixel-perfect-homestay-hub_261126.backup.zip`:
- **INSPECT PASS:** 51/51 tabel, PostgreSQL 18, CRC ZIP PASS.
- **RESTORE awal BLOCKED:** `LOCAL_RESTORE_FAILED_DEPENDENCIES_OR_COMPATIBILITY`. Ini **bukan** bukti bahwa isi backup rusak.
- Runner awal PR #183 menghapus log error PostgreSQL dalam folder sementara setelah selesai, jadi penyebabnya belum dapat diidentifikasi dari laporan yang sudah ada.
- **Perbaikan terpisah dalam PR review:** saat TOC custom dump tidak mempunyai entry `SCHEMA - public`, pertahankan `public` default dari cluster lokal baru; jika `pg_restore` masih gagal, tulis kategori penyebab yang aman `diagnostic_category` dalam JSON. **Tidak ada SQL mentah, nilai data, nomor WA, atau kredensial yang dikeluarkan** dari log.
- Sampai PR tersebut lulus pengujian, **jangan ulangi restore dengan runner lama atau mencoba menjalankan dump langsung di Cloud/Staging**. Ketika diuji kembali, kirim hanya `status`, `reason_code`, `diagnostic_category`, dan `toc_declares_public_schema`. Jangan kirim backup maupun log mentah.

**Status:** full restore **BELUM PASS**, tidak ada perubahan LIVE/Cloud, release gate Overtime tetap NO-GO.

---

## Batas otorisasi

- **TIDAK ADA:** backup LIVE baru yang diekspor oleh ChatGPT; tool Lovable yang terhubung hanya bisa melihat database metadata, tidak mempunyai aksi ekspor.
- **TIDAK ADA:** tindakan import/restore ke Supabase Staging ataupun Lovable LIVE.
- **TIDAK ADA:** perubahan Cloud SQL, template ACTIVE, transaksi, publish atau role.
- **TETAP PERLU:** backup LIVE baru, uji restore terisolasi, parity RLS/ACL/Auth/Storage yang ditinjau terpisah, dan **izin Owner khusus** sebelum SQL Overtime diaktifkan.

Acuan: [Gate Overtime](POIN4_OVERTIME_WHATSAPP_RELEASE_GATE_20261126.md), [Checkpoint Utama](CHECKPOINT_UTAMA_20261126.md), dan [Panduan Obrolan Baru](PANDUAN_MULAI_OBROLAN_BARU.md).
