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
- Announcements use browser RLS-scoped CRUD and an isolated Dashboard panel with paginated complete reads, cleaned-up realtime refresh, deterministic rotation, and database-authoritative actor/timestamps/audit; this keeps announcement changes independent of operational and finance modules.
- Database changes awaiting Owner approval are prepared in `supabase/pending/` and not applied; the UI falls back gracefully until they are applied.
- Guest note history is append-only and captured atomically by the existing guest save trigger; legacy author/time stay unknown, and guest presentation rules live in a pure tested helper to keep visit counting separate from UI.
- Guest-page WhatsApp controls share a local SVG renderer using the Dashboard's official path; this keeps both guest controls consistent without modifying the approved Dashboard.
- Guest note shortcuts reuse the guest-save trigger with a notes-only update; guest status remains unavailable until an authoritative stored field exists, preventing fabricated eligibility labels.
- Operational detail popups reuse presentation-only primitives in `detail-premium.tsx`; data reads, permission gates, calculations, and actions remain in their existing feature files so visual consistency cannot change operational rules.
- The transaction list uses URL-backed filters and browser RLS-scoped Query reads with exact counts, stable ordering, database date/search filters and 20-row ranges; transaction detail scopes transaction, guest and payment reads to the selected record so API row caps cannot hide an older selection. No privileged reads or new database rules are needed.
- Page-only heritage backdrops are mapped in `latar-header.tsx` and use existing imagery or local decorative motifs; keeping them separate from form and detail headers prevents visual revisions from altering approved forms.
- The Kamar check-in entry reuses FormulirPemesanan and the prior transaction-list permission plus refresh invalidations; contact availability uses the existing Dashboard number format, preserving operational restrictions.
