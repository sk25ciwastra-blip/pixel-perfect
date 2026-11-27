// Guest detail source contracts only — no LIVE mutation or synthetic guest insert.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname,'..');
function source(name){return fs.readFileSync(path.join(root,name),'utf8')}
const detail=source('src/routes/tamu.tsx');
const data=source('src/lib/data-live.ts');
const helper=source('src/lib/guest-detail-derived.ts');
const schema=source('supabase/migrations/20261126190000_guest_profile_history_notes.sql');
const types=source('src/integrations/supabase/types.ts');
const styles=source('src/components/detail-tamu.css');
const checks=[
  ['Perbarui action exists on Detail Tamu and is disabled before audit-ready',
    detail.includes('>Perbarui') && detail.includes('disabled={saving || history.loading || !!history.error}') &&
    detail.includes("onClick={() => edit(detail)}")],
  ['Audit panel contains old/new values, actor and timestamp',
    detail.includes("tabDetail === 'perubahan'") && detail.includes('Riwayat Perubahan') &&
    detail.includes('row.old_value') && detail.includes('row.new_value') &&
    detail.includes('row.actor_name') && detail.includes('row.changed_at')],
  ['Audit query strictly scoped by guest and sorted by changed_at',
    detail.includes("useTable('guest_profile_history', Boolean(detailTamu)") &&
    detail.includes("column: 'guest_id', value: detailTamu?.id") &&
    data.includes("if (table === 'guest_profile_history') query = query.order('changed_at'")],
  ['No untracked write when audit table unavailable',
    detail.includes("if (editing && !catatanSaja && (history.loading || history.error))")],
  ['Optimistic lock prevents silent concurrent overwrites',
    detail.includes(".eq('updated_at', editing.updated_at).select().maybeSingle()") &&
    detail.includes('Profil sudah berubah di sesi lain')],
  ['Typed notes work through server-verified RPC, not spoofable actor id',
    detail.includes("rpc('b25_add_guest_categorized_note'") &&
    detail.includes('p_note_type: noteType') &&
    detail.includes("onClick={() => setNoteType(kode)}") &&
    detail.includes("aria-pressed={noteType === kode}")],
  ['Profile editing does not also append an unlabeled note',
    detail.includes("{!editing && <label") &&
    detail.includes("...(!editing ? { notes: catatan.trim() } : {})")],
  ['Real status calculated from operational records and placeholder removed',
    detail.includes('guestVisitStatus(riwayat)') &&
    detail.includes('guestVisitStatus(transactions.rows.filter') &&
    !detail.includes('Status Active/Blocked belum tersedia pada data tamu')],
  ['Total transactions show count rather than rupiah',
    detail.includes('const totalTransaksi = riwayat.length') &&
    detail.includes('Transaksi`}</strong>')],
  ['Booking history remains after conversion and times respect the active tab',
    detail.includes('riwayat.filter(t => Boolean(t.scheduled_check_in))') &&
    detail.includes('guestHistoryDate(tipeRiwayat, tr)') &&
    detail.includes('guestHistoryInAt(tipeRiwayat, tr)') &&
    detail.includes('guestHistoryOutAt(tipeRiwayat, tr)') &&
    !detail.includes('tr.checked_out_at ?? tr.ends_at')],
  ['Genuine Email field editable and mailto works',
    detail.includes('type="email"') && detail.includes('detail.email ? <a href=') &&
    detail.includes('email: cleanEmail || null') && types.includes('email: string | null')],
  ['WhatsApp numbers are functional buttons, but read-only roles cannot initiate contact',
    detail.includes('onClick={() => openWhatsApp(detail.phone)}') &&
    detail.includes('aria-label={`Hubungi ${detail.full_name} melalui WhatsApp`}') &&
    detail.includes('disabled={readOnly}') &&
    styles.includes('button.dt-telepon:focus-visible')],
  ['Favorite details only use actual visits',
    detail.includes('guestVisitOnly(riwayat)') &&
    detail.includes('guestAverageGroupSize(riwayat)') &&
    detail.includes("note => guestNoteType(note) === 'preferensi'")],
  ['Sensitive history is append-only and selected through same guests permissions',
    schema.includes('ENABLE ROW LEVEL SECURITY') &&
    schema.includes('GRANT SELECT ON public.guest_profile_history TO authenticated') &&
    schema.includes('REVOKE ALL ON public.guest_profile_history FROM PUBLIC, anon, authenticated') &&
    schema.includes('REFERENCES public.guests(id) ON DELETE RESTRICT') &&
    schema.includes('guest_profile_history_read')],
  ['Audit old/new capture performed in DB trigger, not JS guesses',
    schema.includes('AFTER UPDATE OF full_name, address, phone, email') &&
    schema.includes('OLD.address IS DISTINCT FROM NEW.address') &&
    schema.includes('OLD.phone IS DISTINCT FROM NEW.phone') &&
    schema.includes('OLD.email IS DISTINCT FROM NEW.email') &&
    !detail.includes("supabase.from('guest_profile_history').insert")],
  ['RPC note checks authenticated frontdesk and server-owned authorship',
    schema.includes('NOT public.can_frontdesk(actor)') &&
    schema.includes('actor uuid := auth.uid()') &&
    schema.includes('INSERT INTO public.guest_notes')],
  ['Original operational data and audit remain unchanged until migration approval',
    schema.includes('DO NOT apply to Lovable LIVE') &&
    !detail.includes('DROP TABLE') && !detail.includes('TRUNCATE ')],
  ['History styles use existing premium tokens',
    styles.includes('.dt-perubahan-list') &&
    styles.includes('var(--premium-line)') &&
    styles.includes('.dt-tombol:disabled')],
];
for(const [label,pass] of checks){assert.ok(pass,label);console.log('PASS',label)}
console.log(`PASS ${checks.length}/${checks.length} Guest Detail source contracts`);
