# Aktivasi Extra Guest — khusus Preview

## Temuan
1. Lovable tidak menyediakan env build khusus Preview. Nilai `VITE_*` ditanam saat build dari `.env` yang sama; Secrets hanya untuk server, bukan `VITE_*`. Jika ditulis di `.env`, nilai itu ikut terbawa ke Production saat berikutnya publish.
2. Flag `featureFlags.extraGuest` (`src/lib/feature-flags.ts`) saat ini tidak dipakai di UI mana pun. Menyetel tiga variabel itu tidak berpengaruh apa-apa sampai form tersambung ke flag.
3. Ada sakelar ganda yang sudah usang: `src/lib/fitur.ts` (`VITE_FITUR_EXTRA_GUEST='aktif'`). Gate resmi tetap tiga variabel `=== 'true'`.

## Mekanisme aman yang bisa dijalankan
- Tambahkan gate keempat di kode: Extra Guest aktif hanya jika ketiga variabel `true` DAN hostname termasuk host Preview (`id-preview--017f6e78-…`, `id-preview-<n|sha>--…`, `preview--…`, `*.lovableproject.com`, localhost). Host Production (`pixel-perfect-homestay-hub.lovable.app`, domain kustom) selalu OFF.
- Setel tiga variabel di `.env` dengan nilai `true`. Combined Payment dan Receipt 58mm tidak disentuh (tetap OFF).
- Sambungkan `featureFlags.extraGuest` ke input Extra Guest + parameter `_guest_count` di `formulir-pemesanan.tsx` saja, tanpa mengubah tata letak.
- Tambahkan tes: Production host → OFF; Preview + 3×true → ON; salah satu flag hilang → OFF.

## Efek samping
- Kode dan nilai env ikut masuk bundle Production pada publish berikutnya, tetapi tetap tidak aktif karena gate hostname. Mematikan: hapus satu variabel atau hostname gate.
- Database Cloud yang sama melayani Preview dan Production: booking uji Extra Guest di Preview menulis data nyata (biaya tamu tambahan masuk transaksi/kas).
- Tidak ada publish, perubahan database, atau GitHub.
