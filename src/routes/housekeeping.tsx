import { createFileRoute } from '@tanstack/react-router';
import { Fragment, useMemo, useState } from 'react';
import { Kerangka } from '@/components/kerangka';
import { Button } from '@/components/ui/button';
import { LencanaStatus } from '@/components/status-kamar';
import type { StatusKamar } from '@/lib/data-contoh';
import { useTable } from '@/lib/data-live';
import { supabase } from '@/integrations/supabase/client';
import { meta } from '@/lib/meta';
import { usePeran } from '@/lib/peran';
import { ChecklistHousekeeping } from '@/components/checklist-housekeeping';
import { PerawatanBerkala } from '@/components/perawatan-berkala';
import { Link } from '@tanstack/react-router';
import { BedDouble, Brush, ClipboardCheck, History, Wrench, Search, Sparkles, CheckCircle2, Users, ListChecks } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { konteksHeader } from '@/lib/konteks-header';

type BagianHk = 'status' | 'checklist' | 'perawatan' | 'riwayat';
const bagianHk: { kode: BagianHk; label: string; ikon: typeof Brush }[] = [
  { kode: 'status', label: 'Status', ikon: BedDouble },
  { kode: 'checklist', label: 'Checklist', ikon: ClipboardCheck },
  { kode: 'perawatan', label: 'Perawatan Berkala', ikon: Wrench },
  { kode: 'riwayat', label: 'Riwayat Pekerjaan', ikon: History },
];

export const Route = createFileRoute('/housekeeping')({
  validateSearch: (s: Record<string, unknown>): { bagian?: BagianHk | undefined } => ({
    bagian: bagianHk.some((b) => b.kode === s['bagian']) ? (s['bagian'] as BagianHk) : undefined,
  }),
  head: () =>
    meta(
      'Kebersihan Kamar',
      'Kamar yang perlu dan sedang dibersihkan di Baturaden 25 Homestay.',
    ),
  component: Halaman,
});

type Section = {
  key: 'dirty' | 'needs_action' | 'cleaning' | 'ready';
  judul: string;
  label: StatusKamar;
  rooms: ReturnType<typeof useTable<'rooms'>>['rows'];
};

function Halaman() {
  const { posisiKode } = usePeran();
  const { bagian = 'status' } = Route.useSearch();
  const canAdvance =
    posisiKode === 'owner' ||
    posisiKode === 'supervisor' ||
    posisiKode === 'housekeeping';
  const canOverride = posisiKode === 'owner' || posisiKode === 'supervisor';

  const [processingIds, setProcessingIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [checklistRoomId, setChecklistRoomId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  const rooms = useTable('rooms');
  const types = useTable('room_types');
  const history = useTable('housekeeping_history');
  const checklists = useTable('housekeeping_checklists');
  const transactions = useTable('transactions');

  const transactionNumbers = useMemo(
    () => new Map(transactions.rows.map((transaction) => [transaction.id, transaction.transaction_number])),
    [transactions.rows],
  );

  const operationalRooms = useMemo(() => {
    const term = search.trim().toLowerCase();

    return rooms.rows.filter((room) => {
      if (room.room_number === '01') return false;
      if (!term) return true;

      return (
        room.room_number.toLowerCase().includes(term) ||
        history.rows.some(
          (item) =>
            item.room_id === room.id &&
            (item.job_number?.toLowerCase().includes(term) ||
              (item.transaction_id
                ? transactionNumbers.get(item.transaction_id)?.toLowerCase().includes(term)
                : false)),
        )
      );
    });
  }, [history.rows, rooms.rows, search, transactionNumbers]);

  const latestChecklist = useMemo(() => {
    const map = new Map<string, (typeof checklists.rows)[number]>();

    for (const checklist of checklists.rows) {
      const current = map.get(checklist.room_id);

      if (
        !current ||
        new Date(checklist.created_at).getTime() >
          new Date(current.created_at).getTime()
      ) {
        map.set(checklist.room_id, checklist);
      }
    }

    return map;
  }, [checklists.rows]);

  const needsActionIds = useMemo(
    () =>
      new Set(
        operationalRooms
          .filter(
            (room) =>
              latestChecklist.get(room.id)?.result === 'needs_action',
          )
          .map((room) => room.id),
      ),
    [latestChecklist, operationalRooms],
  );

  const sections: Section[] = [
    {
      key: 'dirty',
      judul: 'Perlu Dibersihkan',
      label: 'perlu',
      rooms: operationalRooms.filter((room) => room.status === 'dirty'),
    },
    {
      key: 'needs_action',
      judul: 'Perlu Tindakan',
      label: 'perlu',
      rooms: operationalRooms.filter((room) => needsActionIds.has(room.id)),
    },
    {
      key: 'cleaning',
      judul: 'Sedang Dibersihkan',
      label: 'sedang',
      rooms: operationalRooms.filter(
        (room) => room.status === 'cleaning' && !needsActionIds.has(room.id),
      ),
    },
    {
      key: 'ready',
      judul: 'Sudah Siap',
      label: 'siap',
      rooms: operationalRooms.filter(
        (room) => room.status === 'ready' && !needsActionIds.has(room.id),
      ),
    },
  ];

  const dirtyRooms = sections.find((section) => section.key === 'dirty')?.rooms ?? [];
  const allDirtySelected =
    dirtyRooms.length > 0 && dirtyRooms.every((room) => selectedIds.includes(room.id));
  const activeRooms = operationalRooms.filter((room) => room.active);
  const selesaiHariIni = new Set(
    history.rows
      .filter(
        (item) =>
          item.action === 'finish_cleaning' &&
          new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Jakarta',
          }).format(new Date(item.created_at)) ===
            new Intl.DateTimeFormat('en-CA', {
              timeZone: 'Asia/Jakarta',
            }).format(new Date()),
      )
      .map((item) => item.room_id),
  ).size;

  function refreshAll() {
    return Promise.all([
      rooms.refresh(),
      history.refresh(),
      checklists.refresh(),
    ]);
  }

  async function advanceOne(id: string) {
    setProcessingIds((current) => [...current, id]);
    setMessage('');

    try {
      const { error: advanceError } = await supabase.rpc(
        'advance_room_cleaning',
        { _room_id: id },
      );

      if (advanceError) {
        setMessage(advanceError.message);
        return false;
      }

      return true;
    } finally {
      setProcessingIds((current) => current.filter((item) => item !== id));
    }
  }

  async function startSelected() {
    const ids = [...selectedIds];

    if (!ids.length) return;

    setProcessingIds(ids);
    setMessage('');

    const results = await Promise.all(
      ids.map(async (id) => {
        const { error: advanceError } = await supabase.rpc(
          'advance_room_cleaning',
          { _room_id: id },
        );

        return { id, error: advanceError };
      }),
    );

    const succeeded = results.filter((result) => !result.error).map((result) => result.id);
    const failed = results.filter((result) => result.error);

    setSelectedIds((current) => current.filter((id) => !succeeded.includes(id)));
    setProcessingIds([]);
    await refreshAll();

    setMessage(
      failed.length
        ? `${succeeded.length} kamar dimulai, ${failed.length} kamar gagal karena status berubah atau tidak tersedia.`
        : `${succeeded.length} kamar berhasil dimulai.`,
    );
  }

  async function overrideReady(id: string, roomNumber: string) {
    const confirmed = window.confirm(
      `Jadikan Kamar ${roomNumber} SIAP sekarang?\n\nGunakan override hanya jika kamar sudah dipastikan bersih. Tindakan ini akan tercatat.`,
    );

    if (!confirmed) return;

    setProcessingIds((current) => [...current, id]);
    setMessage('');

    try {
      const { error: overrideError } = await supabase.rpc(
        'override_room_ready',
        { _room_id: id },
      );

      if (overrideError) {
        setMessage(overrideError.message);
        return;
      }

      await refreshAll();
    } finally {
      setProcessingIds((current) => current.filter((item) => item !== id));
    }
  }

  const checklistRoom = checklistRoomId
    ? rooms.rows.find((room) => room.id === checklistRoomId)
    : undefined;
  const checklistRoomType = checklistRoom
    ? types.rows.find((type) => type.id === checklistRoom.room_type_id)
    : undefined;

  return (
    <Kerangka judul="Housekeeping" tanpaJudul>
      <header className="mb-0 mt-4 grid gap-5 border-b border-gold/20 pb-6 lg:grid-cols-[minmax(0,1fr)_minmax(220px,340px)] lg:items-center">
        <div className="flex min-w-0 items-center gap-4">
          <span className="ikon-bulat grid size-14 shrink-0 place-items-center text-gold-light"><Brush className="size-8" strokeWidth={1.5} /></span>
          <div className="min-w-0">
            <h1 className="font-serif text-3xl text-gold-light sm:text-4xl">Housekeeping</h1>
            <p className="mt-2 text-sm text-muted-foreground">Status, Checklist, Perawatan, dan Riwayat</p>
          </div>
        </div>
        <blockquote className="border-l border-gold/50 pl-4 font-serif text-base italic leading-relaxed text-foreground/85">
          “{konteksHeader['/housekeeping']}”
        </blockquote>
      </header>

      <nav aria-label="Bagian Housekeeping" className="mb-5 grid grid-cols-2 gap-1 border-b border-gold/20 py-2 sm:flex sm:flex-wrap">
        {bagianHk.map((b) => (
          <Link key={b.kode} to="/housekeeping" search={{ bagian: b.kode }} aria-current={bagian === b.kode ? 'page' : undefined}
            className={`flex min-h-12 min-w-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition sm:px-5 ${bagian === b.kode ? 'border-b-2 border-gold bg-gold/15 text-gold-light' : 'border-b-2 border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
            <b.ikon className="size-4 shrink-0" /><span>{b.label}</span>
          </Link>
        ))}
      </nav>
      {message && <p role="status" className="mb-4 rounded-lg border border-gold/20 bg-secondary px-4 py-3 text-sm">{message}</p>}

      {bagian === 'riwayat' && (
        <section className="overflow-hidden rounded-lg border border-border bg-card shadow-lembut">
          <div className="flex items-center gap-3 border-b border-border px-5 py-4"><History className="size-5 text-gold" /><h2 className="font-serif text-xl">Riwayat Pekerjaan</h2></div>
          <ul className="divide-y divide-border">
            {history.rows.length === 0 && <li className="px-5 py-10 text-center text-sm text-muted-foreground">Belum ada riwayat housekeeping.</li>}
            {[...history.rows].sort((x, y) => y.created_at.localeCompare(x.created_at)).slice(0, 100).map((item) => (
              <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Kamar {rooms.rows.find((r) => r.id === item.room_id)?.room_number ?? '—'} · {item.action === 'start_cleaning' ? 'Mulai dibersihkan' : item.action === 'finish_cleaning' ? 'Selesai dibersihkan' : 'Override menjadi siap'}</p>
                  <p className="mt-1 break-words text-sm text-muted-foreground">{item.performed_by_name} · <span className="font-mono">{item.job_number ?? 'HK legacy'}</span></p>
                </div>
                <time className="max-w-28 text-right text-xs leading-relaxed text-muted-foreground sm:max-w-none">{new Date(item.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</time>
              </li>
            ))}
          </ul>
        </section>
      )}
      {bagian === 'perawatan' && <PerawatanBerkala readOnly={!canAdvance} />}

      {(bagian === 'status' || bagian === 'checklist') && (<>
        <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            { label: 'Kamar Siap', value: activeRooms.filter((room) => room.status === 'ready').length, ikon: Sparkles, warna: 'bg-siap/30 text-siap-foreground border-siap-foreground/20' },
            { label: 'Kamar Terisi', value: activeRooms.filter((room) => room.status === 'occupied').length, ikon: Users, warna: 'bg-terisi/30 text-terisi-foreground border-terisi-foreground/20' },
            { label: 'Perlu Dibersihkan', value: activeRooms.filter((room) => room.status === 'dirty').length, ikon: BedDouble, warna: 'bg-bahaya/30 text-bahaya-foreground border-bahaya-foreground/20' },
            { label: 'Selesai Hari Ini', value: selesaiHariIni, ikon: CheckCircle2, warna: 'bg-gold/10 text-gold-light border-gold/25' },
          ].map((item) => (
            <div key={item.label} className={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-lg border p-4 shadow-lembut ${item.warna}`}>
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-current/5 sm:size-12"><item.ikon className="size-6" strokeWidth={1.6} /></span>
              <div className="min-w-0"><p className="text-2xl font-semibold tabular-nums text-foreground">{item.value}</p><p className="mt-1 text-xs leading-relaxed text-foreground/80 sm:text-sm">{item.label}</p></div>
            </div>
          ))}
        </div>
        <label className="relative mb-5 block max-w-xl">
          <Search className="pointer-events-none absolute left-4 top-3.5 size-5 text-muted-foreground" />
          <Input aria-label="Cari nomor kamar, TRX, atau HK" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nomor kamar, TRX, atau HK…" className="h-12 rounded-lg bg-card pl-12 text-base" />
        </label>
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-card shadow-lembut">
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
              <ListChecks className="size-5 shrink-0 text-gold" /><div><h2 className="font-serif text-xl">{bagian === 'checklist' ? 'Pemeriksaan Kamar' : 'Daftar Kamar'}</h2><p className="mt-1 text-sm text-muted-foreground">Status terbaru dan riwayat kebersihan kamar.</p></div>
            </div>
            {canAdvance && dirtyRooms.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-gold/5 px-5 py-3">
                <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="size-4 accent-primary" checked={allDirtySelected} onChange={(event) => setSelectedIds(event.target.checked ? dirtyRooms.map((room) => room.id) : [])} />Pilih Semua</label>
                <Button size="sm" disabled={!selectedIds.length || processingIds.length > 0} onClick={() => void startSelected()}><Brush className="size-4" />Mulai ({selectedIds.length}) Kamar</Button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead><tr className="bg-secondary/60">{['Kamar', 'Tipe', 'Status', 'Riwayat Terakhir', 'Aksi'].map((title) => <th key={title} className="px-4 py-3 text-xs">{title}</th>)}</tr></thead>
                <tbody>
                  {sections.filter((section) => bagian === 'status' || section.key === 'cleaning' || section.key === 'needs_action').map((section) => (
                    <Fragment key={section.key}>
                      <tr><td colSpan={5} className="border-y border-gold/10 bg-gold/5 px-4 py-2.5 font-semibold text-gold-light">{section.judul}<span className="ml-2 text-xs font-normal text-muted-foreground">· {section.rooms.length} kamar</span></td></tr>
                      {section.rooms.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-sm text-muted-foreground">Tidak ada kamar dalam status ini.</td></tr>}
                      {section.rooms.map((room) => {
                        const roomType = types.rows.find((type) => type.id === room.room_type_id);
                        const roomHistory = history.rows.filter((item) => item.room_id === room.id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 3);
                        return (
                          <tr key={room.id} className="align-top">
                            <td className="border-b border-border px-4 py-4"><div className="flex items-center gap-2">{section.key === 'dirty' && canAdvance && <input aria-label={`Pilih kamar ${room.room_number}`} type="checkbox" className="size-4 accent-primary" checked={selectedIds.includes(room.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, room.id] : current.filter((id) => id !== room.id))} />}<span className="inline-grid min-w-10 place-items-center rounded-md border border-gold/20 bg-secondary px-2 py-1.5 text-base font-semibold">{room.room_number}</span></div></td>
                            <td className="border-b border-border px-4 py-4 text-muted-foreground">{roomType?.name}</td>
                            <td className="border-b border-border px-4 py-4">{section.key === 'needs_action' ? <span className="inline-block rounded-full bg-bahaya px-2.5 py-1 text-xs font-semibold text-bahaya-foreground">Perlu Tindakan</span> : <LencanaStatus status={section.label} />}
                              {section.key === 'needs_action' && room.status === 'ready' && <p className="mt-2 max-w-36 text-xs leading-relaxed text-perlu-foreground">READY dengan kekurangan tercatat. Tinjau alasan pada riwayat audit.</p>}
                            </td>
                            <td className="max-w-64 border-b border-border px-4 py-4">
                              {roomHistory.length === 0 ? <span className="text-sm text-muted-foreground">Belum ada riwayat.</span> : <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">{new Date(roomHistory[0].created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}<span className="mt-1 block text-xs text-gold">{roomHistory[0].performed_by_name}</span></summary><div className="mt-3 space-y-3">{roomHistory.map((item) => <div key={item.id} className="border-l border-gold/25 pl-3"><p className="font-semibold">{item.action === 'start_cleaning' ? 'Mulai dibersihkan' : item.action === 'finish_cleaning' ? 'Selesai dibersihkan' : 'Override menjadi siap'}</p><p className="mt-1 text-xs text-muted-foreground">{item.performed_by_name} · {new Date(item.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</p><p className="mt-1 break-all font-mono text-xs text-gold/80">{item.job_number ?? 'HK legacy'}{item.transaction_id && transactionNumbers.get(item.transaction_id) ? ` · ${transactionNumbers.get(item.transaction_id)}` : ''}</p>{item.note && <p className="mt-1 break-words text-sm">{item.note}</p>}</div>)}</div></details>}
                            </td>
                            <td className="border-b border-border px-4 py-4"><div className="flex min-w-32 flex-col gap-2">
                              {section.key === 'dirty' && canAdvance && <Button size="sm" disabled={processingIds.includes(room.id)} onClick={() => void advanceOne(room.id)}><Brush className="size-4" />{processingIds.includes(room.id) ? 'Memproses...' : 'Mulai Bersihkan'}</Button>}
                              {(section.key === 'cleaning' || section.key === 'needs_action') && room.status === 'cleaning' && canAdvance && <Button size="sm" disabled={processingIds.includes(room.id)} onClick={() => setChecklistRoomId(room.id)}><ClipboardCheck className="size-4" />{section.key === 'needs_action' ? 'Periksa Kembali' : 'Telah Dibersihkan'}</Button>}
                              {room.status !== 'ready' && canOverride && <Button variant="outline" size="sm" disabled={processingIds.includes(room.id)} onClick={() => void overrideReady(room.id, room.room_number)}>Jadikan Siap</Button>}
                            </div></td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <aside className="space-y-5">
            <section className="rounded-lg border border-border bg-card p-5 shadow-lembut">
              <div className="flex items-center gap-2"><CheckCircle2 className="size-5 text-gold" /><h2 className="font-serif text-xl">Ringkasan Hari Ini</h2></div>
              <dl className="mt-4 divide-y divide-border text-sm">
                {[['Kamar Aktif', activeRooms.length], ['Kamar Siap', activeRooms.filter((room) => room.status === 'ready').length], ['Selesai Dibersihkan', selesaiHariIni]].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 py-3"><dt className="text-muted-foreground">{label}</dt><dd className="text-lg font-semibold tabular-nums text-gold-light">{value}</dd></div>)}
              </dl>
            </section>
            <section className="rounded-lg border border-border bg-card p-5 shadow-lembut">
              <div className="flex items-center gap-2"><History className="size-5 text-gold" /><h2 className="font-serif text-xl">Pekerjaan Terakhir</h2></div>
              <ul className="mt-3 divide-y divide-border">
                {history.rows.length === 0 && <li className="py-4 text-sm text-muted-foreground">Belum ada riwayat housekeeping.</li>}
                {[...history.rows].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5).map((item) => <li key={item.id} className="py-3"><p className="text-sm font-semibold">Kamar {rooms.rows.find((r) => r.id === item.room_id)?.room_number ?? '—'}</p><p className="mt-1 text-sm text-muted-foreground">{item.action === 'start_cleaning' ? 'Mulai dibersihkan' : item.action === 'finish_cleaning' ? 'Selesai dibersihkan' : 'Override menjadi siap'}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.performed_by_name} · {new Date(item.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</p></li>)}
              </ul>
              <Link to="/housekeeping" search={{ bagian: 'riwayat' }} className="mt-3 flex min-h-10 items-center justify-center rounded-md border border-gold/25 px-3 text-sm font-semibold text-gold-light hover:bg-gold/10">Lihat Semua Riwayat</Link>
            </section>
          </aside>
        </div>
      </>)}

      {checklistRoom && (
        <ChecklistHousekeeping
          roomId={checklistRoom.id}
          roomNumber={checklistRoom.room_number}
          roomTypeName={checklistRoomType?.name ?? ''}
          onClose={() => setChecklistRoomId(null)}
          onSaved={async () => {
            await refreshAll();
          }}
        />
      )}
    </Kerangka>
  );
}
