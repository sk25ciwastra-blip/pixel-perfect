import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState, type FormEvent } from 'react';
import { Building2 } from 'lucide-react';
import { Kerangka } from '@/components/kerangka';
import { SubPengaturan } from '@/components/pengaturan-sub';
import { Button } from '@/components/ui/button';
import { rpc } from '@/lib/data-live';
import { usePeran } from '@/lib/peran';
import { meta } from '@/lib/meta';

export const Route = createFileRoute('/pengaturan-profil-homestay')({
  head: () => meta('Profil Homestay', 'Profil resmi Baturaden 25 Homestay.'),
  component: HalamanProfilHomestay,
});

type Profil = {
  business_name: string;
  address: string;
  phone: string;
  whatsapp: string;
  updated_at: string;
};

const field = 'mt-1 block h-11 w-full rounded-lg border border-input bg-background/70 px-3 text-sm';

function HalamanProfilHomestay() {
  const { posisiKode, siap, training } = usePeran();
  const owner = siap && posisiKode === 'owner' && !training.is_training;
  const [profil, setProfil] = useState<Profil | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!siap || !owner) return;
    let alive = true;
    void (async () => {
      const { data, error: readError } = await rpc('b25_read_homestay_profile');
      if (!alive) return;
      const row = Array.isArray(data) ? data[0] as Profil | undefined : undefined;
      if (readError || !row) {
        setError('Profil belum tersedia. Perlu aktivasi backend resmi oleh Owner setelah proses rilis.');
      } else {
        setProfil(row);
        setName(row.business_name);
        setAddress(row.address);
        setPhone(row.phone);
        setWhatsapp(row.whatsapp);
        setError('');
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [siap, owner]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!owner || !profil || loading || saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    const cleanName = name.trim();
    const cleanAddress = address.trim();
    const cleanPhone = phone.trim();
    const cleanWhatsapp = whatsapp.trim();
    const validContact = (value: string) => value === '' || /^\\+?[0-9 ()-]{6,30}$/.test(value);
    if (cleanName.length < 3 || cleanName.length > 100 || cleanAddress.length > 500
      || !validContact(cleanPhone) || !validContact(cleanWhatsapp)) {
      setError('Periksa nama (3–100 karakter), alamat (maksimal 500), dan nomor kontak.');
      setSaving(false);
      return;
    }
    try {
      const result = await rpc('b25_save_homestay_profile', {
        _business_name: cleanName,
        _address: cleanAddress,
        _phone: cleanPhone,
        _whatsapp: cleanWhatsapp,
      });
      if (result.error) {
        setError(result.error.message);
        return;
      }
      const latest = await rpc('b25_read_homestay_profile');
      const row = Array.isArray(latest.data) ? latest.data[0] as Profil | undefined : undefined;
      if (latest.error || !row) {
        setError('Penyimpanan diproses, tetapi pembacaan ulang gagal. Periksa kembali sebelum mengulangi.');
        return;
      }
      setProfil(row);
      setName(row.business_name);
      setAddress(row.address);
      setPhone(row.phone);
      setWhatsapp(row.whatsapp);
      setNotice('Profil Homestay berhasil disimpan.');
    } catch {
      setError('Hasil penyimpanan belum dapat dipastikan. Periksa kembali sebelum mengulangi.');
    } finally {
      setSaving(false);
    }
  }

  if (!siap) return <Kerangka judul="Profil Homestay"><SubPengaturan><p>Memeriksa akses…</p></SubPengaturan></Kerangka>;
  if (!owner) return <Kerangka judul="Profil Homestay"><SubPengaturan><p role="alert">Halaman ini khusus Owner.</p></SubPengaturan></Kerangka>;

  return (
    <Kerangka judul="Profil Homestay" keterangan="Pengaturan identitas Baturaden 25 Homestay.">
      <SubPengaturan>
        <section className="panel-mewah mx-auto max-w-2xl p-5 sm:p-7">
          <div className="mb-5 flex items-center gap-3">
            <span className="ikon-bulat flex size-11 items-center justify-center text-gold"><Building2 size={22} aria-hidden="true" /></span>
            <div>
              <h1 className="font-serif text-xl font-bold">Profil Resmi Homestay</h1>
              <p className="mt-1 text-sm text-muted-foreground">Nama usaha, alamat dan kontak yang dikelola hanya oleh Owner.</p>
            </div>
          </div>
          {loading && <p role="status" className="text-sm">Memuat profil…</p>}
          {error && <p role="alert" className="mb-4 rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
          {notice && <p role="status" className="mb-4 rounded-lg border border-gold/40 p-3 text-sm">{notice}</p>}
          <form onSubmit={(event) => void save(event)} className="space-y-4">
            <label className="block text-sm">Nama Homestay<input className={field} value={name} onChange={e => setName(e.target.value)} maxLength={100} required disabled={!profil || saving} /></label>
            <label className="block text-sm">Alamat<input className={field} value={address} onChange={e => setAddress(e.target.value)} maxLength={500} disabled={!profil || saving} /></label>
            <label className="block text-sm">Telepon<input className={field} type="tel" value={phone} onChange={e => setPhone(e.target.value)} maxLength={30} disabled={!profil || saving} /></label>
            <label className="block text-sm">WhatsApp resmi<input className={field} type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} maxLength={30} disabled={!profil || saving} /></label>
            <p className="text-xs text-muted-foreground">Perubahan profil tidak otomatis mengganti identitas pada struk lama atau histori transaksi.</p>
            <Button type="submit" disabled={!profil || saving || loading}>{saving ? 'Menyimpan…' : 'Simpan Profil'}</Button>
          </form>
        </section>
      </SubPengaturan>
    </Kerangka>
  );
}
