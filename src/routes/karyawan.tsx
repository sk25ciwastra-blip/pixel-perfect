import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Kerangka, Daftar } from '@/components/kerangka';
import { Button } from '@/components/ui/button';
import { LencanaTeks } from '@/components/status-kamar';
import { useTable, type Employee } from '@/lib/data-live';
import { FormKaryawan } from '@/components/form-karyawan';
import { meta } from '@/lib/meta';
type Posisi='receptionist'|'housekeeping'|'supervisor'|'inspector'|'investor';
const daftarPosisi:Posisi[]=['receptionist','housekeeping','supervisor','inspector','investor'];
const labelPosisi:Record<Posisi,string>={receptionist:'Receptionist',housekeeping:'Housekeeping',supervisor:'Supervisor',inspector:'Inspector',investor:'Investor'};
export const Route=createFileRoute('/karyawan')({validateSearch:(s:Record<string,unknown>):{bagian?:Posisi|undefined}=>({bagian:daftarPosisi.includes(s['bagian'] as Posisi)?s['bagian'] as Posisi:undefined}),head:()=>meta('Tim & Akses','Daftar tim dan akses per posisi Baturaden 25 Homestay.'),component:Halaman});
function Halaman(){const {bagian}=Route.useSearch();const semua=useTable('employees');const {refresh,error}=semua;const rows=bagian?semua.rows.filter(k=>k.position===bagian):semua.rows;const [item,setItem]=useState<Employee|null>(null);const [open,setOpen]=useState(false);
 function edit(k?:Employee){setItem(k??null);setOpen(true)}
 function tutup(){setOpen(false)}
 return <Kerangka judul={bagian?`Tim & Akses · ${labelPosisi[bagian]}`:'Tim & Akses'} keterangan={`${rows.length} anggota tim${bagian?` berposisi ${labelPosisi[bagian]}`:''}`} aksi={<Button className="h-11 rounded-xl" onClick={()=>edit()}><Plus/>Tambah</Button>}>{error&&<p role="alert">{error}</p>}{!semua.loading&&!rows.length&&<p className="mb-4 text-sm text-muted-foreground">Belum ada anggota tim pada posisi ini.</p>}<Daftar>{rows.map(k=><li key={k.id} className="flex items-center gap-3 px-4 py-3.5"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary">{k.name[0]}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{k.name}</p><p className="text-xs text-muted-foreground">{k.employee_id} · {k.position==='receptionist'?'Resepsionis':k.position==='housekeeping'?'Petugas Kebersihan':k.position==='supervisor'?'Supervisor':k.position==='inspector'?'Inspector':'Investor'}</p></div><LencanaTeks status={k.active?'Aktif':'Tidak Aktif'}/><Button size="sm" variant="outline" onClick={()=>edit(k)}>Ubah</Button></li>)}</Daftar>{open&&<div className="fk-modal" onMouseDown={e=>{if(e.target===e.currentTarget)tutup()}}><section className="fk-modal-panel" role="dialog" aria-modal="true" aria-labelledby="fk-modal-judul"><header className="fk-modal-kepala"><div><h2 id="fk-modal-judul">{item?'Ubah Data Karyawan':'Pendaftaran Karyawan Baru'}</h2><p>{item?'Perbarui data anggota tim dan akses sistemnya.':'Tambah anggota tim baru dan atur akses sistemnya.'}</p></div><Button type="button" variant="ghost" size="icon" aria-label="Tutup" onClick={tutup}><X className="size-4"/></Button></header><div className="fk-modal-isi"><FormKaryawan key={item?.id??'baru'} item={item} posisiAwal={bagian??'receptionist'} semua={semua.rows} onSelesai={async s=>{setOpen(false);if(s)await refresh()}}/></div></section></div>}</Kerangka>}
