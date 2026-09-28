import { createFileRoute } from '@tanstack/react-router';
import { Kerangka, Judul } from '@/components/kerangka';
import { Button } from '@/components/ui/button';
import { LencanaStatus } from '@/components/status-kamar';
import { useTable } from '@/lib/data-live';
import { supabase } from '@/integrations/supabase/client';
import { meta } from '@/lib/meta';
export const Route=createFileRoute('/housekeeping')({head:()=>meta('Kebersihan Kamar','Kamar yang perlu dan sedang dibersihkan di Baturaden 25 Homestay.'),component:Halaman});
const bagian=[{status:'dirty',judul:'Perlu Dibersihkan',label:'perlu'},{status:'cleaning',judul:'Sedang Dibersihkan',label:'sedang'},{status:'ready',judul:'Sudah Siap',label:'siap'}] as const;
function Halaman(){const {rows,refresh,error}=useTable('rooms');const types=useTable('room_types');async function advance(id:string){const {error}=await supabase.rpc('advance_room_cleaning',{_room_id:id});if(error)window.alert(error.message);else await refresh()}
 return <Kerangka judul="Housekeeping" keterangan="Kebersihan kamar hari ini">{error&&<p role="alert">{error}</p>}<div className="space-y-8">{bagian.map(b=>{const isi=rows.filter(k=>k.status===b.status);return <section key={b.status}><Judul aksi={<span className="text-xs font-semibold text-muted-foreground">{isi.length}</span>}>{b.judul}</Judul><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{isi.map(k=><div key={k.id} className="rounded-2xl border border-border bg-card p-5 shadow-lembut"><div className="flex items-start justify-between gap-3"><div><p className="text-2xl font-bold">Kamar {k.room_number}</p><p className="text-sm text-muted-foreground">{types.rows.find(t=>t.id===k.room_type_id)?.name}</p></div><LencanaStatus status={b.label}/></div>{b.status!=='ready'&&<Button className="mt-4 h-12 w-full rounded-xl uppercase" onClick={()=>void advance(k.id)}>{b.status==='dirty'?'Mulai Bersihkan':'Selesai'}</Button>}</div>)}</div></section>})}</div></Kerangka>}
