// Scoped source regression for the real Guest Detail categorized note flow.
// Tests read code only, never insert or mutate guest notes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const detail = fs.readFileSync(path.join(root,'src/routes/tamu.tsx'),'utf8');
const css = fs.readFileSync(path.join(root,'src/components/detail-tamu.css'),'utf8');
const migration = fs.readFileSync(path.join(root,'supabase/migrations/20261126190000_guest_profile_history_notes.sql'),'utf8');

const checks = [
  ['Four categorized note buttons can be selected (not decoration)',
    detail.includes("['umum', 'Umum', PenLine]") &&
    detail.includes("['preferensi', 'Preferensi', Star]") &&
    detail.includes("['perhatian', 'Perhatian', TriangleAlert]") &&
    detail.includes("['lainnya', 'Lainnya', Pin]") &&
    detail.includes('onClick={() => setNoteType(kode)}') &&
    detail.includes('aria-pressed={noteType === kode}')],
  ['Textarea has 500-character boundary, required input and live counter',
    detail.includes('id="catatan-tamu-baru" required autoFocus maxLength={500}') &&
    detail.includes('{catatan.length} / 500')],
  ['Submit cannot be triggered by blank text, loading, unreadable history or duplicate click',
    detail.includes('disabled={saving || notes.loading || Boolean(notes.error) || !catatan.trim()}') &&
    detail.includes('if (saving || readOnly) return')],
  ['Submitting a note checks readiness before any RPC call',
    detail.includes("if (catatanSaja && notes.loading)") &&
    detail.includes("if (catatanSaja && notes.error)") &&
    detail.indexOf('if (catatanSaja && notes.loading)') < detail.indexOf("rpc('b25_add_guest_categorized_note'")],
  ['Write uses server-authorized RPC with correct note category',
    detail.includes("rpc('b25_add_guest_categorized_note'") &&
    detail.includes('p_guest_id: editing.id, p_body: catatan.trim(), p_note_type: noteType') &&
    !detail.includes('supabase.from(\'guest_notes\').insert(')],
  ['Success UI is never shown before RPC success',
    detail.indexOf('if (inserted.error) throw new Error(inserted.error.message)') <
    detail.indexOf('setNoteSavedGuestId(editing.id)') &&
    detail.includes('noteSavedGuestId === detail.id') &&
    detail.includes('role="status" className="dt-note-success"')],
  ['On save, return to Catatan tab; refresh failure does not invite duplicate retry',
    detail.includes("setTabDetail('catatan')") &&
    detail.includes('await notes.refresh();') &&
    !detail.includes('await notes.refresh({ throwOnError: true })')],
  ['API errors and loading are not misleadingly shown as empty history',
    detail.includes("notes.error ? <p role=\"alert\" className=\"ct-kosong\"") &&
    detail.includes('!notes.loading && !notes.error && daftarCatatan.length') &&
    detail.includes('!notes.loading && !notes.error && <p className="dt-kosong">Belum ada catatan tamu')],
  ['Failure does not show a false positive and keeps editor open',
    detail.includes("setMessage(catatanSaja") &&
    detail.includes("'Catatan belum tersimpan.") &&
    !detail.includes('setNoteSavedGuestId(editing.id);\n        if (inserted.error)')],
  ['Success acknowledgement is cleared when changing/closing guest',
    detail.includes('setNoteSavedGuestId(null);') &&
    detail.includes('function tutup()') &&
    css.includes('.dt-note-success')],
  ['Server attributes author and validates authentication and all four types',
    migration.includes('actor uuid := auth.uid()') &&
    migration.includes('NOT public.can_frontdesk(actor)') &&
    migration.includes("('umum','preferensi','perhatian','lainnya')") &&
    migration.includes('author_id,author_role,author_name')],
];
for(const [title,passed] of checks){assert.ok(passed,title);console.log('PASS',title);}
console.log(`PASS ${checks.length}/${checks.length} Guest categorized-note source guards`);
