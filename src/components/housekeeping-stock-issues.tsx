import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ChevronRight, Layers, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';
import type { Room } from '@/lib/data-live';

type Tables = Database['public']['Tables'];
type Item = Tables['hk_supply_items']['Row'];
type Issue = Tables['hk_issue_reports']['Row'];
type Action = 'initial' | 'adjust' | 'minimum' | 'report' | 'follow_up';
type Payload = Record<string, Json>;
type RoomOption = Pick<Room, 'id' | 'room_number'>;
const queryKey = ['hk-stock-issues'] as const;
const pageSize = 15;
const categories = { pemakaian: 'Pemakaian', kekurangan: 'Kekurangan', kerusakan: 'Kerusakan', kebersihan: 'Kebersihan', lainnya: 'Lainnya' };
const priorities = { rendah: 'Rendah', normal: 'Normal', tinggi: 'Tinggi', mendesak: 'Mendesak' };
const statuses = { DILAPORKAN: 'Dilaporkan', DIPROSES: 'Diproses', SELESAI: 'Selesai' };
const stockActions = { initial: 'Stok awal', adjust: 'Penyesuaian stok', minimum: 'Batas minimum' };
const time = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' });
const low = (item: Item) => item.minimum !== null && item.quantity <= item.minimum;
const textValue = (form: FormData, name: string) => String(form.get(name) ?? '').trim();
const optional = (form: FormData, name: string) => textValue(form, name) || null;

function useSupplies(scope: string) {
  return useQuery({
    queryKey: [...queryKey, scope, 'items'],
    queryFn: async ({ signal }) => {
      const items: Item[] = [];
      const limit = 100;
      for (let offset = 0; ; offset += limit) {
        const { data, error } = await supabase.from('hk_supply_items').select('*')
          .order('name').order('id').range(offset, offset + limit - 1).abortSignal(signal);
        if (error) throw error;
        items.push(...data);
        if (data.length < limit) return items;
      }
    },
  });
}

function useIssues(scope: string, status: Issue['status'], page: number, summary: boolean) {
  return useQuery({
    queryKey: [...queryKey, scope, 'issues', status, page, summary],
    queryFn: async ({ signal }) => {
      const issues = supabase.from('hk_issue_reports');
      if (summary) {
        const { count, error } = await issues.select('id', { count: 'exact', head: true })
          .neq('status', 'SELESAI').abortSignal(signal);
        if (error) throw error;
        return { rows: [], count: count ?? 0 };
      }
      const { data, count, error } = await issues.select('*', { count: 'exact' }).eq('status', status)
        .order('created_at', { ascending: false }).order('id', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1).abortSignal(signal);
      if (error) throw error;
      return { rows: data, count: count ?? 0 };
    },
  });
}

function ReadError({ reload }: { reload: () => void }) {
  return <div className="flex flex-wrap items-center gap-2" role="alert">
    <p>Data Housekeeping gagal dimuat. Periksa koneksi atau ketersediaan modul.</p>
    <Button type="button" size="sm" variant="outline" onClick={reload}>Coba lagi</Button>
  </div>;
}

function Pager({ page, count, change }: { page: number; count: number; change: (next: number) => void }) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (page === 0 && pages === 1) return null;
  return <div className="flex flex-wrap items-center gap-2">
    <Button type="button" size="sm" variant="outline" disabled={!page} onClick={() => change(page - 1)}>Sebelumnya</Button>
    <span>Halaman {page + 1} / {Math.max(page + 1, pages)}</span>
    <Button type="button" size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => change(page + 1)}>Berikutnya</Button>
  </div>;
}

function Options({ values }: { values: Record<string, string> }) {
  return <>{Object.entries(values).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</>;
}

const field = 'grid min-w-0 gap-1';
const select = 'h-9 w-full rounded-md border border-input bg-background px-2 text-foreground';

function ActionForm({ action, fields, payload, label = 'Simpan', onReset }: {
  action: Action;
  fields: ReactNode;
  payload: (form: FormData) => Payload;
  label?: string;
  onReset?: () => void;
}) {
  const client = useQueryClient();
  const active = useRef(false);
  const pending = useRef<{ id: string; data: Payload } | null>(null);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState({ text: '', error: false });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (active.current) return;
    const form = event.currentTarget;
    active.current = true;
    setBusy(true);
    setMessage({ text: '', error: false });
    try {
      const request = pending.current ?? { id: crypto.randomUUID(), data: payload(new FormData(form)) };
      pending.current = request;
      const { error } = await supabase.rpc('record_hk_operational_action', {
        _request_id: request.id, _action: action, _payload: request.data,
      });
      if (error) {
        if (['22023', '42501', '23505', 'PGRST202'].includes(error.code)) {
          pending.current = null;
          setUncertain(false);
          setMessage({ text: error.code === 'PGRST202' ? 'Modul Housekeeping belum tersedia di Cloud.' : error.message, error: true });
          if (error.message.startsWith('Status laporan sudah berubah')) {
            await client.invalidateQueries({ queryKey });
          }
          return;
        }
        throw error;
      }
      pending.current = null;
      setUncertain(false);
      form.reset();
      setMessage({ text: 'Tersimpan.', error: false });
      await client.invalidateQueries({ queryKey });
    } catch {
      setUncertain(Boolean(pending.current));
      setMessage({ text: 'Penyimpanan belum dapat dikonfirmasi. Coba lagi untuk memeriksa permintaan yang sama.', error: true });
    } finally {
      active.current = false;
      setBusy(false);
    }
  }

  return <form className="space-y-3 py-3" onSubmit={submit} onReset={onReset}>
    <fieldset className="min-w-0 space-y-3" disabled={busy || uncertain}>
      {fields}
      <label className={field}>{action === 'report' ? 'Deskripsi (sertakan jumlah jika diketahui)' : 'Alasan / catatan tindak lanjut'}
        <Textarea name="note" required maxLength={2000} />
      </label>
    </fieldset>
    <Button size="sm" type="submit" disabled={busy}>{busy ? 'Menyimpan…' : uncertain ? 'Coba lagi' : label}</Button>
    {message.text && <p role={message.error ? 'alert' : 'status'}>{message.text}</p>}
  </form>;
}

function MinimumInput({ value }: { value?: number | null }) {
  return <label className={field}>Batas minimum (opsional)
    <Input className="text-foreground" name="minimum" type="number" min={0} max={2147483647} step={1} defaultValue={value ?? ''} />
  </label>;
}

function StockHistory({ scope, id, kind }: { scope: string; id: string; kind: 'supply_id' | 'issue_id' }) {
  const [page, setPage] = useState(0);
  const history = useQuery({
    queryKey: [...queryKey, scope, 'events', kind, id, page],
    queryFn: async ({ signal }) => {
      const { data, count, error } = await supabase.from('hk_operational_events')
        .select('actor_id,request_id,actor_name,created_at,action,note,balance_before,balance_after,minimum_before,minimum_after,status_before,status_after', { count: 'exact' })
        .eq(kind, id).order('created_at', { ascending: false }).order('actor_id').order('request_id')
        .range(page * pageSize, (page + 1) * pageSize - 1).abortSignal(signal);
      if (error) throw error;
      return { rows: data, count: count ?? 0 };
    },
  });
  if (history.isPending) return <p role="status">Memuat riwayat…</p>;
  if (history.isError) return <ReadError reload={() => void history.refetch()} />;
  return <div className="space-y-2 py-2">
    {history.data.rows.length === 0 && <p>Belum ada catatan pada halaman ini.</p>}
    <ol className="divide-y divide-border">
      {history.data.rows.map(event => <li className="space-y-1 py-2" key={event.actor_id + event.request_id}>
        <p className="font-medium">{event.action === 'report' ? 'Laporan dibuat' : event.action === 'follow_up'
          ? (event.status_before === event.status_after ? 'Catatan tindak lanjut' : statuses[event.status_after!])
          : stockActions[event.action]}</p>
        {(event.action === 'initial' || event.action === 'adjust') &&
          <p>Stok {event.balance_before === null ? event.balance_after : `${event.balance_before} → ${event.balance_after}`}</p>}
        {event.action === 'minimum' &&
          <p>Minimum {event.minimum_before ?? 'tanpa batas'} → {event.minimum_after ?? 'tanpa batas'}</p>}
        <p className="whitespace-pre-wrap break-words">{event.note}</p>
        <p className="text-muted-foreground">{event.actor_name} · {time.format(new Date(event.created_at))} WIB</p>
      </li>)}
    </ol>
    <Pager page={page} count={history.data.count} change={setPage} />
  </div>;
}

function HistoryDetails({ scope, kind, id }: { scope: string; kind: 'supply_id' | 'issue_id'; id: string }) {
  const [open, setOpen] = useState(false);
  return <details onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer text-gold">Lihat riwayat</summary>
    {open && <StockHistory scope={scope} id={id} kind={kind} />}
  </details>;
}

function ItemRow({ item, owner, scope }: { item: Item; owner: boolean; scope: string }) {
  return <li className="space-y-2 rounded-lg border border-border p-3">
    <h3 className="break-words font-semibold">{item.name}</h3>
    <p><strong>{item.quantity} {item.unit}</strong> · {item.minimum === null ? 'Tanpa batas minimum' : `Minimum ${item.minimum}`}</p>
    {low(item) && <p className="font-semibold">Stok mencapai atau di bawah minimum</p>}
    {owner && <>
      <details><summary className="cursor-pointer text-gold">Sesuaikan stok</summary>
        <ActionForm action="adjust" fields={<div className="grid gap-3 sm:grid-cols-2">
          <label className={field}>Jenis perubahan<select name="direction" className={select}>
            <option value="add">Tambah</option><option value="subtract">Kurangi</option>
          </select></label>
          <label className={field}>Jumlah ({item.unit})<Input className="text-foreground" name="quantity" type="number" required min={1} max={2147483647} step={1} /></label>
        </div>} payload={form => ({
          supplyId: item.id, quantity: Number(textValue(form, 'quantity')) * (textValue(form, 'direction') === 'subtract' ? -1 : 1),
          note: textValue(form, 'note'),
        })} />
      </details>
      <details><summary className="cursor-pointer text-gold">Atur batas minimum</summary>
        <ActionForm action="minimum" fields={<MinimumInput value={item.minimum} />} payload={form => ({
          supplyId: item.id, minimum: optional(form, 'minimum') === null ? null : Number(textValue(form, 'minimum')), note: textValue(form, 'note'),
        })} />
      </details>
    </>}
    <HistoryDetails scope={scope} id={item.id} kind="supply_id" />
  </li>;
}

function ReportForm({ rooms, items }: { rooms: RoomOption[]; items: Item[] }) {
  const [category, setCategory] = useState('');
  return <ActionForm action="report" label="Kirim laporan" onReset={() => setCategory('')} fields={<div className="grid gap-3 sm:grid-cols-2">
    <label className={field}>Kategori<select name="category" required className={select}
      value={category} onChange={event => setCategory(event.target.value)}>
      <option value="">Pilih kategori</option><Options values={categories} />
    </select></label>
    <label className={field}>Prioritas<select name="priority" className={select} defaultValue="normal"><Options values={priorities} /></select></label>
    <label className={field}>Nomor kamar (opsional)<select name="roomId" className={select}>
      <option value="">Pilih kamar</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.room_number}</option>)}
    </select></label>
    <label className={field}>Area (opsional)<Input className="text-foreground" name="area" maxLength={100} /></label>
    {(category === 'pemakaian' || category === 'kekurangan') &&
      <label className={field}>Perlengkapan (opsional)<select name="supplyId" className={select}>
        <option value="">Pilih perlengkapan</option>{items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>}
  </div>} payload={form => ({
    category: textValue(form, 'category'), priority: textValue(form, 'priority'), roomId: optional(form, 'roomId'),
    area: optional(form, 'area'), supplyId: optional(form, 'supplyId'), note: textValue(form, 'note'),
  })} />;
}

function IssueRow({ issue, items, review, scope }: { issue: Issue; items: Item[]; review: boolean; scope: string }) {
  const item = items.find(candidate => candidate.id === issue.supply_id);
  const next = issue.status === 'DILAPORKAN' ? 'DIPROSES' : 'SELESAI';
  return <li className="space-y-2 rounded-lg border border-border p-3">
    <h3 className="font-semibold">{categories[issue.category]} · {priorities[issue.priority]} · {statuses[issue.status]}</h3>
    {(issue.room_number || issue.area || item) && <p className="break-words">
      {[issue.room_number && `Kamar ${issue.room_number}`, issue.area, item?.name].filter(Boolean).join(' · ')}
    </p>}
    <p className="whitespace-pre-wrap break-words">{issue.description}</p>
    <p className="text-muted-foreground">{issue.reported_by_name} · {time.format(new Date(issue.created_at))} WIB</p>
    <HistoryDetails scope={scope} id={issue.id} kind="issue_id" />
    {review && issue.status !== 'SELESAI' &&
      <details><summary className="cursor-pointer text-gold">Tindak lanjuti</summary>
        <ActionForm action="follow_up" key={issue.status} fields={<label className={field}>Status
          <select name="status" className={select}>
            <option value={issue.status}>Tetap {statuses[issue.status]}</option><option value={next}>{statuses[next]}</option>
          </select>
        </label>} payload={form => ({
          issueId: issue.id, expectedStatus: issue.status, status: textValue(form, 'status'), note: textValue(form, 'note'),
        })} />
      </details>}
  </li>;
}

export function HousekeepingStockIssues({ summary, owner, review, rooms, maintenanceCount }: {
  summary: boolean;
  owner: boolean;
  review: boolean;
  rooms: RoomOption[];
  maintenanceCount: number | null;
}) {
  const scope = useId();
  const [status, setStatus] = useState<Issue['status']>('DILAPORKAN');
  const [page, setPage] = useState(0);
  const stock = useSupplies(scope);
  const issues = useIssues(scope, status, page, summary);
  const items = stock.data ?? [];
  const issueData = issues.data;

  return <div className="hk-bottom">
    <section className="hk-bottom-panel min-w-0">
      <div className="hk-panel-header"><Layers /><h2>Perlengkapan &amp; Linen</h2>
        {summary && <Link to="/housekeeping" search={{ bagian: 'perlengkapan' }} hash="stok-hk" className="hk-gold-link">Lihat Stok <ChevronRight /></Link>}
      </div>
      <div id="stok-hk" className="space-y-3 p-4 text-sm">
        {stock.isPending && <p role="status">Memuat stok…</p>}
        {stock.isError && <ReadError reload={() => void stock.refetch()} />}
        {stock.isSuccess && <>
          <p>{items.length ? `${items.length} jenis · ${items.filter(low).length} mencapai atau di bawah minimum` : 'Belum ada stok awal yang dicatat Owner.'}</p>
          {summary ? <ul className="hk-stock-grid">
            {items.slice(0, 3).map(item => <li className="hk-stock-item" key={item.id}>
              <Layers /><div><p>{item.name}</p><strong>{item.quantity} {item.unit}</strong></div>
              {low(item) && <p className="hk-stock-empty">Minimum {item.minimum}</p>}
            </li>)}
          </ul> : <>
            {owner && <details><summary className="cursor-pointer text-gold">Catat stok awal</summary>
              <ActionForm action="initial" fields={<div className="grid gap-3 sm:grid-cols-2">
                <label className={field}>Nama perlengkapan<Input className="text-foreground" name="name" required maxLength={100} /></label>
                <label className={field}>Satuan<Input className="text-foreground" name="unit" required maxLength={40} /></label>
                <label className={field}>Stok awal aktual<Input className="text-foreground" name="quantity" type="number" required min={0} max={2147483647} step={1} /></label>
                <MinimumInput />
              </div>} payload={form => ({
                name: textValue(form, 'name'), unit: textValue(form, 'unit'), quantity: Number(textValue(form, 'quantity')),
                minimum: optional(form, 'minimum') === null ? null : Number(textValue(form, 'minimum')), note: textValue(form, 'note'),
              })} />
            </details>}
            <ul className="space-y-2">{items.map(item => <ItemRow key={item.id} item={item} owner={owner} scope={scope} />)}</ul>
          </>}
        </>}
      </div>
    </section>
    <section className="hk-bottom-panel min-w-0">
      <div className="hk-panel-header"><Wrench /><h2>Perawatan &amp; Kendala</h2></div>
      <div id="kendala-hk" className="space-y-3 p-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/housekeeping" search={{ bagian: 'perawatan' }} className="hk-outline-link">Lihat Perawatan <ChevronRight /></Link>
          {maintenanceCount !== null && <span>{maintenanceCount} catatan perawatan terbaca</span>}
        </div>
        {issues.isPending && <p role="status">Memuat laporan…</p>}
        {issues.isError && <ReadError reload={() => void issues.refetch()} />}
        {summary && issues.isSuccess && <p>{issueData?.count ? `${issueData.count} kendala belum selesai` : 'Tidak ada kendala terbuka.'}</p>}
        {summary ? <Link to="/housekeeping" search={{ bagian: 'perlengkapan' }} hash="kendala-hk" className="hk-outline-link">
          Lihat atau Laporkan Kendala <ChevronRight />
        </Link> : <>
          {issues.isSuccess && <details><summary className="cursor-pointer text-gold">Laporkan kendala, pemakaian, atau kekurangan</summary>
            <ReportForm rooms={rooms} items={items} />
          </details>}
          <label className={field}>Status laporan<select className={select} value={status} onChange={event => {
            setStatus(event.target.value as Issue['status']);
            setPage(0);
          }}><Options values={statuses} /></select></label>
          {issues.isSuccess && <>
            {issues.data.rows.length === 0 && <p>Belum ada laporan pada halaman ini untuk status tersebut.</p>}
            <ul className="space-y-2">{issues.data.rows.map(issue => <IssueRow key={issue.id} issue={issue} items={items} review={review} scope={scope} />)}</ul>
            <Pager page={page} count={issues.data.count} change={setPage} />
          </>}
        </>}
      </div>
    </section>
  </div>;
}
