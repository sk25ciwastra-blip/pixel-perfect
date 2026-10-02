import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Kerangka, Judul, Daftar } from '@/components/kerangka';
import { FormulirPemesanan } from '@/components/formulir-pemesanan';
import { Button } from '@/components/ui/button';
import { LencanaTeks } from '@/components/status-kamar';
import { useTable } from '@/lib/data-live';
import { meta } from '@/lib/meta';
export const Route=createFileRoute('/booking')({head:()=>meta('Pemesanan','Daftar pemesanan kamar Baturaden 25 Homestay.'),component:Halaman});
function Halaman(){const [open,setOpen]=useState(false);const {rows,error,refresh}=useTable('transactions');const guests=useTable('guests');const rooms=useTable('rooms');function baris(isi:typeof rows){return <Daftar>{isi.map(b=><li key={b.id} className="flex items-center gap-3 px-4 py-3.5"><div className="w-14 shrink-0 rounded-xl bg-secondary py-1.5 text-center"><p className="text-[10px] text-muted-foreground">{new Date(b.created_at).toLocaleDateString('id-ID')}</p><p className="text-sm font-bold">{new Date(b.created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</p></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{guests.rows.find(g=>g.id===b.guest_id)?.full_name}</p><p className="truncate text-xs text-muted-foreground">{b.transaction_number} · Kamar {rooms.rows.find(r=>r.id===b.room_id)?.room_number}</p></div><LencanaTeks status={b.status==='booking'?'Booking':b.status==='check_in'?'Check-in':b.status==='check_out'?'Check-out':'Dibatalkan'}/></li>)}</Daftar>}
 return <Kerangka judul="Booking" keterangan="Daftar pemesanan kamar" aksi={<Button className="h-11 rounded-xl" onClick={()=>setOpen(true)}><Plus className="mr-2 h-4 w-4" />Buat Booking Baru</Button>}>{error&&<p role="alert">{error}</p>}<Judul>Akan Datang</Judul>{baris(rows.filter(b=>b.status==='booking'))}<div className="mt-8"><Judul>Riwayat</Judul></div>{baris(rows.filter(b=>b.status!=='booking'))}{open&&<FormulirPemesanan mode="booking" onClose={()=>setOpen(false)} onSaved={refresh}/>}</Kerangka>}
