# CHECKPOINT PEMBAYARAN GABUNGAN — 4 November 2026 (WIB)

**Proyek:** Baturaden 25 Homestay  
**Status:** **PASS LOKAL TERBATAS / BELUM SIAP MERGE ATAU PRODUKSI**  
**Tujuan terdekat Owner:** **Siap Operasional Sementara**, tanpa mengulang pekerjaan PASS.

## Keputusan resmi Owner

- Pembayaran dalam satu proses Booking, Check-in langsung, atau pelunasan Booking **boleh menggunakan maksimal dua metode berbeda**: Cash, QRIS, atau Transfer. Contoh Rp110.000 = QRIS Rp100.000 + Cash Rp10.000.
- Kedua pembayaran memiliki nominal, metode, receipt, dan kunci idempotensi sendiri tetapi tetap terhubung ke **satu transaksi**.
- Penyimpanan harus atomic: jika salah satu bagian gagal, seluruh operasi dibatalkan.
- DP minimum mengikuti pengaturan Owner (saat ini 40% dari grand total, dibulatkan ke atas ke satu rupiah), Check-in langsung harus lunas; Finance, dual identity operator/sesi kas, komisi, refund, audit, dan receipt per-payment tidak boleh rusak.
- PR #34 yang membatasi satu metode **ditutup tanpa merge**. Aturan bisnis **AB-PAY-004** disahkan dan didokumentasikan dalam **PR #35 merged**; ini tidak berarti implementasinya live.

## Status Git dan worktree saat Owner beristirahat

- Repository: `sk25ciwastra-blip/pixel-perfect`.
- `main` / basis implementasi: `397fa8f303fe33d979e8d125cddfc4fd4b19aa6d` (jangan mengasumsikan HEAD terbaru tanpa cek ulang).
- **Branch lokal Codex:** `feat/combined-payments-20261104`.
- **Worktree lokal Windows:** `C:\tmp\pixel-perfect-combined-payment`.
- **Belum commit / push / PR** untuk implementasi pembayaran gabungan; **jangan reset, overwrite, hapus, atau mulai ulang** pekerjaan lokal yang belum tersimpan di GitHub.
- Kandidat source implementasi: `src/components/formulir-pemesanan.tsx`, `src/routes/booking.tsx`, `supabase/migrations/20261104000000_atomic_combined_payments.sql`, `scripts/extra-guest-receipt-pure-tests.cjs`.
- SQL **reviewed** dengan perlindungan fingerprint telah terintegrasi ke migrasi source lokal menurut laporan Codex; source SHA sama dengan reviewed saat itu. Belum diverifikasi di remote.
- `src/routeTree.gen.ts` regenerasi tidak terkait sudah dikembalikan khusus file itu. Jangan sertakan `.bak`, runner pribadi, log, dan cluster di commit fitur tanpa review.
- **Tidak ada migrasi Cloud, aktivasi flag produksi, publish, deploy, merge implementasi, atau perubahan transaksi demo** selama pekerjaan ini. Pencabutan RPC legacy `20261022000004_revoke_legacy_rpc_execute.sql` tetap DILARANG.

## Bukti PASS lokal — 4 November 2026

**Fondasi:**
- PostgreSQL portable **17.11** ditemukan dan bootstrap isolasi dengan Supabase stubs, Drizzle 0000–0005, pre-seed, seed, post-seed, Finance Foundation, Training, Extra Guest/Receipt, dan migrasi gabungan **PASS**.
- Marker `BOOTSTRAP_COMBINED_READY` di `C:\tmp\combined-bootstrap-20261104-055303-541\BOOTSTRAP_COMBINED_READY`. Migrasi `20261104000000_atomic_combined_payments.sql` dan keempat fungsi RPC gabungan terbukti dibuat di lab.
- PostgreSQL test berulang kali dihentikan aman, terakhir **`LOCAL CLUSTER: no server running`**.

**Fungsi pembayaran dan Receipt (PostgreSQL lokal):**
- Booking dengan dua DP, pembayaran awal total **Rp36.000**: **PASS**.
- Retry dengan kunci sama mengembalikan hasil sama tanpa duplikat; percobaan perubahan payload dengan kunci sama ditolak: **PASS**.
- Pelunasan dua metode pada transaksi yang sama: **PASS**.
- Pengujian kegagalan komponen kedua melakukan atomic rollback: **PASS**.
- Check-in langsung QRIS **Rp80.000** + Cash **Rp10.000** = **Rp90.000**: **PASS**.
- Pencatatan Cash/QRIS terpisah, guard duplikasi penerima komisi per-kamar: **PASS terbatas untuk skenario uji** (BELUM membuktikan nominal komisi dan refund).
- `issue_payment_receipt` dua pembayaran, snapshot 58 mm, print original, `SALINAN 1`, idempotensi print: **PASS untuk fungsi database dan metadata**, **bukan cetak fisik**.
- Semua uji smoke/extended memakai blok transaksi `ROLLBACK`; data tesnya tidak ditinggalkan permanen di lab.
- Pure Extra Guest/Receipt, Training pure (sebelumnya), TypeScript, build client/SSR/Nitro, RPC contract, dan `git diff --check`: **PASS sesuai laporan Codex**. Warning `inputValidator` hanya deprecation.
- Log extended: `C:\tmp\combined-bootstrap-20261104-055303-541\runtime-20261104-063236\runtime-test.log`.

**Concurrency nyata (dua koneksi PostgreSQL secara paralel):**
- Setelah perbaikan runner PowerShell, dua sesi mencoba membuat Booking dengan **request key sama**, dan dua sesi mencoba melakukan pelunasan dengan **request key sama**: **PASS**.
- Kedua klien mendapatkan JSON identik, satu batch Booking dengan tepat 2 pembayaran DP, satu batch pelunasan dengan tepat 2 pembayaran tambahan (total 4 pembayaran dan lunas). Database sementara dibuang, PostgreSQL dimatikan aman.
- Marker `CONCURRENCY_TEST_PASS`; log/artifacts: `C:\tmp\combined-bootstrap-20261104-055303-541\concurrency-20261104-064817`.
- **Batas hasil:** concurrency untuk kunci sama teruji. Kombinasi concurrency lainnya belum otomatis tervalidasi.

## Pekerjaan TERTUNDA — prioritas saat melanjutkan

1. **Finance lanjutan (PERTAMA):** tes runtime lokal untuk *nominal* komisi mode persentase berdasarkan penerimaan bersih sesudah refund; mode per-kamar tetap pada refund parsial dan nol pada refund 100%; pembulatan komisi; rekonsiliasi Cash vs QRIS/Transfer, sesi kas OPEN/CLOSED, audit, refund setelah closing sesuai aturan Owner. Jangan mengganti aturan Finance150 yang sudah PASS.
2. **Authorization peran (KEDUA):** tes runtime dengan JWT/fixture role yang valid untuk Owner, Supervisor, Receptionist, dan Training Day 1/2; termasuk dual identity operator dan pemilik sesi kas, jalur supervisor membantu sesi aktif, trainee tidak boleh membuka sesi sendiri, akses tidak sah ditolak, audit operator tetap benar.
3. **Konsolidasi kode (KETIGA):** periksa status `git status`, bandingkan migrasi reviewed terhadap source; sertakan hanya file implementasi dan tes permanen yang relevan; jalankan regresi terdampak (TypeScript/build/RPC contract) bila ada perubahan; **jangan ulang bootstrap, smoke, Receipt, atau concurrency yang sudah PASS tanpa indikasi regresi**.
4. Jika seluruh gate kritis PASS, **commit dan push branch terisolasi**, buat **SATU PR proposal** untuk review, **jangan merge otomatis**.
5. Aktivasi/migrasi Lovable Cloud, publish, feature flags ON, data transaksi live, dan cetak printer fisik 58 mm tetap membutuhkan gate dan persetujuan Owner terpisah. Belum boleh dilabeli GO-LIVE.

## Cara melanjutkan setelah semua alat ditutup

1. Buka **Windows PowerShell** biasa; Codex CLI berlokasi di `C:\Users\USER\.codex\.sandbox-bin\codex.exe`.
2. Pindah ke worktree yang **sudah ada**: `cd 'C:\tmp\pixel-perfect-combined-payment'`; periksa `git status --short --branch` sebelum melakukan perubahan apa pun.
3. Jika perlu Codex, jalankan `& 'C:\Users\USER\.codex\.sandbox-bin\codex.exe'` dari dalam worktree tersebut. Jangan reset atau overwrite file dirty.
4. Satu tugas awal yang paling tepat: **buat dan jalankan pengujian Finance lanjutan (komisi nominal dan refund parsial/penuh) di database lokal terisolasi**, lanjutkan dengan authorization. Pertahankan log bukti dan berhenti pada error yang konkret.
5. Jika Codex tidak bisa menjalankan PowerShell/cmd karena kebijakan aplikasi, Owner dapat menjalankan instruksi PowerShell biasa; jangan terus meminta Codex mengulang diagnosis atau membuat hasil PASS tanpa eksekusi.

## Batas klaim dan keamanan

- **PASS LAB ≠ PASS CLOUD, PASS BUILT ≠ PUBLISHED, RECEIPT RPC PASS ≠ PRINTER FISIK PASS.**
- Status migrasi baru di GitHub `main` **belum terpasang**, karena source implementasi masih lokal dan belum ada PR.
- Seluruh path di atas merupakan **path lokal Windows Owner**, bukan akses yang bisa dibaca GitHub/ChatGPT secara langsung.
- Aturan Owner: Codex = fungsi/logika, Lovable = desain/UI; ChatGPT mengambil pekerjaan GitHub/Cloud langsung jika akses tersedia; jika tindakan lokal perlu Owner gunakan **🛑 GILIRAN KAPTEN**. Motto: **“jika ada yang mudah, kenapa harus sulit.”**
