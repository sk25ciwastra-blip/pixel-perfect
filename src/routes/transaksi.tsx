import { createFileRoute } from '@tanstack/react-router';
import { Kerangka, Daftar } from '@/components/kerangka';
import { LencanaTeks } from '@/components/status-kamar';
import { rupiah } from '@/lib/data-contoh';
import { useTable } from '@/lib/data-live';
import { meta } from '@/lib/meta';
export const Route=createFileRoute('/transaksi')({head:()=>meta('Transaksi','Daftar transaksi Baturaden 25 Homestay.'),component:Halaman});
const labels={booking:'Booking',check_in:'Check-in',check_out:'Check-out',cancelled:'Dibatalkan'};
function Halaman(){const {rows,error}=useTable('transactions');const guests=useTable('guests');const rooms=useTable('rooms');return <Kerangka judul="Transaksi" keterangan="Daftar transaksi tamu">{error&&<p role="alert">{error}</p>}<Daftar>{rows.map(t=><li key={t.id} className="px-4 py-4"><div className="flex items-start justify-between gap-3"><p className="font-mono text-sm font-bold text-primary">{t.transaction_number}</p><LencanaTeks status={labels[t.status]}/></div><div className="mt-2 flex items-end justify-between gap-3"><div><p className="text-sm font-semibold">{guests.rows.find(g=>g.id===t.guest_id)?.full_name}</p><p className="text-xs text-muted-foreground">Kamar {rooms.rows.find(r=>r.id===t.room_id)?.room_number} · {new Date(t.created_at).toLocaleDateString('id-ID')}</p></div><p className="font-bold">{t.price_snapshot===null?'—':rupiah(Number(t.price_snapshot))}</p></div></li>)}</Daftar></Kerangka>}
