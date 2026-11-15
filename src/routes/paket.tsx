import { createFileRoute } from '@tanstack/react-router';
import { SubPengaturan } from '@/components/pengaturan-sub';
import { useState } from 'react';
import { ArrowLeft, ChevronRight, Lock, Plus } from 'lucide-react';
import { Kerangka } from '@/components/kerangka';
import { Button } from '@/components/ui/button';
import { useTable, type Package, type PackageRoomTypePrice } from '@/lib/data-live';
import { rupiah } from '@/lib/data-contoh';
import { hargaFormPaket, jamPaket, pilihanJam, teksJamWib } from '@/lib/paket-form';
import { urutanPaket } from '@/lib/urutan-pilihan';
import { supabase } from '@/integrations/supabase/client';
import { meta } from '@/lib/meta';
import '@/components/paket-harga.css';
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

/** Urutan kelompok tipe kamar sesuai tampilan; kelompok lain menyusul di belakang. */
const KELOMPOK_RESMI = [
 { key: 'standard', label: 'Standard' },
 { key: 'superior', label: 'Superior' },
 { key: 'deluxe', label: 'Deluxe' },
] as const;

/** Tanggal/jam WIB dari stempel waktu asli; — bila kosong. */
function waktuWib(t?:string|null):string{
 if(!t)return '—';const d=new Date(t);if(isNaN(d.getTime()))return '—';
 return new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(d).replace(/\./g,':')+' WIB';
}

type BarisKelompok={harga:PackageRoomTypePrice;paket:Package};

function jamBerlaku(p:Package):string{
 const {mulai,selesai}=jamPaket(p);
 if(p.time_mode==='fixed_days_checkout'&&selesai)return `${teksJamWib(selesai)} Hari ke ${Math.round(p.duration_minutes/1440)}`;
 if(mulai&&selesai)return `${teksJamWib(mulai)} - ${teksJamWib(selesai)}${selesai<mulai?' (besok)':''}`;
 return selesai?`Keluar ${teksJamWib(selesai)}`:'—';
}

/** Tabel warm white daftar paket satu tipe kamar. Hanya tampilan. */
function TabelKelompok({baris,onUbah}:{baris:BarisKelompok[];onUbah:(p:Package,h:PackageRoomTypePrice)=>void}){
 return <div className="ph-tabel ph-tabel-paket"><table><thead><tr><th>Nama Paket</th><th>Durasi</th><th>Jam Berlaku</th><th>Weekday</th><th>Weekend</th><th>Status</th><th>Terakhir Diubah</th><th>Aksi</th></tr></thead><tbody>{baris.length===0?<tr><td colSpan={8} className="ph-kosong">Belum ada harga paket untuk tipe ini.</td></tr>:baris.map(({harga,paket})=><tr key={harga.id}><td><span className="ph-nama">{paket.name}</span></td><td><span className="ph-slot">{paket.duration_minutes ? `${paket.duration_minutes} menit` : '—'}</span></td><td><span className="ph-slot">{jamBerlaku(paket)}</span></td><td><span className="ph-harga">{rupiah(Number(harga.weekday_price))}</span></td><td><span className="ph-harga">{rupiah(Number(harga.weekend_price))}</span></td><td><span className={`ph-pil ${paket.active?'ph-pil-aktif':'ph-pil-nonaktif'}`}>{paket.active?'Aktif':'Nonaktif'}</span></td><td><span className="ph-slot">{waktuWib(harga.updated_at)}</span></td><td className="text-right"><Button type="button" variant="ghost" className="ph-ubah" onClick={()=>onUbah(paket,harga)}>Ubah</Button></td></tr>)}</tbody></table></div>;
}

function Halaman(){const {rows,refresh,error,loading:muatPaket}=useTable('packages');const hargaTipe=useTable('package_room_type_prices');const history=useTable('package_price_history');const [item,setItem]=useState<Package|null>(null);const [open,setOpen]=useState(false);const [hargaItem,setHargaItem]=useState<PackageRoomTypePrice|null>(null);const [tipeForm,setTipeForm]=useState<string|null>(null);const [groupeForm,setGroupeForm]=useState<string|null>(null);const [tipe,setTipe]=useState<string|null>(null);const [nama,setNama]=useState('');const [durasi,setDurasi]=useState('120');const [hargaWeekday,setHargaWeekday]=useState('0');const [hargaWeekend,setHargaWeekend]=useState('0');const [alasan,setAlasan]=useState('');const [deskripsi,setDeskripsi]=useState('');const [active,setActive]=useState(true);const [message,setMessage]=useState('');
 function edit(p?:Package,h?:PackageRoomTypePrice){
  const group=terpilih?.key??null;
  const relation=h??null;
  const prix=p?hargaFormPaket(p,relation,group):null;
  setItem(p??null);
  setHargaItem(relation);
  setTipeForm(terpilih?.label??null);
  setGroupeForm(group);
  setNama(p?.name??'');
  setDurasi(p?String(p.duration_minutes):'');
  setHargaWeekday(prix?String(prix.weekday):'');
  setHargaWeekend(prix?String(prix.weekend):'');
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
 if(groupeForm){setMessage('Penyimpanan paket khusus tipe kamar belum tersedia; tidak ada data yang diubah.');return;}
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
 await hargaTipe.refresh();
 await history.refresh();
}

 // Kelompokkan harga asli per tipe kamar; paket diurutkan seperti urutan pilihan resmi.
 const kelompok=(()=>{
  const barisPer=(key:string):BarisKelompok[]=>hargaTipe.rows
   .filter(h=>h.pricing_group===key)
   .map(h=>({harga:h,paket:rows.find(p=>p.id===h.package_id)}))
   .filter((x):x is BarisKelompok=>!!x.paket)
   .sort((a,b)=>urutanPaket(a.paket.name)-urutanPaket(b.paket.name));
  const dikenal=KELOMPOK_RESMI.map(k=>({key:k.key,label:k.label,baris:barisPer(k.key)}));
  const kunciDikenal=new Set<string>(KELOMPOK_RESMI.map(k=>k.key));
  const lainnya=[...new Set(hargaTipe.rows.map(h=>h.pricing_group).filter(g=>!kunciDikenal.has(g)))]
   .map(g=>({key:g,label:g.charAt(0).toUpperCase()+g.slice(1),baris:barisPer(g)}));
  return [...dikenal,...lainnya];
 })();
 const adaHargaTipe=!muatPaket&&!hargaTipe.loading&&hargaTipe.rows.length>0;
 const terpilih=kelompok.find(k=>k.label===tipe)??null;

 const riwayatTipe=<details className="ph-riwayat"><summary>Riwayat Harga</summary><p>Riwayat perubahan harga khusus tipe kamar ini belum tersedia. Catatan riwayat saat ini belum mencatat tipe kamar, sehingga tidak ditampilkan agar tidak tercampur dengan tipe lain.</p></details>;

 return <Kerangka judul="Paket & Harga" aksi={terpilih?<Button className="h-11 shrink-0 gap-2 rounded-xl px-5 text-base" onClick={()=>edit()}><Plus className="size-4" /><span className="leading-none">Tambah Paket</span></Button>:undefined}><SubPengaturan tanpaKembali={!!terpilih&&adaHargaTipe}>{error&&<p role="alert">{error}</p>}{hargaTipe.error&&<p role="alert">{hargaTipe.error}</p>}{adaHargaTipe?(terpilih?<><button type="button" className="ph-kembali-tipe" onClick={()=>setTipe(null)}><ArrowLeft/>Kembali</button><section className="ph-kelompok"><div className="ph-judul"><h2>{terpilih.label} Room</h2><span className="ph-jumlah">{terpilih.baris.length} paket</span><span className="ph-judul-garis"/></div><TabelKelompok baris={terpilih.baris} onUbah={edit}/></section>{riwayatTipe}</>:<><div className="ph-pilihan">{kelompok.map(k=><button key={k.label} type="button" className="ph-kartu-tipe" onClick={()=>setTipe(k.label)}><h2>{k.label} Room</h2><span className="ph-kartu-jumlah">{k.baris.length} paket tersedia</span><ChevronRight/></button>)}</div></>):(hargaTipe.loading?null:<><section className="ph-kelompok"><div className="ph-judul"><h2>Semua Tipe Kamar</h2><span className="ph-jumlah">{rows.length} paket</span><span className="ph-judul-garis"/></div><TabelKelompok baris={rows.slice().sort((a,b)=>urutanPaket(a.name)-urutanPaket(b.name)).map(p=>({harga:{id:p.id,weekday_price:Number(p.weekday_price),weekend_price:Number(p.weekend_price)} as PackageRoomTypePrice,paket:p}))} onUbah={edit}/></section></>)}{open&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/75 backdrop-blur-sm p-4"><form onSubmit={save} role="dialog" aria-modal="true" aria-label={item?'Ubah paket':'Tambah paket'} className="w-full max-w-md max-h-[90dvh] overflow-y-auto space-y-3 rounded-2xl bg-background p-5 shadow-lembut"><h2 className="text-lg font-bold">{item?'Ubah paket':'Tambah paket'}</h2><label className="block text-sm">Tipe Kamar<div className="relative mt-1"><input readOnly value={tipeForm??'Semua tipe kamar'} className="h-11 w-full rounded-xl border border-input bg-muted pl-3 pr-10"/><Lock className="absolute right-3 top-3 size-5 text-primary"/></div></label><label className="block text-sm">Nama paket
 {item
  ? <input value={nama} readOnly className="mt-1 h-11 w-full rounded-xl border border-input bg-muted px-3"/>
  : <select value={nama} onChange={e=>pilihPaketResmi(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3">
     <option value="">Pilih paket</option>{PAKET_RESMI.map(p=><option key={p.name} value={p.name} disabled={rows.some(existing=>existing.name===p.name)}>{p.name}{rows.some(existing=>existing.name===p.name)?' — sudah tersedia':''}</option>)}
     </select>}
</label>
<label className="block text-sm">Durasi
 <input value={durasi?`${durasi} menit`:'—'} readOnly className="mt-1 h-11 w-full rounded-xl border border-input bg-muted px-3"/>
</label>
<fieldset><legend className="text-sm">Jam Berlaku</legend><div className="mt-1 grid grid-cols-2 gap-3">{([['mulai','Jam Mulai'],['selesai','Jam Selesai']] as const).map(([key,label])=>{
 const nilai=jamPaket(item??rows.find(p=>p.name===nama)??null)[key];
 const opsi=[...new Set([...pilihanJam,...(nilai?[nilai]:[])])].sort();
 return <label key={key} className="block text-sm">{label}<select aria-label={label} value={nilai} disabled className="mt-1 h-11 w-full rounded-xl border border-input bg-muted px-3"><option value="">—</option>{opsi.map(j=><option key={j} value={j}>{teksJamWib(j)}</option>)}</select></label>;
 })}</div></fieldset>
{[['Harga Weekday',hargaWeekday,setHargaWeekday],['Harga Weekend',hargaWeekend,setHargaWeekend]].map(([label,value,setter])=><label key={label as string} className="block text-sm">{label as string}<input required type="number" min="0" value={value as string} onChange={e=>(setter as (s:string)=>void)(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3"/></label>)}{item&&(Number(hargaItem?.weekday_price??item.weekday_price)!==Number(hargaWeekday)||Number(hargaItem?.weekend_price??item.weekend_price)!==Number(hargaWeekend))&&<label className="block text-sm">Alasan perubahan harga<input required value={alasan} onChange={e=>setAlasan(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3"/></label>}<label className="flex gap-2 text-sm"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/>Aktif</label>{groupeForm&&<p className="text-sm text-muted-foreground">Penyimpanan paket khusus tipe kamar belum tersedia. Tidak ada data yang diubah.</p>}{!item&&PAKET_RESMI.every(p=>rows.some(r=>r.name===p.name))&&<p className="text-sm text-muted-foreground">Semua 9 paket resmi sudah tersedia; paket yang sama tidak dapat ditambahkan kembali.</p>}{message&&<p role="alert" className="text-sm text-destructive">{message}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Batal</Button><Button disabled={!!groupeForm||!nama}>Simpan</Button></div></form></div>}</SubPengaturan></Kerangka>}