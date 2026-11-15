import { createFileRoute } from '@tanstack/react-router';
import { SubPengaturan } from '@/components/pengaturan-sub';
import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, Plus } from 'lucide-react';
import { Kerangka } from '@/components/kerangka';
import { Button } from '@/components/ui/button';
import { useTable, type Room, type RoomType } from '@/lib/data-live';
import { usePeran } from '@/lib/peran';
import { supabase } from '@/integrations/supabase/client';
import { meta } from '@/lib/meta';
import '@/components/paket-harga.css';
export const Route=createFileRoute('/tipe-kamar')({head:()=>meta('Tipe Kamar','Pengelolaan tipe dan daftar kamar Baturaden 25 Homestay.'),component:Halaman});

const TIPE_RESMI=['standard','superior a','superior b','deluxe'];
const nomorUrut=(a:Room,b:Room)=>a.room_number.localeCompare(b.room_number,'id',{numeric:true});

function Halaman(){
 const {peran}=usePeran();const owner=peran==='owner';
 const tipe=useTable('room_types');const kamar=useTable('rooms');const trx=useTable('transactions');
 const [pilih,setPilih]=useState<string|null>(null);
 const [item,setItem]=useState<Room|null>(null);const [open,setOpen]=useState(false);
 const [nomor,setNomor]=useState('');const [catatan,setCatatan]=useState('');const [pesan,setPesan]=useState('');const [sibuk,setSibuk]=useState<string|null>(null);const [info,setInfo]=useState('');
 const daftarTipe=useMemo(()=>TIPE_RESMI.map(n=>(tipe.rows as RoomType[]).find(t=>t.name.trim().toLowerCase()===n)).filter((t):t is RoomType=>!!t),[tipe.rows]);
 const terpilih=daftarTipe.find(t=>t.id===pilih)??null;
 const kamarTipe=(id:string)=>(kamar.rows as Room[]).filter(r=>r.room_type_id===id).sort(nomorUrut);
 const dipakai=(r:Room)=>r.status==='occupied'||(trx.rows as {room_id:string;status:string}[]).some(t=>t.room_id===r.id&&(t.status==='check_in'||t.status==='booking'));
 function ubah(r?:Room){setItem(r??null);setNomor(r?.room_number??'');setCatatan(r?.notes??'');setPesan('');setOpen(true)}
 async function simpan(e:React.FormEvent){e.preventDefault();if(!terpilih)return;const n=nomor.trim();
  if(!n){setPesan('Nomor kamar wajib diisi.');return}
  if((kamar.rows as Room[]).some(r=>r.room_number.trim().toLowerCase()===n.toLowerCase()&&r.id!==item?.id)){setPesan('Nomor kamar sudah digunakan.');return}
  const res=item?await supabase.from('rooms').update({room_number:n,notes:catatan}).eq('id',item.id):await supabase.from('rooms').insert({room_number:n,notes:catatan,room_type_id:terpilih.id});
  if(res.error)setPesan(res.error.message);else{setOpen(false);await kamar.refresh()}}
 async function alih(r:Room){setInfo('');
  if(r.active&&dipakai(r)){setInfo(`Kamar ${r.room_number} sedang digunakan atau memiliki booking aktif, sehingga tidak dapat dinonaktifkan.`);return}
  setSibuk(r.id);const res=await supabase.from('rooms').update({active:!r.active}).eq('id',r.id);setSibuk(null);
  if(res.error)setInfo(res.error.message);else await kamar.refresh()}
 const error=tipe.error||kamar.error;
 return <Kerangka judul="Tipe Kamar" aksi={terpilih&&owner?<Button className="h-11 shrink-0 gap-2 rounded-xl px-5 text-base" onClick={()=>ubah()}><Plus className="size-4"/><span className="leading-none">Tambah Kamar</span></Button>:undefined}><SubPengaturan tanpaKembali={!!terpilih}>
  {error&&<p role="alert">{error}</p>}
  {terpilih?<>
   <button type="button" className="ph-kembali-tipe" onClick={()=>{setPilih(null);setInfo('')}}><ArrowLeft/>Kembali</button>
   <section className="ph-kelompok"><div className="ph-judul"><h2>{terpilih.name}</h2><span className="ph-jumlah">{kamarTipe(terpilih.id).length} kamar</span><span className="ph-judul-garis"/></div>
    {info&&<p role="alert" className="mb-3 rounded-xl bg-destructive/15 px-4 py-2 text-sm font-semibold text-destructive-foreground">{info}</p>}
    <div className="ph-tabel"><table><thead><tr><th>Nomor Kamar</th><th>Tipe</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
     {kamarTipe(terpilih.id).length===0?<tr><td colSpan={4} className="ph-kosong">Belum ada kamar untuk tipe ini.</td></tr>:kamarTipe(terpilih.id).map(r=><tr key={r.id}>
      <td className="ph-nama">{r.room_number}</td><td className="ph-slot">{terpilih.name}</td>
      <td><span className={`ph-pil ${r.active?'ph-pil-aktif':'ph-pil-nonaktif'}`}>{r.active?'Aktif':'Nonaktif'}</span></td>
      <td>{owner?<div className="flex items-center gap-3"><button type="button" className="ph-ubah" onClick={()=>ubah(r)}>Ubah</button>
       <button type="button" role="switch" aria-checked={r.active} aria-label={`${r.active?'Nonaktifkan':'Aktifkan'} kamar ${r.room_number}`} disabled={sibuk===r.id} onClick={()=>alih(r)} className="tk-switch"><span/></button><span className="ph-slot">{r.active?'ON':'OFF'}</span></div>:<span className="ph-slot">Khusus Owner</span>}</td>
     </tr>)}
    </tbody></table></div>
   </section></>
  :<div className="ph-pilihan tk-pilihan">{daftarTipe.map(t=><button key={t.id} type="button" className="ph-kartu-tipe" onClick={()=>setPilih(t.id)}><h2>{t.name}</h2><span className="ph-kartu-jumlah">{kamarTipe(t.id).length} kamar tersedia</span><ChevronRight/></button>)}</div>}
  {open&&terpilih&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/75 backdrop-blur-sm p-4"><form onSubmit={simpan} className="w-full max-w-md space-y-3 rounded-2xl bg-background p-5 shadow-lembut"><h2 className="text-lg font-bold">{item?'Ubah kamar':'Tambah kamar'} · {terpilih.name}</h2>
   <label className="block text-sm">Nomor kamar<input required value={nomor} onChange={e=>setNomor(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3"/></label>
   <label className="block text-sm">Catatan<input value={catatan} onChange={e=>setCatatan(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3"/></label>
   {pesan&&<p role="alert" className="text-sm text-destructive">{pesan}</p>}
   <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Batal</Button><Button>Simpan</Button></div></form></div>}
 </SubPengaturan></Kerangka>}
