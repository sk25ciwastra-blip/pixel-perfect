# Baturaden 25 Homestay — Checkpoint reset DEMO & ID resmi (21 Nov 2026)

## Sukses: SQL allocator B25EMP-001 LIVE
- Owner mengizinkan aktivasi penomoran dan reset DEMO.
- Sumber exact: `supabase/pending/20261121033000_b25_employee_id_allocator.sql` dari GitHub `main`.
- SQL dieksekusi pada Lovable LIVE project `017f6e78-15f2-4d07-a38c-87cb185279bf`, PostgreSQL 17.6.
- Postcheck PASS: sequence dan fungsi ada, `service_role` dapat execute/use, `anon` dan `authenticated` tidak dapat memanggil fungsi/sequence.
- Tidak memanggil allocator (`nextval`) dan belum ada karyawan `B25EMP-`; penerbitan berikutnya dimaksudkan mulai `B25EMP-001`.
- PR #92 sudah merged ke `main` pada SHA `562e958775799ec93216e5aac4572d02890c8521`.
- Tidak ada deploy/publish sehingga UI LIVE belum tentu memakai kode yang terbaru.

## Reset DEMO LIVE: BELUM DIEKSEKUSI
- Manifest historis terbatas pada 11 akun staf lama dan 23 tabel operasional/102 baris; 17 transaksi, 24 pembayaran, 5 sesi kas (2 OPEN dan 3 FINAL). Empat akun Auth non-karyawan harus dipertahankan.
- Backup privat yang diunggah Owner `pixel-perfect-homestay-hub_261120.backup`: pemeriksaan header/dekompresi sebelumnya lulus; restore penuh belum PASS; tidak pernah dipublikasikan di GitHub.
- Script satu transaksi dengan guard jumlah, tanpa CASCADE, disiapkan hanya di branch `validation/b25-acl-pg17-isolated-20261121`:
  `supabase/pending/20261121_owner_approved_demo_cutover_phaseA_ATOMIC.sql`.
- Percobaan pertama berhenti pada preflight karena ambiguitas nama variabel SQL. **Seluruh data tetap utuh**, dan bug script sudah diperbaiki.
- Percobaan kedua ditolak oleh pemeriksaan keselamatan alat. **Tidak ada penghapusan maupun perubahan kamar/akun**. Tidak dicoba melakukan bypass atau memecah perintah.
- Postcheck READ-ONLY sesudah pemblokiran: 11 karyawan, 17 transaksi, 24 pembayaran, 5 sesi kas, 15 Auth, 4 kamar occupied, 1 kamar dirty. Generator B25EMP aktif.

## Langkah eksekusi resmi berikutnya
1. Perlakukan script reset sebagai **rencana berizin, bukan sesuatu yang sudah berjalan**. Operator berkewenangan memakai SQL Editor resmi dan melakukan pemeriksaan izin/backup sendiri; jangan mencoba mengakali pemblokiran.
2. Fase A reset basis data operasional harus atomik dan memberi postcheck 0 baris pada tabel DEMO sambil mempertahankan Owner, kamar, harga, konfigurasi. Kamar occupied DEMO diarahkan ke DIRTY untuk pembersihan fisik, bukan otomatis READY.
3. Fase B 11 Auth users hanya melalui Auth Admin API / panel resmi; tidak melalui `DELETE auth.users`. Daftar tepat 11 akun tersedia di manifest privat lokal (tidak dipush GitHub); empat Auth nonstaf wajib tetap utuh.
4. Sebelum GO: verifikasi restore Auth/Storage sesuai risiko, kondisi fisik kamar, deploy/publish yang disetujui terpisah, login staf asli dan pengujian operasional satu putaran.

**Status saat checkpoint:** ID SQL aktif PASS; DEMO reset STOP/BLOCKED; tidak ada deploy, publish atau staging change; tetap NO-GO operasional nyata.

## KOREKSI KRITIS — AUDIT TARGET DEMO 21 NOVEMBER 2026 (CHECKPOINT LANJUTAN)

Pemeriksaan yang lebih rinci memperlihatkan **tidak semua 11 karyawan lama terbukti DEMO**. Klasifikasi hanya dari `employee_id NOT LIKE 'B25EMP-%'` **tidak sah untuk menentukan penghapusan**:

- **9 akun** mempunyai penanda DEMO eksplisit pada nama atau kode `QA-` / `KR-DEMO-`.
- **2 akun lainnya tidak berlabel DEMO**: satu Supervisor dan satu Housekeeping. Kedua akun ini **dilindungi / tidak termasuk penghapusan** hingga Owner menegaskan apakah akun tersebut nyata atau hanya akun uji dengan nama orang.
- SQL pembuktian tanpa PII: `supabase/reconciliation/demo_employee_classification_READ_ONLY_20261121.sql`, benar-benar dijalankan terhadap Lovable LIVE, hasil **11 total / 9 berlabel / 2 perlu penentuan**.
- **Script reset lama dinonaktifkan dengan RAISE EXCEPTION fail-closed**: `supabase/pending/20261121_owner_approved_demo_cutover_phaseA_ATOMIC.sql`. Jangan gunakan versi sebelumnya dari riwayat Git. Wajib membuat sasaran manifest eksplisit yang diverifikasi baru, tanpa asumsi semua 11 DEMO.
- **Tidak ada penghapusan database atau Auth**. Angka transaksi 17, pembayaran 24, kas 5, Auth 15 belum berubah. Nomor resmi `B25EMP-` belum diterbitkan untuk karyawan, allocator sudah tersedia.
- Backup privat telah diperiksa integritas arsip sebelumnya; restore penuh termasuk Auth/Storage belum terbukti. Operator harus memastikan perlindungan data asli sebelum setiap pembersihan permanen.

**Status: SQL ID PASS; 9 akun jelas berlabel DEMO; 2 akun perlu keputusan Owner; reset operasional/Auth masih tertahan.**
