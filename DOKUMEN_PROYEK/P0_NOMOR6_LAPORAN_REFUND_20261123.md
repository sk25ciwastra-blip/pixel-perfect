# Baturaden 25 Homestay — Roadmap No.6, Laporan Arus Kas dan Refund

**Tanggal:** 23 November 2026 WIB. **Status:** patch report pada branch review saja; belum merge/publish. PR #110 Refund UI sudah MERGED, sedangkan publikasi Lovable ID `53f8de4f-a996-43ab-b85a-9b3d5b30cd9f` mula-mula pending; file code parity PASS.

## Temuan terverifikasi

- `src/routes/laporan.tsx` lama menghitung `Arus Kas Bersih = SUM(payments.amount) - SUM(finance_expenses.amount)` tanpa mengurangi refund. Pada audit Cloud 23 Nov `finance_refunds=0`, jadi ini risiko laten, **bukan selisih saldo nyata pada data DEMO saat ini**.
- Refund merupakan arus kas keluar bisnis dan harus dihitung pada tanggal refund (`finance_refunds.created_at` WIB), **bukan mengurangi pendapatan di tanggal pembayaran historis atau mengubah snapshot sesi kas FINAL**.
- RLS Lovable Cloud `finance_refunds_read` mengizinkan **Owner atau pembuat refund**. Karena refund hanya dapat dibuat Owner, Receptionist tidak mempunyai buku refund usaha lengkap. RLS `finance_expenses_read` hanya mengizinkan Owner/Supervisor atau petugas yang mencatat baris pengeluaran. Jadi laporan Receptionist **tidak boleh mengklaim arus kas bersih usaha** karena bisa kehilangan beberapa refund dan biaya.
- Sumber pendapatan tetap bruto jumlah baris `payments`, bukan jumlah transaksi (DP, pelunasan, QRIS+Cash merupakan payment lines yang berbeda). Transfer/setoran antar-sesi bukan pendapatan atau biaya baru. **Tidak ada perubahan Finance database**.

## Koreksi minimal dalam branch report

- Helper `src/lib/laporan-arus-kas.ts`: hitung net = pembayaran bruto − pengeluaran tercatat − refund (Owner, data lengkap). Bila refund coverage tidak tersedia, `null` dan gunakan label **Selisih Data yang Terlihat (bukan Arus Kas Bersih)** untuk peran lainnya.
- `src/routes/laporan.tsx`: hanya Owner memanggil `useTable('finance_refunds')`, menunggu loading/error Owner sebelum mengklaim angka net; ringkasan usaha Owner menampilkan total refund dan net aktual; rekap per tanggal WIB mengurangkan refund masing-masing, termasuk hari hanya berisi refund. Bagi Receptionist, angka selisih diberi label terbatas, tidak menampilkan detail refund yang dibatasi RLS.
- `src/lib/laporan-export.ts`: CSV agregat tanpa data pribadi menampilkan penerimaan **bruto**, refund Owner, hasil net setelah refund serta catatan cakupan data yang jujur. Untuk non-Owner, refund bertanda tidak tersedia; selisih tidak diberi label net. Formula injection guard lama dipertahankan.
- Grafik `KeuanganArus` tetap grafik penerimaan bruto dan pengeluaran—diberi catatan bahwa grafik **belum mengurangi refund**. Jangan menyatakan grafik adalah net. Fitur `Pendapatan Kamar` serta `Tamu Baru/Lama` masih mengikuti keputusan desain lanjutan Owner; tidak dihardcode di sini.

## Bukti pengujian dan gate

GitHub Actions terfokus (lihat PR review yang dibuat dari branch ini) menjalankan 12 tes synthetic/contract, build Vite dan TypeScript. Contoh: payment Rp200.000, expenses Rp50.000, refund Rp30.000 harus menghasilkan **net Rp120.000**. Minus cash Rp−50.000 tidak diubah menjadi nol. Simulasi CSV Owner dan karyawan harus eksplisit menyatakan cakupan refund.

Cloud Closing read-only audit: 6 sesi kas (3 OPEN / 3 FINAL), 6 ringkasan cocok agregat independen; ada **1 FINAL historis saldo minus Rp50.000** dengan alokasi kas fisik 0, sesuai ketentuan Owner (minus boleh). Ketiga FINAL mempunyai snapshot; jangan menutup ketiga sesi OPEN demi QA. Pembayaran terhubung ke sesi masih campuran data DEMO lama; 11 baris pembayaran tidak mempunyai cash_session_id.

**Jalur aman:** setelah focused CI PASS dan Owner menyetujui secara terpisah, merge PR laporan → sinkron GitHub/Lovable → publish → uji Laporan melalui akun Owner dan Receptionist tanpa membuat refund. Saat ini 0 refund; rumus baru harus didukung pengujian sintetis, bukan membuat refund DEMO di Cloud semata. Sebelum operasional nyata, catatan data DEMO perlu diselesaikan pada gate lainnya. Nomor 6 tetap IN PROGRESS.
