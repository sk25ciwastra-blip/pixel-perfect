import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Plus, X, Users, CircleCheck, GraduationCap, CirclePause, List, ShieldCheck, History, Search, Eye, Pencil, UserRound, Brush, Crown } from 'lucide-react';
import { Kerangka } from '@/components/kerangka';
import { TombolHapusDemo } from '@/components/hapus-data-demo';
import { Button } from '@/components/ui/button';
import { useTable, type Employee } from '@/lib/data-live';
import { FormKaryawan } from '@/components/form-karyawan';
import { DetailKaryawan } from '@/components/detail-karyawan';
import { meta } from '@/lib/meta';
import '@/components/tim-akses.css';
type Posisi='receptionist'|'housekeeping'|'supervisor'|'inspector'|'investor';
const daftarPosisi:Posisi[]=['receptionist','housekeeping','supervisor','inspector','investor'];
const labelPosisi:Record<Posisi,string>={receptionist:'Receptionist',housekeeping:'Housekeeping',supervisor:'Supervisor',inspector:'Inspector',investor:'Investor'};
export const Route=createFileRoute('/karyawan')({validateSearch:(s:Record<string,unknown>):{bagian?:Posisi|undefined}=>({bagian:daftarPosisi.includes(s['bagian'] as Posisi)?s['bagian'] as Posisi:undefined}),head:()=>meta('Tim & Akses','Daftar tim dan akses per posisi Baturaden 25 Homestay.'),component:Halaman});
function Halaman(){const {bagian}=Route.useSearch();const semua=useTable('employees');const [tab,setTab]=useState<'daftar'|'akses'|'riwayat'>('daftar');const logKaryawan=useTable('activity_logs',tab==='riwayat');const {refresh,error}=semua;const rows=semua.rows.filter(k=>!k.deleted_at&&(!bagian||k.position===bagian));const [item,setItem]=useState<Employee|null>(null);const [open,setOpen]=useState(false);
 const [detail,setDetail]=useState<Employee|null>(null);const [cari,setCari]=useState('');const [status,setStatus]=useState('semua');const [posisi,setPosisi]=useState('semua');const [urutan,setUrutan]=useState('terbaru');
 const hasil=rows.filter(k=>`${k.name} ${k.employee_id} ${labelPosisi[k.position]}`.toLocaleLowerCase('id-ID').includes(cari.toLocaleLowerCase('id-ID'))&&(status==='semua'||k.active===(status==='aktif'))&&(posisi==='semua'||k.position===posisi)).sort((a,b)=>urutan==='nama'?a.name.localeCompare(b.name,'id'):urutan==='terlama'?a.created_at.localeCompare(b.created_at):b.created_at.localeCompare(a.created_at));
 const tanggal=(iso:string)=>new Date(iso).toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'short',year:'numeric'});
 function edit(k?:Employee){setItem(k??null);setOpen(true)}
 function tutup(){setOpen(false)}
 return <Kerangka judul={bagian?`Tim & Akses · ${labelPosisi[bagian]}`:'Tim & Akses'} keterangan="Kelola data karyawan, peran, dan hak akses operasional.">
 {error&&<p role="alert">{error}</p>}
 <div className="ta-halaman">
 <div className="ta-ringkasan">
 <section className="ta-kpi"><Users/><div><p>Total Karyawan</p><strong>{semua.loading?'—':rows.length}<span>Orang</span></strong></div></section>
 <section className="ta-kpi" data-ton="hijau"><CircleCheck/><div><p>Akun Aktif</p><strong>{semua.loading?'—':rows.filter(k=>k.active).length}<span>Orang</span></strong></div></section>
 <section className="ta-kpi"><GraduationCap/><div><p>Pelatihan</p><strong title="Status pelatihan seluruh tim belum tersedia pada daftar ini">—</strong></div></section>
 <section className="ta-kpi" data-ton="merah"><CirclePause/><div><p>Nonaktif</p><strong>{semua.loading?'—':rows.filter(k=>!k.active).length}<span>Orang</span></strong></div></section>
 </div>
 <section className="ta-isi">
 <div className="ta-toolbar"><div className="ta-tabs" role="tablist" aria-label="Tim dan akses">
 <Button role="tab" aria-selected={tab==='daftar'} variant={tab==='daftar'?'default':'outline'} onClick={()=>setTab('daftar')}><List/>Daftar Karyawan</Button>
 <Button role="tab" aria-selected={tab==='akses'} variant={tab==='akses'?'default':'outline'} onClick={()=>setTab('akses')}><ShieldCheck/>Hak Akses</Button>
 <Button role="tab" aria-selected={tab==='riwayat'} variant={tab==='riwayat'?'default':'outline'} onClick={()=>setTab('riwayat')}><History/>Riwayat Perubahan</Button>
 </div>{tab==='daftar'&&<Button className="ta-ajouter" onClick={()=>edit()}><Plus/>Tambah Karyawan</Button>}</div>
 {tab==='daftar'&&<><div className="ta-filtres"><label className="ta-recherche"><Search/><input aria-label="Cari karyawan" placeholder="Cari nama, ID karyawan, atau jabatan..." value={cari} onChange={e=>setCari(e.target.value)}/></label><select aria-label="Status karyawan" value={status} onChange={e=>setStatus(e.target.value)}><option value="semua">Semua Status</option><option value="aktif">Aktif</option><option value="nonaktif">Nonaktif</option></select><select aria-label="Peran karyawan" value={posisi} onChange={e=>setPosisi(e.target.value)}><option value="semua">Semua Peran</option>{daftarPosisi.map(p=><option key={p} value={p}>{labelPosisi[p]}</option>)}</select><select aria-label="Urutan karyawan" value={urutan} onChange={e=>setUrutan(e.target.value)}><option value="terbaru">Terbaru</option><option value="terlama">Terlama</option><option value="nama">Nama A–Z</option></select></div>
 <div className="ta-table-scroll"><table className="ta-table"><thead><tr>{['No.','ID Karyawan','Nama Karyawan','Peran / Jabatan','Status','Tanggal Bergabung','Aksi'].map(t=><th key={t}>{t}</th>)}</tr></thead><tbody>{hasil.map((k,i)=><tr key={k.id}><td>{i+1}</td><td><span className="ta-id">{k.employee_id}</span></td><td><span className="ta-nom"><span className="ta-avatar">{k.name.slice(0,1)}</span>{k.name}</span></td><td><span className="ta-role">{k.position==='housekeeping'?<Brush/>:k.position==='supervisor'?<Crown/>:<UserRound/>}{labelPosisi[k.position]}</span></td><td><span className="ta-status" data-actif={k.active}><i/>{k.active?'Aktif':'Nonaktif'}</span></td><td>{tanggal(k.created_at)}</td><td><div className="ta-actions"><Button variant="outline" size="sm" onClick={()=>setDetail(k)}><Eye/>Detail</Button><Button variant="outline" size="sm" onClick={()=>edit(k)}><Pencil/>Ubah</Button><TombolHapusDemo kind="employee" id={k.id} code={k.employee_id} name={k.name} onDeleted={()=>{setDetail(current=>current?.id===k.id?null:current);void refresh()}} /></div></td></tr>)}</tbody></table></div>
 {semua.loading&&<p className="ta-vide">Memuat anggota tim…</p>}{!semua.loading&&!hasil.length&&<p className="ta-vide">Tidak ada anggota tim yang sesuai.</p>}</>}
 {tab==='akses'&&<div className="ta-table-scroll">
  <p className="p-4 text-sm text-muted-foreground">Ringkasan akses halaman sesuai jabatan. Hak menyimpan pembayaran, sesi kas, dan perubahan data tetap divalidasi di server. Pengaturan bisnis hanya Owner.</p>
  <table className="ta-table"><thead><tr><th>Jabatan</th><th>Halaman yang dapat dibuka</th><th>Pengaturan</th></tr></thead>
  <tbody>{([
    ['Receptionist','Dashboard, Kamar, Booking, Check-in, Transaksi, Tamu, Keuangan, Laporan'],
    ['Supervisor','Dashboard, Kamar, Booking, Check-in, Transaksi, Tamu, Housekeeping, Keuangan, Laporan'],
    ['Housekeeping','Dashboard, Kamar, Housekeeping'],
    ['Inspector','Dashboard, Kamar, Booking, Transaksi, Tamu, Housekeeping'],
    ['Investor','Dashboard, Kamar'],
  ] as const).map(([role,pages])=><tr key={role}><td><strong>{role}</strong></td><td>{pages}</td><td>Akun &amp; Keamanan pribadi</td></tr>)}</tbody></table>
  <p className="p-4 text-xs text-muted-foreground">Tidak ada tombol ubah permission langsung di sini; perubahan jabatan dan izin backend memerlukan alur resmi Owner.</p>
 </div>}
 {tab==='riwayat'&&<div className="ta-table-scroll">
  <p className="p-4 text-sm text-muted-foreground">Riwayat aktivitas karyawan yang telah tercatat oleh sistem. Data lama yang tidak pernah diaudit tidak direkonstruksi.</p>
  {logKaryawan.error&&<p role="alert" className="p-4 text-sm text-destructive">{logKaryawan.error}</p>}
  {logKaryawan.loading?<p className="ta-vide">Memuat riwayat…</p>:
    <table className="ta-table"><thead><tr><th>Waktu WIB</th><th>Karyawan</th><th>Tindakan</th></tr></thead><tbody>
    {logKaryawan.rows.filter(x=>x.entity_type==='employees').slice().sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,100)
      .map(log=><tr key={log.id}><td>{new Date(log.created_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',dateStyle:'medium',timeStyle:'short'})}</td>
      <td>{semua.rows.find(k=>k.id===log.entity_id)?.employee_id??'Data karyawan lama'}</td><td>{log.action==='buat'?'Pendaftaran':log.action==='ubah'?'Perubahan data':log.action}</td></tr>)}
    </tbody></table>}
  {!logKaryawan.loading&&!logKaryawan.rows.some(x=>x.entity_type==='employees')&&<p className="ta-vide">Belum ada riwayat karyawan yang tercatat.</p>}
 </div>}
 </section></div>
 {detail&&<DetailKaryawan key={detail.id} item={detail} posisi={labelPosisi[detail.position]} onClose={()=>setDetail(null)}/>}
 {open&&<div className="fk-modal" onMouseDown={e=>{if(e.target===e.currentTarget)tutup()}}><section className="fk-modal-panel" role="dialog" aria-modal="true" aria-labelledby="fk-modal-judul"><header className="fk-modal-kepala"><div><h2 id="fk-modal-judul">{item?'Ubah Data Karyawan':'Pendaftaran Karyawan Baru'}</h2><p>{item?'Perbarui data anggota tim dan akses sistemnya.':'Tambah anggota tim baru dan atur akses sistemnya.'}</p></div><Button type="button" variant="ghost" size="icon" aria-label="Tutup" onClick={tutup}><X className="size-4"/></Button></header><div className="fk-modal-isi"><FormKaryawan key={item?.id??'baru'} item={item} posisiAwal={bagian??'receptionist'} semua={semua.rows} onSelesai={async s=>{setOpen(false);if(s)await refresh()}}/></div></section></div>}</Kerangka>}
