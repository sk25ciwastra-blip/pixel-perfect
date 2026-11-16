import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { Kerangka } from '@/components/kerangka';
import { Button } from '@/components/ui/button';
import { housekeepingSections, housekeepingShortageNote } from '@/lib/housekeeping-queue';
import { useTable } from '@/lib/data-live';
import { supabase } from '@/integrations/supabase/client';
import { meta } from '@/lib/meta';
import { usePeran } from '@/lib/peran';
import { ChecklistHousekeeping } from '@/components/checklist-housekeeping';
import { PerawatanBerkala } from '@/components/perawatan-berkala';
import { Link } from '@tanstack/react-router';
import { BedDouble, Brush, ClipboardCheck, ClipboardList, History, Wrench, CheckCircle2, Users, Package, Layers, Eye, ChevronRight, ChevronLeft, ChevronDown, Clock3, LoaderCircle, MoreHorizontal, TriangleAlert } from 'lucide-react';
import '@/components/housekeeping.css';
import latarHousekeeping from '@/assets/header-transaksi.jpg';
import { ringkasanHousekeeping } from '@/lib/housekeeping-ringkasan';
import { GrafikReferensi, PanelPerawatanReferensi, PanelSelesaiReferensi, RiwayatReferensi, RingkasanSelesai } from '@/components/housekeeping-referensi';

const labelKamar: Record<string, string> = { terisi: 'Terisi', perlu: 'Perlu Dibersihkan', sedang: 'Sedang Dibersihkan', siap: 'Tersedia' };

type BagianHk = 'status' | 'checklist' | 'perlengkapan' | 'perawatan' | 'riwayat';
const bagianHk: { kode: BagianHk; label: string; ikon: typeof Brush }[] = [
  { kode: 'status', label: 'Operasional', ikon: Brush },
  { kode: 'checklist', label: 'Tugas Petugas', ikon: Users },
  { kode: 'perlengkapan', label: 'Perlengkapan', ikon: Package },
  { kode: 'perawatan', label: 'Perawatan', ikon: Wrench },
  { kode: 'riwayat', label: 'Riwayat HK', ikon: History },
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
  const [filter, setFilter] = useState('');
  const [halaman, setHalaman] = useState(0);
  const [detailRoomId, setDetailRoomId] = useState<string | null>(null);

  useEffect(() => {
    const tutup = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      document.querySelectorAll<HTMLDetailsElement>('.hk-aksi-menu[open]').forEach((menu) => {
        if (event instanceof KeyboardEvent || !menu.contains(event.target as Node)) menu.open = false;
      });
    };
    document.addEventListener('pointerdown', tutup);
    document.addEventListener('keydown', tutup);
    return () => { document.removeEventListener('pointerdown', tutup); document.removeEventListener('keydown', tutup); };
  }, []);

  const rooms = useTable('rooms');
  const types = useTable('room_types');
  const history = useTable('housekeeping_history');
  const maintenance = useTable('housekeeping_maintenance');
  const checklists = useTable('housekeeping_checklists');

  const operationalRooms = useMemo(() => rooms.rows.filter((room) => room.room_number !== '01'), [rooms.rows]);

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

  const sections = housekeepingSections(operationalRooms, bagian === 'checklist' ? 'checklist' : 'status');

  const dirtyRooms = sections.find((section) => section.key === 'dirty')?.rooms ?? [];
  const allDirtySelected =
    dirtyRooms.length > 0 && dirtyRooms.every((room) => selectedIds.includes(room.id));
  const activeRooms = operationalRooms.filter((room) => room.active);
  const todayWib = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const visibleSections = sections.map(section => ({ ...section, rooms: section.rooms.filter(room => !filter || (filter.startsWith('status:') ? section.key === filter.slice(7) : room.room_type_id === filter.slice(5))) }));
  const barisKamar = visibleSections.flatMap(section => section.rooms.map(room => ({ section, room })));
  const ukuranHalaman = 5;
  const jumlahHalaman = Math.max(1, Math.ceil(barisKamar.length / ukuranHalaman));
  const halamanAktif = Math.min(halaman, jumlahHalaman - 1);
  const barisHalaman = barisKamar.slice(halamanAktif * ukuranHalaman, halamanAktif * ukuranHalaman + ukuranHalaman);
  const waktuSingkat = (value: string) => new Date(value).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const bulanWib = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()).slice(0, 7);
  const riwayatBulanIni = history.rows.filter(item => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(item.created_at)).startsWith(bulanWib)).length;
  const perawatanHariIni = maintenance.rows.filter(item => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(item.performed_at)) === todayWib).length;
  const perawatanBulanIni = maintenance.rows.filter(item => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(item.performed_at)).startsWith(bulanWib)).length;
  const todayHistory = history.rows.filter(item => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(item.created_at)) === todayWib);
  const startedToday = new Set(todayHistory.filter(item => item.action === 'start_cleaning').map(item => item.room_id));
  const finishedToday = new Set(todayHistory.filter(item => item.action === 'finish_cleaning').map(item => item.room_id));
  const progressTotal = new Set([...startedToday, ...finishedToday]).size;
  const progress = progressTotal ? Math.round(finishedToday.size / progressTotal * 100) : 0;
  const queueRooms = activeRooms.filter(room => room.status === 'dirty' || room.status === 'cleaning');
  const completionSummary = useMemo(() => ringkasanHousekeeping(history.rows), [history.rows]);

  const linenPanel = <section className="hk-bottom-panel"><div className="hk-panel-header"><Layers /><h2>Perlengkapan &amp; Linen</h2><Link to="/housekeeping" search={{ bagian: 'perlengkapan' }} className="hk-gold-link">Lihat Detail <ChevronRight /></Link></div><div className="hk-stock-grid">{[{ label: 'Handuk', ikon: Layers }, { label: 'Sprei Set', ikon: BedDouble }, { label: 'Amenitas', ikon: Package }].map(item => <div className="hk-stock-item" key={item.label}><item.ikon /><div><p>{item.label}</p><strong>— / —</strong></div><p className="hk-stock-empty">Stok belum tersedia</p></div>)}</div></section>;
  const maintenancePanel = <section className="hk-bottom-panel"><div className="hk-panel-header"><Wrench /><h2>Perawatan &amp; Kendala</h2></div><div className="hk-maintenance-empty"><CheckCircle2 /><div><p>Status kendala belum tersedia.</p><p className="text-muted-foreground">Riwayat perawatan dapat dilihat di tab Perawatan.</p></div><Link to="/housekeeping" search={{ bagian: 'perawatan' }} className="hk-outline-link">Lihat Perawatan <ChevronRight /></Link></div></section>;

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

      try {
        await refreshAll();
      } catch {
        setMessage('Pembersihan sudah dimulai, tetapi tampilan gagal diperbarui. Muat ulang halaman untuk melihat status terbaru.');
        return false;
      }

      setMessage('Pembersihan dimulai. Selesaikan pemeriksaan melalui tab Checklist.');
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
        : `${succeeded.length} kamar berhasil dimulai. Selesaikan pemeriksaan melalui tab Checklist.`,
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
      <div className="halaman-housekeeping">
      <header className="hk-header">
        <div className="hk-header-latar" aria-hidden="true"><img src={latarHousekeeping} alt="" width={1536} height={512} /></div>
        <div className="hk-header-isi">
          <div><p className="hk-brand">BATURADEN 25 HOMESTAY</p><h1>Housekeeping</h1><p className="hk-header-description">Pantau status kamar, pekerjaan kebersihan, dan perawatan berkala.</p></div>
          <div className="hk-header-kanan">
            <blockquote>“Kamar bersih, tamu nyaman,<br />pelayanan lancar.”</blockquote>
          </div>
        </div>
      </header>
      {message && <p role="status" className="mb-4 rounded-lg border border-gold/20 bg-secondary px-4 py-3 text-sm">{message}</p>}

      {bagian === 'riwayat' && (
        <section className="overflow-hidden rounded-lg border border-border bg-card shadow-lembut">
          <div className="hk-panel-header"><History className="size-5 text-gold" /><h2 className="font-serif text-xl">Riwayat Pekerjaan</h2></div>
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
      {bagian === 'perlengkapan' && <div className="hk-bottom">{linenPanel}{maintenancePanel}</div>}

      {(bagian === 'status' || bagian === 'checklist') && (<>
        <div className="hk-stats hk-stats-reference">
          <div className="hk-summary-card hk-summary-rooms"><div className="hk-summary-main"><span className="hk-stat-icon"><BedDouble /></span><div><p>Status Kamar</p><strong>{activeRooms.length}<small> Kamar</small></strong></div></div><div className="hk-summary-status">{[{ label: 'Tersedia', status: 'ready' }, { label: 'Perlu Dibersihkan', status: 'dirty' }, { label: 'Sedang Dibersihkan', status: 'cleaning' }, { label: 'Terisi', status: 'occupied' }].map(item => <span key={item.status} data-state={item.status}>{item.label} {activeRooms.filter(room => room.status === item.status).length}</span>)}</div></div>
          <div className="hk-summary-card"><div className="hk-summary-main"><span className="hk-stat-icon"><Wrench /></span><div><p>Perawatan Berkala</p><strong>{maintenance.error ? '—' : maintenance.rows.length}<small> Catatan</small></strong></div></div><p className="hk-summary-caption"><span>{perawatanHariIni} Hari Ini</span><span>{perawatanBulanIni} Bulan Ini</span></p></div>
          <div className="hk-summary-card"><div className="hk-summary-main"><span className="hk-stat-icon"><ClipboardList /></span><div><p>Riwayat Pekerjaan</p><strong>{riwayatBulanIni}<small> Pekerjaan</small></strong></div></div><p className="hk-summary-caption"><span>Bulan Ini</span></p></div>
          <div className="hk-summary-card hk-summary-gold"><div className="hk-summary-main"><span className="hk-stat-icon"><Brush /></span><p>Jumlah Kamar Dibersihkan</p></div><RingkasanSelesai data={completionSummary} /></div>
        </div>
        <div className="hk-layout">
          <section className="hk-room-panel">
            <div className="hk-panel-header">
              <BedDouble className="hk-heading-icon" /><h2>{bagian === 'checklist' ? 'Tugas Petugas' : 'Status Kamar'}</h2>
              <label className="hk-filter-select"><span className="sr-only">Saring kamar</span><select value={filter} onChange={(event) => { setFilter(event.target.value); setHalaman(0); }}><option value="">Semua Status</option>{sections.map(section => <option key={section.key} value={`status:${section.key}`}>{labelKamar[section.label]}</option>)}{types.rows.filter(type => activeRooms.some(room => room.room_type_id === type.id)).map(type => <option key={type.id} value={`type:${type.id}`}>Tipe {type.name}</option>)}</select><ChevronDown aria-hidden="true" /></label>
            </div>
            {canAdvance && dirtyRooms.length > 0 && (
              <div className="hk-bulk-bar">
                <label><input type="checkbox" className="size-4 accent-primary" checked={allDirtySelected} onChange={(event) => setSelectedIds(event.target.checked ? dirtyRooms.map((room) => room.id) : [])} />Pilih Semua</label>
                <Button size="sm" disabled={!selectedIds.length || processingIds.length > 0} onClick={() => void startSelected()}><Brush className="size-4" />Mulai ({selectedIds.length}) Kamar</Button>
              </div>
            )}
            <div className="hk-table-scroll">
              <table className="hk-table text-left">
                <thead><tr>{['No. Kamar', 'Tipe', 'Status Kamar', 'Status HK', 'Petugas', 'Terakhir Diubah', 'Aksi'].map((title) => <th key={title}>{title}</th>)}</tr></thead>
                <tbody>
                  {barisHalaman.map(({ section, room }) => {
                        const roomType = types.rows.find((type) => type.id === room.room_type_id);
                        const lastHistory = history.rows.filter((item) => item.room_id === room.id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
                        const shortage = housekeepingShortageNote(latestChecklist.get(room.id));
                        const hk = room.status === 'cleaning' ? 'cleaning' : room.status === 'dirty' ? 'dirty' : latestChecklist.get(room.id)?.result === 'passed' ? 'ready' : 'unknown';
                        return (
                          <tr key={room.id}>
                            <td><div className="hk-room-cell">{section.key === 'dirty' && canAdvance && <input aria-label={`Pilih kamar ${room.room_number}`} type="checkbox" className="size-4 accent-primary" checked={selectedIds.includes(room.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, room.id] : current.filter((id) => id !== room.id))} />}<span className="hk-room-number">{room.room_number}</span></div></td>
                            <td>{roomType?.name ?? '—'}</td>
                            <td><span className="hk-room-status" data-state={section.label}>{labelKamar[section.label]}</span></td>
                            <td><div className="hk-hk-cell">{hk === 'unknown' ? <span className="hk-dash">—</span> : <span className="hk-state" data-state={hk}>{hk === 'ready' ? <CheckCircle2 /> : hk === 'cleaning' ? <LoaderCircle /> : <Clock3 />}{hk === 'ready' ? 'Selesai' : hk === 'cleaning' ? 'Proses' : 'Menunggu'}</span>}{shortage && <span className="hk-shortage-flag" title="Ada informasi kekurangan" aria-label="Ada informasi kekurangan"><TriangleAlert /></span>}</div></td>
                            <td>{lastHistory?.performed_by_name || '—'}</td>
                            <td>{waktuSingkat(lastHistory?.created_at ?? room.updated_at)}</td>
                            <td>
                              <details className="hk-aksi-menu">
                                <summary aria-label={`Aksi kamar ${room.room_number}`}><MoreHorizontal /></summary>
                                <div className="hk-aksi-isi" onClick={(event) => { if ((event.target as HTMLElement).closest('button')) (event.currentTarget.parentElement as HTMLDetailsElement).open = false; }}>
                                  <Button variant="ghost" size="sm" aria-label={`Lihat riwayat kamar ${room.room_number}`} onClick={() => setDetailRoomId(room.id)}><Eye className="size-4" />Lihat Riwayat</Button>
                                  {section.key === 'dirty' && canAdvance && <Button variant="ghost" size="sm" disabled={processingIds.includes(room.id)} onClick={() => void advanceOne(room.id)}><Brush className="size-4" />{processingIds.includes(room.id) ? 'Memproses...' : 'Mulai Bersihkan'}</Button>}
                                  {section.key === 'cleaning' && room.status === 'cleaning' && canAdvance && <Button variant="ghost" size="sm" disabled={processingIds.includes(room.id)} onClick={() => setChecklistRoomId(room.id)}><ClipboardCheck className="size-4" />Telah Dibersihkan</Button>}
                                  {['dirty', 'cleaning'].includes(room.status) && canOverride && <Button variant="ghost" size="sm" disabled={processingIds.includes(room.id)} onClick={() => void overrideReady(room.id, room.room_number)}><CheckCircle2 className="size-4" />Jadikan Siap</Button>}
                                  {shortage && <details className="hk-aksi-catatan"><summary>Informasi kekurangan</summary><p>{shortage}</p></details>}
                                </div>
                              </details>
                            </td>
                          </tr>
                        );
                      })}
                  {barisKamar.length === 0 && <tr><td colSpan={7} className="hk-table-empty">Tidak ada kamar dalam antrean ini.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="hk-panel-footer">
              <span>Menampilkan {barisKamar.length ? `${halamanAktif * ukuranHalaman + 1}–${halamanAktif * ukuranHalaman + barisHalaman.length}` : '0'} dari {barisKamar.length} kamar</span>
              <div className="hk-pager"><button type="button" aria-label="Halaman sebelumnya" disabled={halamanAktif === 0} onClick={() => setHalaman(halamanAktif - 1)}><ChevronLeft /></button><b>{halamanAktif + 1}/{jumlahHalaman}</b><button type="button" aria-label="Halaman berikutnya" disabled={halamanAktif >= jumlahHalaman - 1} onClick={() => setHalaman(halamanAktif + 1)}><ChevronRight /></button></div>
            </div>
          </section>
          <aside className="hk-side">
            {bagian === 'status' && <><PanelPerawatanReferensi rows={maintenance.rows} rooms={rooms.rows} /><PanelSelesaiReferensi data={completionSummary} /></>}
            {bagian === 'checklist' && <><section className="hk-side-panel hk-progress-panel" data-empty={!progressTotal}>
              <div className="hk-panel-header"><BedDouble /><h2>Progress Pembersihan Hari Ini</h2></div>
              <div className="hk-progress-body"><svg viewBox="0 0 120 120" className="hk-donut" role="img" aria-label={progressTotal ? `${progress}% selesai dari ${progressTotal} kamar yang dikerjakan hari ini` : 'Belum ada pekerjaan hari ini'}><circle cx="60" cy="60" r="46" className="hk-donut-track" /><circle cx="60" cy="60" r="46" className="hk-donut-value" strokeDasharray={`${progress * 2.89} 289`} /><text x="60" y="58" textAnchor="middle" className="hk-donut-number">{progressTotal ? `${progress}%` : '—'}</text><text x="60" y="76" textAnchor="middle" className="hk-donut-caption">{progressTotal ? 'Selesai' : 'Belum tercatat'}</text></svg>
              <dl className="hk-progress-legend"><div data-state="ready"><dt>Selesai</dt><dd>{finishedToday.size} kamar</dd></div><div data-state="cleaning"><dt>Sedang Proses</dt><dd>{activeRooms.filter(room => room.status === 'cleaning').length} kamar</dd></div><div data-state="dirty"><dt>Menunggu</dt><dd>{activeRooms.filter(room => room.status === 'dirty').length} kamar</dd></div><div><dt>Total Dikerjakan</dt><dd>{progressTotal} kamar</dd></div></dl></div>
            </section>
            <section className="hk-side-panel hk-queue-panel"><div className="hk-panel-header"><ClipboardCheck /><h2>Antrean Tugas Petugas</h2></div><ul className="hk-task-list">{queueRooms.length === 0 && <li className="hk-empty-task"><CheckCircle2 /><div>Tidak ada tugas dalam antrean.<p>Belum ada kamar perlu dibersihkan.</p></div></li>}{queueRooms.slice(0, 3).map(room => <li key={room.id}><Brush /><div><strong>Kamar {room.room_number} — Pembersihan</strong><p>{room.status === 'cleaning' ? history.rows.filter(item => item.room_id === room.id && item.action === 'start_cleaning').sort((a,b) => b.created_at.localeCompare(a.created_at))[0]?.performed_by_name || 'Petugas belum tercatat' : 'Menunggu pembersihan'}</p></div><span className="hk-state" data-state={room.status}>{room.status === 'cleaning' ? 'Proses' : 'Menunggu'}</span></li>)}</ul><Link to="/housekeeping" search={{ bagian: 'checklist' }} className="hk-queue-link">Lihat Tugas Petugas <ChevronRight /></Link></section></>}
          </aside>
        </div>
        <div className="hk-bottom hk-reference-bottom"><RiwayatReferensi history={history.rows} rooms={rooms.rows} /><GrafikReferensi data={completionSummary} history={history.rows} /></div>
      </>)}

      </div>

      {detailRoomId && <div className="hk-detail-backdrop" onClick={() => setDetailRoomId(null)}><section className="hk-detail" role="dialog" aria-modal="true" aria-label="Riwayat kebersihan kamar" onClick={event => event.stopPropagation()}><h2>Riwayat Kamar {rooms.rows.find(room => room.id === detailRoomId)?.room_number}</h2>{history.rows.filter(item => item.room_id === detailRoomId).sort((a,b) => b.created_at.localeCompare(a.created_at)).map(item => <div key={item.id}><strong>{item.action === 'start_cleaning' ? 'Mulai dibersihkan' : item.action === 'finish_cleaning' ? 'Selesai dibersihkan' : 'Dijadikan siap'}</strong><p>{item.performed_by_name} · {new Date(item.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</p><p>{item.note}</p></div>)}{!history.rows.some(item => item.room_id === detailRoomId) && <p>Belum ada riwayat kebersihan.</p>}{(() => { const note = housekeepingShortageNote(latestChecklist.get(detailRoomId)); return note ? <div className="hk-detail-catatan"><strong>Informasi kekurangan</strong><p className="whitespace-pre-wrap break-words">{note}</p></div> : null; })()}<Button variant="outline" onClick={() => setDetailRoomId(null)}>Tutup</Button></section></div>}
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
