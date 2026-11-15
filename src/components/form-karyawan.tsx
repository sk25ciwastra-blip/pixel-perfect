import { useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { UserRound, Mail, Layers, Lock, Info, IdCard, MapPin, CalendarDays, Phone, Users, Link2, Home, Camera, Upload, ShieldCheck, Save, Contact } from 'lucide-react';
import '@/components/form-karyawan.css';
import { supabase } from '@/integrations/supabase/client';
import { createEmployee, manageEmployee } from '@/lib/employee.functions';
import type { Employee } from '@/lib/data-live';

type Posisi = 'receptionist' | 'housekeeping' | 'supervisor' | 'inspector' | 'investor';
const posisiOpsi: [Posisi, string][] = [['receptionist', 'Receptionist'], ['housekeeping', 'Housekeeping'], ['supervisor', 'Supervisor'], ['inspector', 'Inspector'], ['investor', 'Investor']];
const kosong = { nik: '', birth_place: '', birth_date: '', gender: '', phone: '', address: '', emergency_name: '', emergency_relation: '', emergency_phone: '' };

function sandiAcak() {
  const huruf = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const a = new Uint32Array(10); crypto.getRandomValues(a);
  return Array.from(a, n => huruf[n % huruf.length]).join('');
}

export function FormKaryawan({ item, posisiAwal, semua, onSelesai }: { item: Employee | null; posisiAwal: Posisi; semua: Employee[]; onSelesai: (simpan: boolean) => void }) {
  const create = useServerFn(createEmployee); const manage = useServerFn(manageEmployee);
  const [name, setName] = useState(item?.name ?? ''); const [email, setEmail] = useState('');
  const [position, setPosition] = useState<Posisi>(item?.position ?? posisiAwal);
  const [active, setActive] = useState(item?.active ?? true);
  const [password, setPassword] = useState(item ? '' : sandiAcak());
  const [p, setP] = useState(kosong);
  const [foto, setFoto] = useState<File | null>(null); const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const tahun = new Date().toLocaleString('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric' });
  const idPratinjau = item?.employee_id ?? `KR-${tahun}-${String(Math.max(0, ...semua.filter(k => k.employee_id.startsWith(`KR-${tahun}-`)).map(k => Number(k.employee_id.split('-')[2]) || 0)) + 1).padStart(4, '0')}`;

  useEffect(() => {
    if (!item) return;
    supabase.from('employee_profiles').select('*').eq('employee_id', item.id).maybeSingle().then(async ({ data }) => {
      if (!data) return;
      setP({ nik: data.nik, birth_place: data.birth_place, birth_date: data.birth_date ?? '', gender: data.gender, phone: data.phone, address: data.address, emergency_name: data.emergency_name, emergency_relation: data.emergency_relation, emergency_phone: data.emergency_phone });
      if (data.photo_path) { const { data: s } = await supabase.storage.from('employee-photos').createSignedUrl(data.photo_path, 3600); setFotoUrl(s?.signedUrl ?? null); }
    });
  }, [item]);

  const ubah = (k: keyof typeof kosong) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setP(v => ({ ...v, [k]: e.target.value }));
  function pilihFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > 2 * 1024 * 1024) { setMessage('Foto harus JPG, PNG, atau WebP dengan ukuran maksimal 2 MB.'); return; }
    setFoto(f); setFotoUrl(URL.createObjectURL(f)); setMessage('');
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{16}$/.test(p.nik)) { setMessage('NIK harus 16 digit angka.'); return; }
    setBusy(true); setMessage('');
    try {
      let id = item?.id;
      if (item) await manage({ data: { id: item.id, name, position, active, ...(password ? { password } : {}) } });
      else id = (await create({ data: { name, email, password, position, active } })).id;
      let photo_path: string | undefined;
      if (foto && id) {
        photo_path = `${id}.${foto.type.split('/')[1]}`;
        const { error } = await supabase.storage.from('employee-photos').upload(photo_path, foto, { upsert: true, contentType: foto.type });
        if (error) throw new Error('Akun tersimpan, tetapi pas foto gagal diunggah.');
      }
      const { error } = await supabase.from('employee_profiles').upsert({ employee_id: id!, ...p, birth_date: p.birth_date || null, ...(photo_path ? { photo_path } : {}) });
      if (error) throw new Error('Akun tersimpan, tetapi data identitas gagal disimpan.');
      onSelesai(true);
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Tidak dapat menyimpan karyawan.'); } finally { setBusy(false); }
  }

  const wajib = <span className="fk-wajib">*</span>;
  return <form onSubmit={save} className="fk" aria-label={item ? 'Ubah data karyawan' : 'Pendaftaran karyawan baru'}>
    <div className="fk-grid">
      <div className="fk-kolom">
        <section className="fk-panel">
          <header className="fk-kepala"><span className="fk-ikon"><UserRound /></span><div><h3>Data Akun & Akses</h3><p>Informasi akun, posisi, dan akses sistem karyawan.</p></div></header>
          <div className="fk-baris2">
            <label className="fk-field"><span>Nama Lengkap {wajib}</span><div className="fk-input"><UserRound /><input required placeholder="Masukkan nama lengkap" value={name} onChange={e => setName(e.target.value)} /></div></label>
            <label className="fk-field"><span>Posisi {wajib}</span><div className="fk-input"><Layers /><select value={position} onChange={e => setPosition(e.target.value as Posisi)}>{posisiOpsi.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div></label>
            {item ? <div className="fk-field"><span>Email</span><div className="fk-input fk-kunci"><Mail /><input disabled value="Tersimpan pada akun" /></div></div>
              : <label className="fk-field"><span>Email {wajib}</span><div className="fk-input"><Mail /><input required type="email" placeholder="contoh: nama@baturaden25.com" value={email} onChange={e => setEmail(e.target.value)} /></div></label>}
            <div className="fk-field"><span>Status Akun {wajib}</span><div className="fk-status" role="radiogroup">
              <button type="button" role="radio" aria-checked={active} className={active ? 'aktif' : ''} onClick={() => setActive(true)}><i />Aktif</button>
              <button type="button" role="radio" aria-checked={!active} className={!active ? 'aktif' : ''} onClick={() => setActive(false)}><i />Tidak Aktif</button>
            </div></div>
            <div className="fk-field"><span>ID Karyawan <Info className="fk-info" /></span><div className="fk-input fk-kunci"><Lock /><input readOnly value={idPratinjau} aria-label="ID Karyawan" /><em>Otomatis</em></div><small>Dibuat otomatis oleh sistem dan tidak dapat diubah.</small></div>
            <div className="fk-field"><span>{item ? 'Atur Ulang Kata Sandi' : 'Kata Sandi Awal'} <Info className="fk-info" /></span><div className="fk-input fk-kunci"><Lock /><input readOnly value={password || '—'} aria-label="Kata Sandi Awal" />{item ? <button type="button" className="fk-buat" onClick={() => setPassword(password ? '' : sandiAcak())}>{password ? 'Batal' : 'Buat Baru'}</button> : <em>Otomatis</em>}</div><small>{item ? 'Kosongkan bila kata sandi tidak diubah.' : 'Dibuat otomatis oleh sistem.'}</small>
              <p className="fk-catatan"><Info />Karyawan hanya dapat mengubah password sendiri melalui Pengaturan.</p></div>
          </div>
        </section>
        <section className="fk-panel">
          <header className="fk-kepala"><span className="fk-ikon"><Contact /></span><div><h3>Data Identitas Pribadi</h3><p>Data diri karyawan untuk keperluan administrasi internal.</p></div></header>
          <p className="fk-catatan fk-lebar"><Info />NIK bersifat pribadi dan hanya digunakan untuk keperluan administrasi oleh Owner / pihak berwenang.</p>
          <div className="fk-baris3">
            <label className="fk-field"><span>NIK (16 digit) {wajib}</span><div className="fk-input"><IdCard /><input required inputMode="numeric" maxLength={16} placeholder="Masukkan 16 digit NIK" value={p.nik} onChange={e => setP(v => ({ ...v, nik: e.target.value.replace(/\D/g, '') }))} /></div></label>
            <label className="fk-field"><span>Tempat Lahir {wajib}</span><div className="fk-input"><MapPin /><input required placeholder="Masukkan tempat lahir" value={p.birth_place} onChange={ubah('birth_place')} /></div></label>
            <label className="fk-field"><span>Tanggal Lahir {wajib}</span><div className="fk-input"><CalendarDays /><input required type="date" value={p.birth_date} onChange={ubah('birth_date')} /></div></label>
          </div>
          <div className="fk-baris2 fk-rapat">
            <label className="fk-field"><span>Jenis Kelamin {wajib}</span><div className="fk-input"><Users /><select required value={p.gender} onChange={ubah('gender')}><option value="" disabled>Pilih jenis kelamin</option><option>Laki-laki</option><option>Perempuan</option></select></div></label>
            <label className="fk-field"><span>Nomor HP {wajib}</span><div className="fk-input"><Phone /><input required type="tel" inputMode="tel" placeholder="contoh: 0812 3456 7890" value={p.phone} onChange={ubah('phone')} /></div></label>
          </div>
          <label className="fk-field fk-rapat"><span>Alamat Lengkap {wajib}</span><div className="fk-input fk-area"><Home /><textarea required rows={3} placeholder="Masukkan alamat lengkap (jalan, nomor, RT/RW, kelurahan, kecamatan, kota/kabupaten)" value={p.address} onChange={ubah('address')} /></div></label>
        </section>
        <section className="fk-panel">
          <header className="fk-kepala"><span className="fk-ikon"><Users /></span><div><h3>Kontak Darurat</h3><p>Informasi yang dapat dihubungi dalam keadaan darurat.</p></div></header>
          <div className="fk-baris3">
            <label className="fk-field"><span>Nama Kontak Darurat {wajib}</span><div className="fk-input"><UserRound /><input required placeholder="Masukkan nama kontak darurat" value={p.emergency_name} onChange={ubah('emergency_name')} /></div></label>
            <label className="fk-field"><span>Hubungan {wajib}</span><div className="fk-input"><Link2 /><select required value={p.emergency_relation} onChange={ubah('emergency_relation')}><option value="" disabled>Pilih hubungan</option>{['Orang Tua', 'Suami/Istri', 'Saudara Kandung', 'Anak', 'Kerabat', 'Lainnya'].map(h => <option key={h}>{h}</option>)}</select></div></label>
            <label className="fk-field"><span>Nomor HP Kontak Darurat {wajib}</span><div className="fk-input"><Phone /><input required type="tel" inputMode="tel" placeholder="contoh: 0812 3456 7890" value={p.emergency_phone} onChange={ubah('emergency_phone')} /></div></label>
          </div>
        </section>
      </div>
      <div className="fk-kolom">
        <section className="fk-panel">
          <header className="fk-kepala"><span className="fk-ikon"><Camera /></span><div><h3>Pas Foto Wajah</h3><p>Unggah pas foto wajah karyawan.</p></div></header>
          <div className="fk-foto">
            <div className="fk-avatar">{fotoUrl ? <img src={fotoUrl} alt="Pas foto karyawan" /> : <UserRound />}</div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pilihFoto} />
            <button type="button" className="fk-unggah" onClick={() => fileRef.current?.click()}><Upload />Unggah Foto</button>
            <small>JPG, PNG, WebP; maksimal 2 MB.</small>
            <p className="fk-catatan"><Info />Hanya pas foto wajah, bukan foto KTP.</p>
          </div>
        </section>
        <section className="fk-panel">
          <header className="fk-kepala"><span className="fk-ikon"><ShieldCheck /></span><div><h3>Ringkasan & Kebijakan</h3><p>Ketentuan penting terkait data karyawan.</p></div></header>
          <ul className="fk-kebijakan">
            <li>Data pribadi hanya untuk Owner / pihak berwenang.</li>
            <li>ID karyawan dibuat otomatis oleh sistem.</li>
            <li>Password awal dibuat otomatis oleh sistem.</li>
            <li>Karyawan hanya dapat mengubah password di Pengaturan.</li>
            <li>NIK dan kontak darurat tidak tampil di menu umum.</li>
            <li>Tidak memerlukan foto KTP.</li>
          </ul>
        </section>
      </div>
    </div>
    {message && <p role="alert" className="fk-pesan">{message}</p>}
    {!item && <p className="fk-ingat">Catat kata sandi awal di atas dan berikan kepada karyawan; kata sandi tidak ditampilkan lagi setelah disimpan.</p>}
    <footer className="fk-kaki"><button type="button" className="fk-batal" onClick={() => onSelesai(false)}>Batal</button><button className="fk-simpan" disabled={busy}><Save />{busy ? 'Menyimpan…' : 'Simpan Karyawan'}</button></footer>
  </form>;
}
