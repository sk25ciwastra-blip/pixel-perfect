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
- Shared visual primitives live in `src/styles.css` utilities (`panel-mewah`, `emas-isi`, `ikon-bulat`, `pemisah-kolom`) and `Kerangka` (`penuh` for full-bleed Dashboard); pages reuse them so the black-gold look stays consistent without per-page colors. `pemisah-kolom` draws cell separators with inset box-shadow because tables use border-separate, where borders on `<tr>` are not painted.
- Dashboard room rows use an inset, scrollable fixed-layout table with a flexible guest column and reserved status/action widths; table-only presentation uses existing transaction timestamps and checkout guards without inventing operational statuses or permissions.
- Dashboard search reads existing RLS-scoped operational rows and opens existing detail views or pages; it never uses privileged queries or changes operational records.
