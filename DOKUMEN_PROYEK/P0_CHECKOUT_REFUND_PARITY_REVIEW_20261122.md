# Baturaden 25 Homestay — P0 Checkout / Refund parity review

**22 November 2026 — SOURCE-ONLY, NO CLOUD WRITES, NO-GO.**  
Tindak lanjut [Issue #2](https://github.com/sk25ciwastra-blip/pixel-perfect/issues/2#issuecomment-7075597116). Patch **terpisah dari PR #101 / Issue #102**; source utama `main` tidak ditimpa.

## Masalah dan keputusan

1. Fungsi `public.check_out_transaction(uuid)` Lovable Cloud aktif belum menghitung settlement. Body Cloud `md5(prosrc)=eaa0b3e3cf13478999dee8daaa9b2e92`. Sementara migrasi historis `20261019000001_harden_checkout_payment_settlement.sql` di GitHub melakukan validasi checkout `paid - refunded = price_snapshot + charges`.
2. Migrasi historis tersebut memasang `refunds_transaction_state_guard_trigger` yang menolak perubahan `finance_refunds` sesudah `check_out`. Hal ini berbenturan dengan aturan Owner **AB-FIN-007**: refund sah oleh Owner dapat mereferensikan transaksi dan sesi closing FINAL, dengan sumber dana yang diizinkan, tanpa mengubah closing historis.
3. Akses langsung `INSERT/UPDATE/DELETE` ke `public.finance_refunds` tidak diberikan ke `anon`/ `authenticated` pada Cloud; tabel RLS ON. RPC `public.create_finance_refund` milik postgres, SECURITY DEFINER, hanya aktor Owner yang boleh refund. Body `md5(prosrc)=80bcdeabfc038907ee6dcea4d9d0e714` pada snapshot.
4. **Jangan ulang/overwrite** migrasi historis. Kandidat yang diajukan adalah patch source baru **`supabase/pending/20261122000002_checkout_settlement_refund_safe_review.sql`**. Kode ini tidak menjalankan refund otomatis atau mengubah closing.

## Perubahan yang diusulkan — belum dieksekusi

| Komponen | Patch | Yang tidak disentuh |
|---|---|---|
| Checkout | `FOR UPDATE` pada satu TRX + hitung netto dan total kewajiban; tolak underpay/overpay; tetap `occupied → dirty`, catat audit | Tidak mengubah satu nomor TRX, harga, riwayat, atau jadwal |
| Payments | BEFORE trigger pada INSERT/UPDATE/DELETE yang mengunci TRX; tolak setelah `check_out/cancelled`; cegah pindah TRX | Tidak menghapus atau mengedit baris lama |
| Charge events | Guard terpisah dengan aturan transaksi yang sama | Tidak mengedit refund |
| Refund | Pertahankan RPC Owner + guard source session, tanpa trigger baru pengunci `finance_refunds` terhadap status checkout | Tidak mengubah kas FINAL/komisi historis |
| Security | Pemeriksaan hash baseline dan ACL/RLS, stop-on-drift, SECURITY DEFINER helper `search_path=''` tanpa EXECUTE dari pengguna aplikasi | Tidak memberikan grant DML baru |

Patch sudah dibatasi `BEGIN/COMMIT`, `lock_timeout=5s`, `statement_timeout=30s`, pemeriksaan body/ACL dan keberadaan guard agar **menolak instalasi parsial atau pada Cloud yang berubah**. Semua hash sengaja spesifik terhadap snapshot 22 November; jangan menghapus STOP guard sekadar agar migrasi berjalan.

## Pengujian dan bukti yang tersedia

- Source contract review statis memeriksa exact settlement, locking, tidak adanya trigger refund terlarang, status kamar, audit, SQL preflight serta ketiadaan mutasi data massal.
- `scripts/p0-checkout-refund-parity-contract.test.cjs` telah dijalankan pada GitHub Actions Node 22: **6/6 tests PASS, 0 FAIL**; [log run #44997920171](https://github.com/sk25ciwastra-blip/pixel-perfect/actions/runs/44997920171).
- `scripts/p0-checkout-refund-disposable-fixture.sql` + `scripts/p0-checkout-refund-disposable-assertions.sql` diuji di **PostgreSQL 17 Docker ephemeral pada CI**; database tidak membuka port, tidak memakai secret Cloud dan dihancurkan pada akhir job.
- **PASS PostgreSQL native PostgreSQL 17 disposable** melalui GitHub Actions [run #44997920171](https://github.com/sk25ciwastra-blip/pixel-perfect/actions/runs/44997920171) (22 November 2026): fixture sintetis, dua pekerjaan CI berhasil. Tes SQL memasang kandidat review ke database sementara dengan **hanya kedua fingerprint mock yang diganti dalam salinan tak terlacak** untuk mencocokkan fungsi checkout/refund tiruan; file migrasi asli tetap memakai hash tepat dari Cloud. Uji membuktikan: Checkout exact -> dirty, under/over/charge/refund-before shortfall ditolak, payment/charge setelah checkout diblokir, refund Owner dari OWNER_FUNDS/OPEN lewat mock berhasil, sumber sesi FINAL dan non-Owner ditolak, audit dan perubahan kamar diperiksa. **Bukan** PASS untuk full Cloud finance refund RPC, race dua sesi, browser, restore atau Cloud apply.
- PASS native terdahulu untuk Finance/HK/Checkout di PR #73/#74 tetap dihormati; **hanya seam yang berubah berikut** perlu pengujian baru di database disposable.

### Skenario uji sempit untuk Codex (HARUS lulus sebelum izin Cloud)

1. CHECK-IN lunas tepat -> Checkout sukses dan kamar `dirty`; belum bayar, kelebihan bayar, refund sebelum checkout yang menyebabkan shortfall, dan charge tambahan belum dilunasi -> tolak secara atomik. Tidak ada perubahan kamar, TRX, audit ketika ditolak.
2. Payment/charge INSERT, UPDATE, DELETE yang beradu dengan Checkout: satu hasil serial sah; tidak ada write ke TRX closed, tidak ada deadlock yang meninggalkan state setengah berubah; no double occupancy.
3. **Refund Owner setelah `check_out` dan setelah closing FINAL**: bisa melalui RPC sah dengan `OWNER_FUNDS` atau sesi OPEN lain yang berwenang, serta perhitungan komisi PERCENTAGE/PER_ROOM yang berlaku. Refund langsung oleh authenticated/anon ditolak. Sumber refund sesi FINAL tetap ditolak. History closing FINAL tidak ditulis ulang.
4. Trial anonymous/no-UID/Receptionist/Housekeeping tidak bisa memanggil Checkout di luar role, tidak bisa memanggil trigger helper melalui RPC, dan tidak dapat memodifikasi tabel refund langsung.
5. Trigger audit dan Housekeeping Cloud fixture tetap semantik; nomor TRX tetap sama, COPY receipt tidak bertambah hanya karena modal muncul, dan tidak ada input-output baru pada frontend.
6. Cek SQL fail-closed: fingerprint salah, satu trigger guard sudah ada, RLS/grant refund berubah, atau target tak lengkap -> **STOP tanpa DDL parsial**. Pada rollback transaction-level tidak ada jejak mutasi data.

## Gate backup dan rollout (NO-GO)

- Backup privat `pixel-perfect-homestay-hub_261120.backup` telah lulus integritas 88/88 frame namun **restore PostgreSQL penuh, role/RLS/Auth/Storage belum lulus**. Snapshot backup mendahului dua akun `B25EMP-` dan sesi kas tambahan yang sekarang ada. Backup itu **tidak boleh menjadi restore state terkini**.
- Sebelum migrasi: buat backup BARU target Lovable yang disimpan privat, uji `pg_restore` di lingkungan kompatibel terisolasi termasuk validitas auth/ACL/RLS, rekonsiliasi akun dan nomor, lalu ambil kembali fingerprint Cloud dan **persetujuan Owner terpisah** untuk SQL target tersebut.
- Setelah persetujuan, lakukan patch pada jendela operasional terkendali (tanpa transaksi masuk), baca tabel/ACL/fingerprint sebelum dan sesudah, validasi hasil dua skenario pembayaran dan refund di fixture terisolasi, bukan data tamu nyata. Siapkan forward-fix berdasarkan definisi asli fungsi dan pemetaan dependensi; **jangan rollback ke checkout tanpa pelunasan** untuk menutupi kegagalan.
- Sampai backup restore dan uji native terbukti, **NO-GO**; tidak merge, deploy/publish, mengubah DEMO/Cloud SQL, closing atau kas.

## Jaga pembagian pekerjaan

**Codex**: review fungsi dan guard, jalankan uji PostgreSQL disposable sempit, revisi source berdasar hasil dan siapkan bukti PR. **Lovable**: tidak perlu desain ulang atau perubahan tombol untuk kasus ini. **Owner**: keputusan Cloud hanya setelah hasil konkret PASS dan backup restore. Aturan pembatalan Booking non-refundable serta perubahan jadwal maksimal 2 jam tetap ada pada Issue #102 dan tidak disentuh patch P0 ini.
