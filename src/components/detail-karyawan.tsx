import { useQuery } from '@tanstack/react-query';
import { UserRound, IdCard, Lock, Mail, Layers, MapPin, CalendarDays, Users, Home, Phone, Camera, ShieldCheck, Clock, BriefcaseBusiness, Info, GraduationCap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import type { Employee } from '@/lib/data-live';
import '@/components/detail-karyawan.css';

function Panel({ titre, sousTitre, icon: Icon, children, className = '' }: { titre: string; sousTitre: string; icon: LucideIcon; children: ReactNode; className?: string }) {
  return <section className={`dk-panel ${className}`}><header><span className="dk-medali"><Icon /></span><div><h3>{titre}</h3><p>{sousTitre}</p></div></header>{children}</section>;
}
function Champ({ label, value, icon: Icon, auto = false, large = false }: { label: string; value?: string | null | undefined; icon: LucideIcon; auto?: boolean; large?: boolean }) {
  return <div className={`dk-champ ${large ? 'dk-large' : ''}`}><span>{label}</span><div className="dk-valeur"><Icon /><span>{value || '—'}</span>{auto && <em>Otomatis</em>}</div></div>;
}
const date = (value?: string | null) => value ? new Date(value).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export function DetailKaryawan({ item, posisi, onClose }: { item: Employee; posisi: string; onClose: () => void }) {
  const profil = useQuery({ queryKey: ['detail-profil-karyawan', item.id], queryFn: async () => {
    const { data, error } = await supabase.from('employee_profiles').select('*').eq('employee_id', item.id).maybeSingle();
    if (error) throw new Error('Data profil tidak dapat dibaca dengan akses saat ini.');
    let photoUrl: string | null = null;
    if (data?.photo_path) { const result = await supabase.storage.from('employee-photos').createSignedUrl(data.photo_path, 300); photoUrl = result.data?.signedUrl ?? null; }
    return { data, photoUrl };
  }});
  const p = profil.data?.data;
  return <div className="fk-modal" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="dk-popup" role="dialog" aria-modal="true" aria-label={`Detail Karyawan · ${item.name}`}>
    {profil.isPending && <p className="dk-erreur" role="status">Memuat profil karyawan…</p>}{profil.error && <p className="dk-erreur" role="alert">{profil.error.message}</p>}
    <div className="dk-isi"><div className="dk-kolom">
      <Panel titre="Data Akun & Akses" sousTitre="Informasi akun, posisi, dan akses sistem karyawan." icon={UserRound}><div className="dk-champs">
        <Champ label="ID Karyawan" value={item.employee_id} icon={Lock} auto /><div className="dk-champ"><span>Status Akun</span><div className="dk-valeur"><UserRound /><strong className="dk-etat" data-actif={item.active}><i />{item.active ? 'Aktif' : 'Tidak Aktif'}</strong></div></div>
        <Champ label="Email" icon={Mail} /><Champ label="Kata Sandi Akun" value="Tidak ditampilkan" icon={Lock} />
        <Champ label="Peran / Jabatan" value={posisi} icon={Layers} /><p className="dk-note"><Info />Karyawan hanya dapat mengubah kata sandi sendiri melalui Pengaturan.</p>
      </div></Panel>
      <Panel titre="Data Identitas Pribadi" sousTitre="Data diri karyawan untuk keperluan administrasi internal." icon={IdCard}><div className="dk-champs dk-trois">
        <Champ label="NIK (16 digit)" value={p?.nik} icon={IdCard} /><Champ label="Tempat Lahir" value={p?.birth_place} icon={MapPin} /><Champ label="Tanggal Lahir" value={date(p?.birth_date)} icon={CalendarDays} />
        <Champ label="Jenis Kelamin" value={p?.gender} icon={Users} /><Champ label="Status Pernikahan" icon={Users} /><Champ label="Agama" icon={Home} /><Champ label="Alamat Lengkap" value={p?.address} icon={Home} large />
      </div></Panel>
      <Panel titre="Kontak & Komunikasi" sousTitre="Informasi yang dapat dihubungi dalam keperluan operasional." icon={Phone}><div className="dk-champs dk-trois"><Champ label="Nomor HP / WhatsApp" value={p?.phone} icon={Phone} /><Champ label="Email (Pribadi)" icon={Mail} /><Champ label="Kontak Darurat" value={p?.emergency_name ? `${p.emergency_name}${p.emergency_relation ? ` (${p.emergency_relation})` : ''}` : null} icon={Users} />{p?.emergency_phone && <Champ label="Nomor Kontak Darurat" value={p.emergency_phone} icon={Phone} large />}</div></Panel>
      <Panel titre="Informasi Kepegawaian" sousTitre="Informasi terkait kepegawaian, masa kerja, dan catatan internal." icon={BriefcaseBusiness}><div className="dk-champs dk-trois"><Champ label="Tanggal Bergabung" value={date(item.created_at)} icon={CalendarDays} /><Champ label="Tanggal Nonaktif" icon={CalendarDays} /><Champ label="Tanggal Berhenti" icon={CalendarDays} /><Champ label="Catatan / Keterangan" icon={Info} large /></div></Panel>
    </div><div className="dk-kolom">
      <Panel titre="Pas Foto Wajah" sousTitre="Foto resmi karyawan untuk keperluan sistem." icon={Camera}><div className="dk-foto"><div className="dk-portrait">{profil.data?.photoUrl ? <img src={profil.data.photoUrl} alt={`Pas foto ${item.name}`} /> : <UserRound aria-label="Foto belum tersedia" />}</div><div className="dk-photo-info"><strong>{item.name}</strong><p>{profil.data?.photoUrl ? 'Pas foto tersimpan' : 'Foto belum tersedia'}</p><p>JPG, PNG, WebP<br />Maks. 2 MB.</p><p className="dk-note"><Info />Foto resmi, rapi, dan berpakaian sopan.</p></div></div></Panel>
      <Panel titre="Ringkasan & Akses" sousTitre="Rangkuman peran, hak akses, dan status karyawan." icon={ShieldCheck}><div className="dk-recap">{[[Layers,'Peran / Jabatan',posisi],[BriefcaseBusiness,'Status Operasional','—'],[ShieldCheck,'Akses Sistem','—'],[GraduationCap,'Status Pelatihan','—']].map(([Icon, label, value]) => { const I = Icon as LucideIcon; return <div key={String(label)}><I /><span>{String(label)}</span><span>:</span><strong>{String(value)}</strong></div>; })}</div></Panel>
      <Panel titre="Riwayat Status Karyawan" sousTitre="Catatan perubahan status dan masa kerja." icon={Clock} className="dk-historique"><div className="dk-evenement"><strong>Bergabung</strong> — {date(item.created_at)}<p>Akun karyawan tercatat pada sistem.</p></div><p className="dk-note"><Info />Riwayat perubahan status belum tersedia.</p></Panel>
    </div></div><footer className="dk-kaki"><Button variant="outline" aria-label="Tutup detail karyawan" onClick={onClose}>Tutup</Button></footer>
  </section></div>;
}