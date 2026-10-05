import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { rupiah } from '@/lib/data-contoh';
import { useTable } from '@/lib/data-live';
import { supabase } from '@/integrations/supabase/client';

type Mode = 'booking' | 'check_in';

export function FormulirPemesanan({ mode, onClose, onSaved }: { mode: Mode; onClose: () => void; onSaved: () => Promise<void> }) {
  const rooms = useTable('rooms');
  const packages = useTable('packages');
  const guests = useTable('guests');
  const transactions = useTable('transactions');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [roomId, setRoomId] = useState('');
  const [packageId, setPackageId] = useState('');
  const [amount, setAmount] = useState('0');
  const [method, setMethod] = useState('QRIS');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedNumber, setSavedNumber] = useState('');
  const matchedGuest = guests.rows.find(g => g.phone === phone.trim());
  const selectedPackage = packages.rows.find(p => p.id === packageId);
  const occupiedBookings = new Set(transactions.rows.filter(t => t.status === 'booking').map(t => t.room_id));
  const availableRooms = rooms.rows.filter(r => r.active && r.status === 'ready' && !occupiedBookings.has(r.id));
  const fieldClass = 'mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-foreground outline-none focus:border-primary';

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (rooms.error || packages.error || guests.error || transactions.error || rooms.loading || packages.loading || guests.loading || transactions.loading) {
      setError('Data belum siap. Coba lagi sebentar.'); return;
    }
    const normalizedPhone = phone.trim();
    const normalizedName = matchedGuest?.full_name ?? name.trim();
    const normalizedAddress = matchedGuest?.address ?? address.trim();
    const payment = Number(amount);
    if (!normalizedName || normalizedName.length > 100 || !/^[0-9+]{8,16}$/.test(normalizedPhone) || (!matchedGuest && (!normalizedAddress || normalizedAddress.length > 500))) {
      setError('Periksa nama, alamat, dan nomor WA (8–16 angka).'); return;
    }
    if (!availableRooms.some(r => r.id === roomId) || !selectedPackage?.active) {
      setError('Pilih kamar tersedia dan paket aktif.'); return;
    }
    if (!Number.isFinite(payment) || payment < 0 || payment > Number(selectedPackage.price) || !['Cash', 'QRIS', 'Transfer'].includes(method)) {
      setError('Nominal pembayaran harus antara Rp 0 dan harga paket.'); return;
    }
    setSaving(true);
    const { data, error: failure } = await supabase.rpc('create_reservation', {
      _mode: mode, _room_id: roomId, _package_id: packageId, _name: normalizedName,
      _phone: normalizedPhone, _address: normalizedAddress, _amount: payment, _method: method,
      _day_mode: [0, 6].includes(new Date().getDay()) ? 'weekend' : 'weekday',
    });
    setSaving(false);
    if (failure) { setError(failure.message); return; }
    setSavedNumber(data);
    await onSaved();
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label={mode === 'booking' ? 'Buat Booking Baru' : 'Check-in Langsung'} className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-background p-5 shadow-lembut">
      <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-bold">{mode === 'booking' ? 'Buat Booking Baru' : 'Check-in Langsung'}</h2><Button type="button" variant="ghost" size="icon" aria-label="Tutup" onClick={onClose}><X className="h-4 w-4" /></Button></div>
      {savedNumber ? <div><p className="text-sm font-semibold">{mode === 'booking' ? 'Booking tersimpan' : 'Check-in tersimpan'}</p><p className="mt-2 font-mono text-sm text-primary">{savedNumber}</p><Button type="button" className="mt-5" onClick={onClose}>Selesai</Button></div> : <form onSubmit={save} className="space-y-3">
        <label className="block text-sm">Nomor WA<input required type="tel" inputMode="tel" maxLength={16} value={phone} onChange={event => setPhone(event.target.value)} className={fieldClass} placeholder="Cari dengan nomor WA" /></label>
        {matchedGuest && <p className="rounded-xl bg-secondary px-3 py-2 text-sm">Tamu terdaftar: <strong>{matchedGuest.full_name}</strong>. Data lama akan digunakan.</p>}
        <label className="block text-sm">Nama Tamu<input required={!matchedGuest} maxLength={100} value={matchedGuest?.full_name ?? name} disabled={Boolean(matchedGuest)} onChange={event => setName(event.target.value)} className={fieldClass} /></label>
        {!matchedGuest && <label className="block text-sm">Alamat<input required maxLength={500} value={address} onChange={event => setAddress(event.target.value)} className={fieldClass} /></label>}
        <label className="block text-sm">Pilih Kamar<select required value={roomId} onChange={event => setRoomId(event.target.value)} className={fieldClass}><option value="">Pilih kamar siap</option>{availableRooms.map(r => <option key={r.id} value={r.id}>Kamar {r.room_number}</option>)}</select></label>
        <label className="block text-sm">Pilih Paket<select required value={packageId} onChange={event => { setPackageId(event.target.value); if (mode === 'check_in') { const pack = packages.rows.find(p => p.id === event.target.value); setAmount(pack ? String(pack.price) : '0'); } }} className={fieldClass}><option value="">Pilih paket</option>{packages.rows.filter(p => p.active && [120,240,360,720,1440].includes(p.duration_minutes)).map(p => <option key={p.id} value={p.id}>{p.name} · {rupiah(Number(p.price))}</option>)}</select></label>
        <label className="block text-sm">{mode === 'booking' ? 'Nominal DP' : 'Nominal Pembayaran'}<input required type="number" min="0" max={selectedPackage ? Number(selectedPackage.price) : undefined} step="1" value={amount} onChange={event => setAmount(event.target.value)} className={fieldClass} /></label>
        <label className="block text-sm">Metode Pembayaran<select value={method} onChange={event => setMethod(event.target.value)} className={fieldClass}>{['Cash','QRIS','Transfer'].map(m => <option key={m} value={m}>{m}</option>)}</select></label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={onClose}>Batal</Button><Button type="submit" disabled={saving || rooms.loading || packages.loading || guests.loading || transactions.loading}>{saving ? 'Menyimpan…' : mode === 'booking' ? 'Simpan Booking' : 'Simpan Check-in'}</Button></div>
      </form>}
    </div>
  </div>;
}
