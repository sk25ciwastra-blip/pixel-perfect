# Integrasi Extra Guest dan Receipt 58 mm (OFF secara default)

## Kondisi saat ini (sudah dicek)
- `src/components/receipt-actions.tsx` dan `src/lib/receipt-print.ts` belum ada di source Lovable.
- `formulir-pemesanan.tsx` memanggil `create_reservation` tanpa `_guest_count`; tipe database hanya mengenal versi tanpa jumlah tamu.
- Extra Guest dan split payment saat ini diblokir di formulir (desain disetujui tetap tampil).
- Migrasi kategori/extra guest ada di `supabase/pending/` dan belum diterapkan.

## Prinsip
- Desain Lovable menang: file UI tidak ditimpa dari GitHub; hanya disisipkan potongan kecil.
- Semua fitur baru OFF bila sakelar mati; saat OFF, tampilan dan perilaku identik dengan sekarang (tidak ada tombol baru yang tampil).
- Tidak menyentuh harga/katalog, RLS, login, keuangan, database, migrasi, secrets, publish/deploy.

## File yang diubah
1. **Baru `src/lib/fitur.ts`** — sakelar tunggal, nilai default `false`:
   - `extraGuest` dan `receipt58mm`, dibaca dari `import.meta.env.VITE_FITUR_EXTRA_GUEST === 'aktif'` / `VITE_FITUR_RECEIPT === 'aktif'`; selain nilai persis itu = OFF.
2. **Baru `src/lib/receipt-print.ts`** — disalin dari GitHub apa adanya (logika format 58 mm saja, tanpa UI).
3. **Baru `src/components/receipt-actions.tsx`** — disalin dari GitHub, lalu dibungkus: bila `receipt58mm` OFF, komponen mengembalikan `null`. Pemanggilan RPC (`issue_payment_receipt`, `request_receipt_print`, `record_receipt_print_result`) memakai pemanggil longgar yang sudah dipakai formulir (`rpc(...)`), sehingga tipe database tidak perlu diubah.
4. **`src/components/detail-transaksi.tsx`** — patch kecil sesuai petunjuk sebelumnya: prop opsional `aksi` pada `Seksi`, tombol Print History di judul Riwayat Pembayaran, dan sel/kolom Print Receipt per baris — kolom tambahan hanya dirender bila sakelar ON. Saat OFF, tabel tetap 6 kolom persis.
5. **`src/components/formulir-pemesanan.tsx`** — patch kecil: `_guest_count` hanya dikirim bila `extraGuest` ON; blokir Extra Guest yang ada sekarang tetap berlaku saat OFF. Hitungan Rp50.000/tamu di atas 2 diambil dari GitHub hanya untuk mode ON, tidak mengubah harga paket.

Tidak diubah: `booking.tsx`, Dashboard, Keuangan, sidebar, `types.ts`, migrasi, kebijakan akses.

## Menghindari regresi tampilan
- Bandingkan diff GitHub vs Lovable per file; ambil hanya hunk fungsi, buang hunk className/struktur.
- Screenshot Detail Transaksi dan formulir Check-in/Booking sebelum dan sesudah (desktop 1440px, HP 390px) dengan sakelar OFF — harus identik.
- Satu kali uji lokal dengan sakelar ON untuk memastikan tombol rapi (ukuran kecil, outline emas) tanpa menekan aksi ke database.

## Aktivasi (nanti, butuh persetujuan Owner)
1. Backend menerapkan RPC 13 parameter dan tiga RPC receipt (di luar rencana ini).
2. Verifikasi RPC ada di database.
3. Owner menyetujui, lalu sakelar diubah ke `aktif`.

## Uji
- Typecheck dan build harus lulus.
- Tes yang ada (`bunx vitest run`) lulus; tambah tes kecil untuk `fitur.ts`: tanpa variabel = OFF, nilai selain `aktif` = OFF.
- Tes biaya extra guest: 2 tamu = Rp0, 3 tamu = Rp50.000, 4 tamu = Rp100.000.

## Catatan
Isi file GitHub belum bisa saya baca dari sini; saat eksekusi, Anda perlu menempelkan isi dua file receipt dan diff formulir/detail, atau menyambungkan repositori.
