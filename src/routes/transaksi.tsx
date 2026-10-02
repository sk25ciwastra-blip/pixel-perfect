import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Kerangka, Daftar } from '@/components/kerangka';
import { FormulirPemesanan } from '@/components/formulir-pemesanan';
import { Button } from '@/components/ui/button';
import { LencanaTeks } from '@/components/status-kamar';
import { rupiah } from '@/lib/data-contoh';
import { useTable } from '@/lib/data-live';
import { meta } from '@/lib/meta';
export const Route=createFileRoute('/transaksi')({head:()=>meta('Transaksi','Daftar transaksi Baturaden 25 Homestay.'),component:Halaman});
const labels={booking:'Booking',check_in:'Check-in',check_out:'Check-out',cancelled:'Dibatalkan'};
function SisaWaktu({ endsAt }: { endsAt: string }) {const [now,setNow]=useState(() => Date.now());useEffect(()=>{const interval=window.setInterval(()=>setNow(Date.now()),1000);return ()=>window.clearInterval(interval)},[]);const seconds=Math.max(0,Math.floor((new Date(endsAt).getTime()-now)/1000));const hours=Math.floor(seconds/3600);const minutes=Math.floor(seconds%3600/60);const remainder=seconds%60;return <p className="mt-1 text-xs font-semibold text-primary">Sisa waktu: {String(hours).padStart(2,'0')}:{String(minutes).padStart(2,'0')}:{String(remainder).padStart(2,'0')}</p>}
function Halaman(){const [open,setOpen]=useState(false);const {rows,error,refresh}=useTable('transactions');const guests=useTable('guests');const rooms=useTable('rooms');return <Kerangka judul="Transaksi" keterangan="Daftar transaksi tamu" aksi={<Button className="h-11 rounded-xl" onClick={()=>setOpen(true)}><Plus className="mr-2 h-4 w-4" />Check-in Langsung</Button>}>{error&&<p role="alert">{error}</p>}<Daftar>{rows.map(t=><li key={t.id} className="px-4 py-4"><div className="flex items-start justify-between gap-3"><p className="font-mono text-sm font-bold text-primary">{t.transaction_number}</p><LencanaTeks status={labels[t.status]}/></div><div className="mt-2 flex items-end justify-between gap-3"><div><p className="text-sm font-semibold">{guests.rows.find(g=>g.id===t.guest_id)?.full_name}</p><p className="text-xs text-muted-foreground">Kamar {rooms.rows.find(r=>r.id===t.room_id)?.room_number} · {new Date(t.created_at).toLocaleDateString('id-ID')}</p>{t.status==='check_in'&&t.ends_at&&<SisaWaktu endsAt={t.ends_at}/>}</div><p className="font-bold">{t.price_snapshot===null?'—':rupiah(Number(t.price_snapshot))}</p></div></li>)}</Daftar>{open&&<FormulirPemesanan mode="check_in" onClose={()=>setOpen(false)} onSaved={refresh}/>}</Kerangka>}
