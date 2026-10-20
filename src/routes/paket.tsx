import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Kerangka, Daftar } from '@/components/kerangka';
import { Button } from '@/components/ui/button';
import { useTable, type Package } from '@/lib/data-live';
import { rupiah } from '@/lib/data-contoh';
import { supabase } from '@/integrations/supabase/client';
import { meta } from '@/lib/meta';
export const Route=createFileRoute('/paket')({head:()=>meta('Paket dan Harga','Pengelolaan paket menginap Baturaden 25 Homestay.'),component:Halaman});

const PAKET_RESMI = [
 { name: 'Paket Pagi', duration: 450 },
 { name: 'Paket Malam', duration: 600 },
 { name: 'Paket Harian', duration: 1380 },
 { name: 'Paket 2 Jam', duration: 120 },
 { name: 'Paket 4 Jam', duration: 240 },
 { name: 'Paket 6 Jam', duration: 360 },
 { name: 'Paket 12 Jam', duration: 720 },
 { name: 'Paket 24 Jam', duration: 1440 },
 { name: 'Paket Mingguan', duration: 10080 },
] as const;
function Halaman(){const {rows,refresh,error}=useTable('packages');const history=useTable('package_price_history');const [item,setItem]=useState<Package|null>(null);const [open,setOpen]=useState(false);const [nama,setNama]=useState('');const [durasi,setDurasi]=useState('120');const [hargaWeekday,setHargaWeekday]=useState('0');const [hargaWeekend,setHargaWeekend]=useState('0');const [alasan,setAlasan]=useState('');const [deskripsi,setDeskripsi]=useState('');const [active,setActive]=useState(true);const [message,setMessage]=useState('');
 function edit(p?:Package){
  const pilihan=p
   ? PAKET_RESMI.find(x=>x.name===p.name)
   : PAKET_RESMI.find(x=>!rows.some(existing=>existing.name===x.name));
  if(!pilihan){
   setMessage('Semua 9 paket resmi sudah tersedia.');
   return;
  }
  setItem(p??null);
  setNama(pilihan.name);
  setDurasi(String(pilihan.duration));
  setHargaWeekday(String(p?.weekday_price??p?.price??0));
  setHargaWeekend(String(p?.weekend_price??p?.price??0));
  setDeskripsi(p?.description??'');
  setActive(p?.active??true);
  setAlasan('');
  setMessage('');
  setOpen(true);
 }
 function pilihPaketResmi(packageName:string){
  if(item) return;
  const pilihan=PAKET_RESMI.find(x=>x.name===packageName);
  if(!pilihan) return;
  if(rows.some(existing=>existing.name===pilihan.name)){
   setMessage('Paket ini sudah tersedia.');
   return;
  }
  setNama(pilihan.name);
  setDurasi(String(pilihan.duration));
  setMessage('');
 }
 async function save(e:React.FormEvent){
 e.preventDefault();
 const weekdayPrice=Number(hargaWeekday);
 const weekendPrice=Number(hargaWeekend);
 if(!nama.trim()||Number(durasi)<=0||weekdayPrice<0||weekendPrice<0){
  setMessage('Periksa nama, durasi, dan harga paket.');
  return;
 }
 const priceChanged=!!item&&(Number(item.weekday_price)!==weekdayPrice||Number(item.weekend_price)!==weekendPrice);
 if(priceChanged&&!alasan.trim()){
  setMessage('Isi alasan perubahan harga.');
  return;
 }

 if(!item){
  const result=await supabase.rpc('create_official_package',{
   _name:nama.trim(),
   _description:deskripsi,
   _active:active,
   _weekday_price:weekdayPrice,
   _weekend_price:weekendPrice
  });
  if(result.error){setMessage(result.error.message);return}
 }else{
  const updateResult=await supabase.rpc('update_package',{
   _package_id:item.id,
   _name:nama.trim(),
   _duration_minutes:Number(durasi),
   _description:deskripsi,
   _active:active,
   _weekday_price:weekdayPrice,
   _weekend_price:weekendPrice,
   _reason:alasan.trim()
  });
  if(updateResult.error){setMessage(updateResult.error.message);return}
 }
 setOpen(false);
 await refresh();
 await history.refresh();
}
 return <Kerangka judul="Paket & Harga" aksi={<Button className="h-11 rounded-xl" disabled={PAKET_RESMI.every(p=>rows.some(existing=>existing.name===p.name))} onClick={()=>edit()}>Tambah</Button>}>{error&&<p role="alert">{error}</p>}<Daftar>{rows.map(p=><li key={p.id} className="flex items-center gap-3 px-4 py-4"><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{p.name}</p><p className="text-xs text-muted-foreground">{p.duration_minutes} menit · {p.active?'Aktif':'Tidak aktif'}</p></div><div className="text-right text-xs"><p><span className="text-muted-foreground">Weekday </span><span className="font-bold">{rupiah(Number(p.weekday_price))}</span></p><p><span className="text-muted-foreground">Weekend </span><span className="font-bold">{rupiah(Number(p.weekend_price))}</span></p></div><Button size="sm" variant="outline" onClick={()=>edit(p)}>Ubah</Button></li>)}</Daftar><h2 className="mt-8 mb-3 text-xs font-semibold uppercase text-muted-foreground">Riwayat harga</h2><Daftar>{history.rows.map(h=><li key={h.id} className="px-4 py-3 text-sm">{rows.find(p=>p.id===h.package_id)?.name??'Paket'} · {h.price_type==='weekday'?'Weekday':h.price_type==='weekend'?'Weekend':'Harga lama'} · {rupiah(Number(h.old_price))} → {rupiah(Number(h.new_price))}<p className="text-xs text-muted-foreground">{h.reason} · {new Date(h.changed_at).toLocaleDateString('id-ID')}</p></li>)}</Daftar>{open&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/75 backdrop-blur-sm p-4"><form onSubmit={save} className="w-full max-w-md space-y-3 rounded-2xl bg-background p-5 shadow-lembut"><h2 className="text-lg font-bold">{item?'Ubah paket':'Tambah paket'}</h2><label className="block text-sm">Nama paket
 {item
  ? <input value={nama} readOnly className="mt-1 h-11 w-full rounded-xl border border-input bg-muted px-3"/>
  : <select value={nama} onChange={e=>pilihPaketResmi(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3">
     {PAKET_RESMI.filter(p=>!rows.some(existing=>existing.name===p.name)).map(p=><option key={p.name} value={p.name}>{p.name}</option>)}
    </select>}
</label>
<label className="block text-sm">Durasi
 <input value={`${durasi} menit`} readOnly className="mt-1 h-11 w-full rounded-xl border border-input bg-muted px-3"/>
</label>
{[['Harga Weekday',hargaWeekday,setHargaWeekday],['Harga Weekend',hargaWeekend,setHargaWeekend],['Deskripsi',deskripsi,setDeskripsi]].map(([label,value,setter])=><label key={label as string} className="block text-sm">{label as string}<input required={label!=='Deskripsi'} type={label==='Harga Weekday'||label==='Harga Weekend'?'number':'text'} min={label==='Harga Weekday'||label==='Harga Weekend'?'0':undefined} value={value as string} onChange={e=>(setter as (s:string)=>void)(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3"/></label>)}{item&&(Number(item.weekday_price)!==Number(hargaWeekday)||Number(item.weekend_price)!==Number(hargaWeekend))&&<label className="block text-sm">Alasan perubahan harga<input required value={alasan} onChange={e=>setAlasan(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3"/></label>}<label className="flex gap-2 text-sm"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/>Aktif</label>{message&&<p role="alert" className="text-sm text-destructive">{message}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Batal</Button><Button>Simpan</Button></div></form></div>}</Kerangka>}
