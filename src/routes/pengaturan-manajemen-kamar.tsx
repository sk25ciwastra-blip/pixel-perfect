import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState, type FormEvent } from 'react';
import { BedDouble, Pencil, Plus, ShieldAlert, DoorOpen, CheckCircle2, Layers3 } from 'lucide-react';
import { ActionResultDialog, type ActionResultState } from '@/components/action-result-dialog';
import { Kerangka } from '@/components/kerangka';
import { SubPengaturan } from '@/components/pengaturan-sub';
import { Button } from '@/components/ui/button';
import { useTable, useTransaksiOperasional, type Room } from '@/lib/data-live';
import { usePeran } from '@/lib/peran';
import { supabase } from '@/integrations/supabase/client';
import { meta } from '@/lib/meta';
import './pengaturan-manajemen-kamar.css';

export const Route = createFileRoute('/pengaturan-manajemen-kamar')({
  head: () => meta('Manajemen Kamar', 'Kelola data kamar Baturaden 25 Homestay.'),
  component: ManajemenKamar,
});

const urutNomor = (a: Room, b: Room) => a.room_number.localeCompare(b.room_number, 'id', { numeric: true });
const statusKamar: Record<Room['status'], string> = {
  ready: 'Tersedia',
  occupied: 'Terisi',
  dirty: 'Perlu dibersihkan',
  cleaning: 'Sedang dibersihkan',
};

type DialogState = { room: Room | null } | null;

function ManajemenKamar() {
  const { siap, posisiKode, training } = usePeran();
  const owner = siap && posisiKode === 'owner' && !training.is_training;
  const rooms = useTable('rooms', owner);
  const types = useTable('room_types', owner);
  const transactions = useTransaksiOperasional();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [nomor, setNomor] = useState('');
  const [tipeId, setTipeId] = useState('');
  const [lantai, setLantai] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyRoom, setBusyRoom] = useState('');
  const [error, setError] = useState('');
  const [actionResult, setActionResult] = useState<ActionResultState | null>(null);

  const allRooms = useMemo(() => [...rooms.rows].sort(urutNomor), [rooms.rows]);
  const activeCount = allRooms.filter(room => room.active).length;
  const usedCount = allRooms.filter(room => room.status === 'occupied').length;

  function digunakan(room: Room) {
    return room.status === 'occupied' || transactions.rows.some(
      trx => trx.room_id === room.id && (trx.status === 'check_in' || trx.status === 'booking'),
    );
  }

  function reportError(title: string, description: string) {
    setError(description);
    setActionResult({ kind: 'error', title, description });
  }

  function openEditor(room: Room | null) {
    setActionResult(null);
    setDialog({ room });
    setNomor(room?.room_number ?? '');
    setTipeId(room?.room_type_id ?? types.rows[0]?.id ?? '');
    setLantai(room?.lantai == null ? '' : String(room.lantai));
    setError('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!owner || !dialog || saving) return;
    const n = nomor.trim();
    if (!n || !tipeId || !types.rows.some(type => type.id === tipeId)) {
      reportError('Data kamar belum lengkap', 'Nomor kamar dan tipe kamar wajib dipilih.');
      return;
    }
    if (allRooms.some(room => room.room_number.trim().toLowerCase() === n.toLowerCase() && room.id !== dialog.room?.id)) {
      reportError('Nomor kamar sudah digunakan', 'Gunakan nomor kamar lain yang belum tercatat.');
      return;
    }
    const floorValue = lantai.trim();
    const floor = floorValue === '' ? null : Number(floorValue);
    if (floor !== null && (!Number.isInteger(floor) || floor < 1)) {
      reportError('Lantai tidak valid', 'Lantai harus berupa bilangan bulat minimal 1.');
      return;
    }
    setSaving(true);
    setError('');
    setActionResult(null);
    const editing = dialog.room !== null;
    let writeAcknowledged = false;
    try {
      // Changing room type for an existing room affects historical prices/transactions:
      // use only the original room type when editing.
      const { error: writeError } = dialog.room
        ? await supabase.from('rooms').update({ room_number: n, lantai: floor }).eq('id', dialog.room.id)
        : await supabase.from('rooms').insert({ room_number: n, room_type_id: tipeId, lantai: floor });
      if (writeError) throw writeError;
      writeAcknowledged = true;
      await rooms.refresh({ throwOnError: true });
      setDialog(null);
      setActionResult({
        kind: 'success',
        title: editing ? 'Kamar berhasil diperbarui' : 'Kamar berhasil ditambahkan',
        description: editing
          ? `Perubahan data kamar ${n} telah disimpan dan daftar kamar berhasil dimuat ulang.`
          : `Kamar ${n} telah ditambahkan dan daftar kamar berhasil dimuat ulang.`,
      });
    } catch {
      reportError(
        'Periksa kembali data kamar',
        writeAcknowledged
          ? 'Perubahan mungkin sudah disimpan, tetapi daftar kamar belum dapat dimuat ulang. Periksa kembali sebelum menyimpan ulang.'
          : 'Hasil penyimpanan kamar belum dapat dipastikan. Periksa daftar kamar sebelum mengulangi.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(room: Room) {
    if (!owner || busyRoom) return;
    setError('');
    setActionResult(null);
    if (room.active && (transactions.loading || transactions.error)) {
      reportError('Penonaktifan kamar ditahan', 'Status transaksi belum dapat diverifikasi. Penonaktifan kamar ditahan demi keamanan.');
      return;
    }
    if (room.active && digunakan(room)) {
      reportError('Kamar masih digunakan', `Kamar ${room.room_number} masih terisi atau memiliki Booking aktif dan tidak dapat dinonaktifkan.`);
      return;
    }
    setBusyRoom(room.id);
    let writeAcknowledged = false;
    try {
      const { error: writeError } = await supabase.from('rooms').update({ active: !room.active }).eq('id', room.id);
      if (writeError) throw writeError;
      writeAcknowledged = true;
      await rooms.refresh({ throwOnError: true });
      setActionResult({
        kind: 'success',
        title: room.active ? 'Kamar berhasil dinonaktifkan' : 'Kamar berhasil diaktifkan',
        description: `Status kamar ${room.room_number} berhasil diperbarui dan daftar kamar dimuat ulang.`,
      });
    } catch {
      reportError(
        'Periksa kembali status kamar',
        writeAcknowledged
          ? 'Status kamar mungkin sudah berubah, tetapi daftar belum dapat dimuat ulang. Periksa kembali sebelum mengulangi.'
          : 'Perubahan status kamar belum dapat dipastikan. Periksa kondisi kamar sebelum mengulangi.',
      );
    } finally {
      setBusyRoom('');
    }
  }

  if (!siap) return <Kerangka judul="Manajemen Kamar"><SubPengaturan><p>Memeriksa akses…</p></SubPengaturan></Kerangka>;
  if (!owner) return <Kerangka judul="Manajemen Kamar"><SubPengaturan><p role="alert">Halaman ini khusus Owner.</p></SubPengaturan></Kerangka>;

  return (
    <Kerangka judul="Manajemen Kamar" keterangan="Kelola kamar individual tanpa mengubah pengaturan jenis kamar.">
      <SubPengaturan>
        <div className="mk-page space-y-5">
          <header className="mk-hero panel-mewah flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
            <div>
              <p className="mk-eyebrow text-xs font-semibold uppercase tracking-[0.2em]">INVENTARIS / OPERASIONAL</p>
              <h2 className="mk-hero-title mt-2 font-serif text-2xl font-semibold">Daftar Seluruh Kamar</h2>
              <p className="mt-1 text-sm text-muted-foreground">Kelola nomor, lokasi lantai, dan aktivasi kamar dari satu halaman.</p>
            </div>
            <Button className="mk-add-button" onClick={() => openEditor(null)} disabled={types.loading || !!types.error || !types.rows.length}>
              <Plus className="mr-2 size-4" />Tambah Kamar
            </Button>
          </header>

          <div className="mk-summary grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Total kamar', value: allRooms.length, icon: DoorOpen },
              { label: 'Kamar aktif', value: activeCount, icon: CheckCircle2 },
              { label: 'Sedang terisi', value: usedCount, icon: Layers3 },
            ].map(metric => (
              <div key={metric.label} className="mk-stat rounded-xl p-4">
                <div className="mk-stat-heading"><p className="text-xs">{metric.label}</p><metric.icon className="size-4" aria-hidden="true" /></div>
                <p className="mt-2 font-serif text-2xl font-semibold">{rooms.loading ? "—" : metric.value}</p>
              </div>
            ))}
          </div>

          {(rooms.error || types.error || error) && <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{error || rooms.error || types.error}</p>}
          {(rooms.loading || types.loading) && <p role="status">Memuat inventaris kamar…</p>}

          <section aria-label="Daftar seluruh kamar" className="mk-list overflow-hidden rounded-xl">
            <div className="mk-list-heading"><div><p className="mk-section-kicker">DIREKTORI KAMAR</p><h3>Seluruh Unit</h3></div><span className="mk-count">{rooms.loading ? "Memuat..." : `${allRooms.length} unit`}</span></div>
            <div className="mk-table-wrapper overflow-x-auto">
              <table className="mk-table w-full min-w-[690px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3">Nomor</th>
                    <th className="px-4 py-3">Tipe</th>
                    <th className="px-4 py-3">Lantai</th>
                    <th className="px-4 py-3">Kondisi</th>
                    <th className="px-4 py-3">Aktivasi</th>
                    <th className="px-4 py-3 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {allRooms.map(room => {
                    const type = types.rows.find(item => item.id === room.room_type_id);
                    return <tr key={room.id}>
                      <td className="px-4 py-3 font-semibold"><span className="mk-room-number">{room.room_number}</span></td>
                      <td className="px-4 py-3">{type?.name ?? 'Tidak diketahui'}</td>
                      <td className="px-4 py-3">{room.lantai ?? '—'}</td>
                      <td className="px-4 py-3"><span className={`mk-condition mk-condition-${room.status}`}>{statusKamar[room.status]}</span></td>
                      <td className="px-4 py-3"><span className={`mk-activation ${room.active ? "mk-activation-on" : "mk-activation-off"}`}><span aria-hidden="true" />{room.active ? "Aktif" : "Nonaktif"}</span></td>
                      <td className="px-4 py-3">
                        <div className="mk-actions flex items-center justify-end gap-2">
                          <Button className="mk-button-edit" size="sm" variant="outline" onClick={() => openEditor(room)}><Pencil className="mr-1 size-3.5" />Ubah</Button>
                          <Button className="mk-button-status" size="sm" variant="outline" disabled={busyRoom === room.id} onClick={() => void toggleActive(room)}>
                            {busyRoom === room.id ? 'Memproses…' : room.active ? 'Nonaktifkan' : 'Aktifkan'}
                          </Button>
                        </div>
                      </td>
                    </tr>;
                  })}
                  {!rooms.loading && allRooms.length === 0 && <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>Belum ada kamar.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
          <p className="flex items-start gap-2 text-xs text-muted-foreground"><ShieldAlert className="mt-0.5 size-4 shrink-0" />Kamar yang terisi atau mempunyai booking aktif tidak boleh dinonaktifkan. Tidak ada perubahan data tanpa tindakan Owner.</p>
        </div>
        {dialog && <div className="fixed inset-0 z-50 grid place-items-center bg-navy-deep/75 p-4 backdrop-blur-sm">
          <form onSubmit={e => void save(e)} role="dialog" aria-modal="true" aria-label={dialog.room ? 'Ubah Kamar' : 'Tambah Kamar'} className="mk-editor w-full max-w-md space-y-4 rounded-2xl border border-gold/25 bg-background p-6 shadow-xl">
            <div className="flex items-center gap-3"><BedDouble className="size-5 text-gold" /><h2 className="font-serif text-xl font-semibold">{dialog.room ? 'Ubah Kamar' : 'Tambah Kamar'}</h2></div>
            <label className="block text-sm">Nomor kamar<input className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3" required maxLength={20} value={nomor} onChange={e => setNomor(e.target.value)} /></label>
            <label className="block text-sm">Tipe kamar
              <select className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3" value={tipeId} disabled={!!dialog.room} onChange={e => setTipeId(e.target.value)} required>
                <option value="">Pilih tipe</option>
                {types.rows.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
              </select>
              {dialog.room && <p className="mt-1 text-xs text-muted-foreground">Tipe kamar tidak dapat diubah setelah kamar dibuat.</p>}
            </label>
            <label className="block text-sm">Lantai (opsional)<input className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3" type="number" min={1} step={1} value={lantai} onChange={e => setLantai(e.target.value)} /></label>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={saving} onClick={() => setDialog(null)}>Batal</Button><Button disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan Kamar'}</Button></div>
          </form>
        </div>}
        <ActionResultDialog result={actionResult} onClose={() => setActionResult(null)} />
      </SubPengaturan>
    </Kerangka>
  );
}
