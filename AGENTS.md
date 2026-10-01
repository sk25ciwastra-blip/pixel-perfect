<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Tampilan operasional berbagi kerangka navigasi di `src/components/kerangka.tsx` dan metadata halaman di `src/lib/meta.ts`, agar setiap halaman konsisten di HP dan desktop.
- Data contoh untuk revisi antarmuka tetap berada di `src/lib/data-contoh.ts`, agar harga dan waktu yang tampil tidak dianggap aturan bisnis atau hitung mundur nyata.
- Identitas dan izin operasional berasal dari Lovable Cloud (`user_roles` terpisah dari `employees`), bukan penyimpanan browser; kebijakan data dan fungsi server memastikan hak akses tidak dapat dipalsukan.
- Halaman operasional membaca tabel melalui `src/lib/data-live.ts`; transaksi dan harga memakai penyimpanan langsung agar contoh antarmuka tidak menjadi sumber aturan bisnis.
- Pembuatan akun karyawan dilakukan melalui fungsi server berizin pemilik, sementara sandi dikelola penyedia autentikasi, agar sandi tidak tersimpan sebagai data aplikasi.
