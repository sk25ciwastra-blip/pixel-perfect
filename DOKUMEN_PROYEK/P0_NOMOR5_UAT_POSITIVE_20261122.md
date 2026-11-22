# Baturaden 25 Homestay — Nomor 5/10, UAT Operasional Positif

**Tanggal:** 22 November 2026. **Status:** backend audit + tes PostgreSQL 17 PASS; uji Cloud positif baru disiapkan, **belum diizinkan atau dijalankan**. **Nomor 5: 95%**, belum 100%.

## PASS terdahulu (jangan ulang)

Issue #106 mencatat bahwa Receptionist B25EMP-002 sudah membuka aplikasi Keuangan dengan sesi kas **OPEN** dalam screenshot Owner, validasi negatif transaksi dan isolasi sesi kas via Cloud `BEGIN/ROLLBACK` PASS, serta penggantian password mandiri berhasil menurut pesan aplikasi. Nomor 1–4 tetap PASS.

## Audit positif historis langsung Lovable Cloud — SELECT-only

Pada 22 Nov 2026 Cloud memiliki **17 transaksi**: 6 Booking, 3 Check-in, 8 Check-out. **Seluruh 8 Checkout tercatat lunas** sesuai `price_snapshot`. Enam memiliki HK mulai dan selesai, lima memiliki checklist `passed` dengan referensi transaksi yang sama. Empat dari lima tersebut (nomor historis dengan prefix `BTRDTRX`) juga memiliki referensi sesi kas sah dan nilai komisi pada pembayaran. Salah satu transaksi nomor lama `BTRD25-000008` belum memiliki referensi sesi kas; ini bukti keterbatasan data DEMO lama, **bukan bukti kegagalan RPC sekarang**. Tidak ada data diubah.

## Uji 6 definisi RPC Cloud asli dalam PostgreSQL 17 terisolasi — PASS

Salinan persis `pg_get_functiondef` dari Lovable Cloud berikut dikunci dengan hash `md5(prosrc)` dan diuji pada cluster PostgreSQL 17 sementara:

1. `create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid,integer)` — `14314995cf012335f18bd859da5b668b`
2. `record_transaction_payment(uuid,numeric,text,uuid,uuid)` — `e9e88c3e70c76450ecc89744adc78471`
3. `check_in_booking(uuid)` — `fb29b1e4d72c71f5895ef8a1a1767387`
4. `check_out_transaction(uuid)` — `2ab65aa2ebd66574f858dc3ff54e7c7f`
5. `advance_room_cleaning(uuid,text)` — `0eb3730060a3a005bfec097f42ae3810`
6. `complete_housekeeping_checklist(uuid,uuid,boolean,boolean,boolean,boolean,boolean,boolean,boolean,text)` — `8c9dbcabf70646f89c047291cd81c0f2`.

Dengan tabel dan identity/time helpers **sintetis**, uji sukses menempuh: `create_reservation` Booking baru (DP Cash 40%) → retry idempoten → bayar sisa via QRIS → retry pembayaran idempoten → Check-in (status OCCUPIED) → Checkout lunas (status DIRTY) → petugas HK mulai cleaning → checklist semua item PASS → kamar READY. Satu TRX konsisten, dua pembayaran dalam satu sesi kas, riwayat HK/job/checklist terhubung, guard pelunasan sebelum Check-in, penolakan Receptionist mengerjakan HK, alasan checklist gagal wajib, dan status sesi OPEN tetap. **Bukti** [GitHub Actions #45032836729](https://github.com/sk25ciwastra-blip/pixel-perfect/actions/runs/45032836729), SUCCESS.

**Keterbatasan jelas:** tabel, role helper, waktu paket, dan trigger keuangan di fixture bukan salinan utuh Cloud; ini bukan pengganti uji langsung Cloud, bukan tes commission trigger, bukan uji browser atau printer fisik.

## Opsional: uji langsung Cloud positif tanpa transaksi permanen — menunggu izin Owner

**Skrip:** `scripts/no5-cloud-one-transaction-rollback-OWNER-APPROVAL-REQUIRED.sql`. Hanya pada Lovable Cloud project `017f6e78-15f2-4d07-a38c-87cb185279bf`, setelah cek kondisi sumber dan izin Owner.

Prosedur skrip: fail-closed (6 hash sumber/role/DP/price), buat **kamar sintetis nomor 99** yang tidak ada di Cloud dalam satu `BEGIN`, pakai akun Receptionist B25EMP-002 dan sesi kas **OPEN** yang sudah ada, jalankan keenam RPC sukses menggunakan klaim role `authenticated`, lanjut sebagai petugas HK aktif, verifikasi status & hubungan TRX/pembayaran/HK, lalu **`ROLLBACK` tanpa `COMMIT`**. Test juga menolak jika nomor kamar 99 atau nomor telepon sintetis sudah ada.

**Efek tetap setelah rollback:** `nextval` generator nomor transaksi dan job HK **tidak transaksional**. Satu atau beberapa nomor TRX/HK bisa terlewat permanen, meskipun semua baris Booking, kas, kamar, tamu, payment, checklist dan audit kembali semula. Perubahan sementara dapat menahan lock selama SQL berjalan. Jangan jalankan tanpa izin eksplisit Owner menerima konsekuensi nomor urut tersebut. Bukan transaksi sungguhan melalui UI browser.

Skrip yang sama telah dijalankan terhadap database **disposable** dengan synthetic baseline dan keenam fungsi Cloud — PASS dan postcheck **0 baris test tersisa** pada [GitHub Actions #45033261800](https://github.com/sk25ciwastra-blip/pixel-perfect/actions/runs/45033261800). Berkas final menambah pemeriksaan nomor telepon sintetik belum dipakai; verifikasi CI akhir dilakukan pada commit branch terbaru.

## Gate 100% (tetap terbuka)

- Jalankan test satu-transaksi Cloud di atas **hanya setelah Owner menyetujui** penggunaan sequence (atau pilih jalur uji demo permanen yang disepakati jika Owner tidak menerima skipped numbers).
- Verifikasi sesudahnya **jumlah data sebelum/sesudah**, sesi kas, refund, komisi, Room READY, HK, transaksi DEMO dan RLS sama. Periksa status seq nomor historis bila perlu.
- Terima bukti dari browser Receptionist sebenarnya bahwa form Booking dan Check-in, pembayaran/konfirmasi, Checkout dan Housekeeping dapat diakses sesuai role, dengan aturan tidak mengubah transaksi aktif lama. Uji tombol sukses pada data DEMO yang disetujui bila disyaratkan Owner; backend SQL saja bukan bukti tombol browser.
- Tidak perlu ulang backup, PR #101–#107, migrasi ataupun tes PASS. Tidak perlu Lovable AI credit untuk menjalankan query Cloud; tidak memublikasikan ulang UI untuk tes ini.

**Status:** Nomor 5 **95%**, bukan GO/100% sebelum gate Cloud dan browser terpenuhi.