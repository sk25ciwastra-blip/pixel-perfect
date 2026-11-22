# Issue #99 · Hapus khusus Owner

Implementasi untuk Baturaden 25 Homestay berdasarkan keputusan Owner dan checkpoint resmi 21 November. Baseline GitHub `main` adalah `bdabf17` (merge PR #98). Bukti PASS untuk kesiapan teknis akun asli, hak akses, perubahan kata sandi mandiri, Finance, Training, otorisasi gabungan dan Housekeeping dipertahankan. Suite lama tidak dijalankan ulang. [Issue #99](https://github.com/sk25ciwastra-blip/pixel-perfect/issues/99) · [Checkpoint akun dan akses](CHECKPOINT_AKUN_ASLI_DAN_HAK_AKSES_20261121.md) · [Checkpoint password mandiri](CHECKPOINT_UBAH_PASSWORD_MANDIRI_20261121.md)

## Keputusan implementasi

- **Tim & Akses.** Hapus mengarsipkan satu baris karyawan secara permanen. ID, akun Auth, dan foto tetap ada untuk menjaga identitas historis. Role karyawan target dicabut, akun diblokir, sesi target dihapus dan refresh token lama dicabut di transaksi database yang sama. Daftar Tim & Akses menyembunyikan arsip. Server menolak akun sendiri, Owner lain, sesi OPEN, Training ACTIVE, dan keterkaitan transaksi atau riwayat keuangan yang ditemukan. Penonaktifan dari Ubah tetap merupakan alur tersendiri.
- **Daftar Transaksi.** Hapus permanen tersedia untuk `check_out` atau `cancelled` tanpa pembayaran maupun referensi terkait. Semua FK yang menunjuk transaksi diperiksa, termasuk CASCADE dan SET NULL. Bukti, persetujuan, dan keterkaitan Housekeeping dijaga dengan menolak penghapusan transaksi tersebut. Nomor dan UUID yang sudah dipakai dicadangkan oleh audit. Sesi kas, kamar, saldo dan penomoran tidak dimutasi oleh RPC. Hitungan jumlah transaksi di Laporan berkurang sesuai transaksi DEMO yang dihapus. Pembayaran DEMO lama dan sesi kas OPEN yang disebut checkpoint tetap tunduk pada alur operasional yang berlaku.
- **Konfirmasi dan audit.** Owner mengetik ulang ID atau nomor persis dan menyatakan target adalah DEMO. Schema baseline tidak memiliki penanda DEMO otoritatif. Pernyataan Owner adalah sumber klasifikasi DEMO pada alur ini. Guard status, pembayaran, dan FK tetap diperiksa database. Audit privat mencatat waktu bertipe `timestamptz`, actor UID, UUID/kode target, aksi, alasan `demo_cleanup`, dan hasil. Input konfirmasi, nama, NIK, nomor HP, dan rahasia tidak direkam. Hasil penolakan bisnis yang mencapai RPC dicatat. Permintaan tanpa hak ditolak sebelum target dibaca.
- **UI dasar.** Tombol dan dialog memakai komponen yang sudah ada. Sesudah sukses, Tim & Akses memuat ulang daftar. Daftar Transaksi memuat ulang hitungan, pagination dan rentang tahun, serta menutup detail target yang terhapus. Booking, Dashboard dan Keuangan memakai pembacaan/realtime tabel yang sudah ada. Lovable dapat menyempurnakan tampilan modal dan tombol setelah review.

## Hasil pengecekan

| Hasil | Bukti |
| --- | --- |
| PASS | PostgreSQL lokal baru dan PostgREST 16.4 pada loopback. HTTP/RPC langsung untuk kedua jenis target ditolak bagi karyawan dan anonim. Sesi Owner yang hilang juga ditolak pada RPC. DELETE langsung diblokir bagi role aplikasi. |
| PASS | Guard ID salah, konfirmasi DEMO, Owner/diri sendiri, sesi OPEN dan riwayat FINAL, Training aktif, booking/check-in aktif, pembayaran/komisi, refund, struk, catatan idempotency dan Housekeeping. |
| PASS | Dua permintaan paralel untuk target sama menghasilkan satu tindakan dan satu event sukses. FK yang muncul saat DELETE memicu rollback. Penambahan pembayaran paralel mempertahankan pembayaran dan transaksi. Snapshot fixture memverifikasi akun lain, pembayaran, sesi kas, kamar, HK dan penomoran. |
| PASS | UI dan wiring POST diuji dengan stub pada komponen sebenarnya. Tombol tampil untuk Owner saja. Batal dan ID salah tidak memanggil endpoint. Penolakan mempertahankan dialog, sukses menjalankan callback refresh. |
| PASS | TypeScript, build dan `git diff --check`. |
| BELUM DIUJI | Browser login end-to-end, perilaku Auth provider pada lingkungan Lovable, dan kontrak katalog Cloud. Bukti HTTP memakai PostgREST lokal dan JWT sintetis. |

Reproduksi dari root repo dengan Node, dependensi aplikasi terpasang, PostgreSQL lokal, dan opsional PostgREST lokal:

```text
node scripts/owner-delete-ui-tests.cjs
node scripts/owner-delete-runtime-tests.cjs <direktori-bin-postgresql> <executable-postgrest>
node node_modules/typescript/bin/tsc --noEmit
bun run build
git diff --check
```

## Review sebelum aktivasi

SQL disimpan di `supabase/pending/20261122000000_owner_delete.sql`. Setelah ada persetujuan terpisah, operator perlu mencocokkan definisi dan hak akses `auth.users`, `auth.sessions`, `auth.refresh_tokens`, FK transaksi, serta relasi Finance dan Housekeeping pada schema Lovable yang akan diaktifkan. Verifikasi role pemilik RPC dapat memperbarui ban, mencabut sesi/token target, dan menjalankan guard walaupun RLS aktif. Uji login dan refresh di browser pada lingkungan terisolasi dengan akun fixture. JWT yang sudah terbit tetap mengikuti masa berlakunya pada endpoint lama yang tidak memeriksa sesi. RPC Hapus memeriksa sesi dan role untuk setiap tindakan.

Semua mutasi pengujian dilakukan pada fixture lokal. Cloud SQL, data DEMO/LIVE, merge, deploy, dan publish berada di luar pelaksanaan PR ini.
