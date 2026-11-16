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
- Employee creation stays Owner-authorized; shared helpers preserve IDs/edit fields; scoped team detail reads profiles/photos through browser RLS, never passwords or inferred access/history.
- Shared visual primitives live in `src/styles.css` utilities (`panel-mewah`, `emas-isi`, `ikon-bulat`, `pemisah-kolom`) and `Kerangka` (`penuh` for full-bleed Dashboard); pages reuse them so the black-gold look stays consistent without per-page colors. `pemisah-kolom` draws cell separators with inset box-shadow because tables use border-separate, where borders on `<tr>` are not painted.
- Dashboard room rows retain inset fixed-layout scrolling and reserved action widths; scoped panel CSS keeps visual polish independent of existing timestamps, checkout guards, statuses and permissions.
- Dashboard search reads existing RLS-scoped operational rows and opens existing detail views or pages; it never uses privileged queries or changes operational records.
- Announcements use browser RLS-scoped CRUD and an isolated Dashboard panel with paginated complete reads, cleaned-up realtime refresh, deterministic rotation, and database-authoritative actor/timestamps/audit; this keeps announcement changes independent of operational and finance modules.
- Database changes awaiting Owner approval are prepared in `supabase/pending/` and not applied; the UI falls back gracefully until they are applied.
- Guest note history is append-only and captured atomically by the existing guest save trigger; legacy author/time stay unknown, and guest presentation rules live in a pure tested helper to keep visit counting separate from UI.
- Guest-page WhatsApp controls share a local SVG renderer using the Dashboard's official path; this keeps both guest controls consistent without modifying the approved Dashboard.
- Guest note shortcuts reuse the guest-save trigger with a notes-only update; guest status remains unavailable until an authoritative stored field exists, preventing fabricated eligibility labels.
- Operational detail popups reuse presentation-only primitives in `detail-premium.tsx`; data reads, permission gates, calculations, and actions remain in their existing feature files so visual consistency cannot change operational rules.
- The transaction list uses URL-backed filters and browser RLS-scoped Query reads with exact counts, stable ordering, database date/search filters and 20-row ranges; transaction detail scopes transaction, guest and payment reads to the selected record so API row caps cannot hide an older selection. No privileged reads or new database rules are needed.
- Page-only illustrative backdrops are mapped in `latar-header.tsx` with wide bundled images, cover sizing and route-specific responsive focal positions, and a scoped semantic overlay; Dashboard is excluded from the mapping, and form/detail headers stay independent so background revisions cannot alter approved screens or header dimensions.
- Feature header backdrops extend behind the shared profile row through scoped desktop CSS; the room header retains its local offset, keeping content geometry and the independent Dashboard unchanged.
- Short per-page header context lines live in `src/lib/konteks-header.ts` and are rendered only by the shared page header in `kerangka.tsx` (Dashboard is excluded because it renders full-bleed), so context copy stays presentation-only and can never resize a header or touch a background.
- The Kamar check-in entry reuses FormulirPemesanan and the prior transaction-list permission plus refresh invalidations; contact availability uses the existing Dashboard number format, preserving operational restrictions.
- Housekeeping keeps its five tabs and queue permissions; reference panels use scoped browser-readable maintenance/history and tested completion summaries, never sample schedules or inferred repairs.
- Check-in, booking and expense results share the scoped success shell; forms retain validation, save handlers and existing actions so presentation cannot alter payment rules.
- Cash-expense layout overrides use the expense-reference scope: full-width session and summary surround paired detail/payment panels, so reference adjustments never change other forms or the cash-only save handler.

- Finance presentation is scoped to `keuangan.tsx` and `keuangan.css`; its chart only groups RLS-visible session records and labels net receipts separately from authoritative cash balance, while existing handlers and permission gates remain unchanged.
- Grouped package dialogs read prices from the selected package/type relation and block grouped saves until a type-scoped audited mutation exists; global package RPCs cannot safely write type prices.
- Room-page presentation is isolated in scoped `kamar.css`; inactive and non-ready cards reuse `PopupKamarTerisi` with stored-status messages, whose room-choice action only dismisses it back to the unchanged room list; only active ready cards can open the existing permission-gated form. Transaction ID buttons alone open transaction detail and stop propagation. No repair status is inferred from unstructured notes. Form validation and RPCs remain authoritative, keeping card handlers mutation-free.
