import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Printer, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { rupiah } from '@/lib/data-contoh';
import { rpc, useTable } from '@/lib/data-live';
import { useSesiKasKonteks } from '@/lib/sesi-kas';
import { openWhatsApp } from '@/lib/whatsapp';
import { biayaTamuTambahan } from '@/lib/tamu-tambahan';

type Mode = 'booking' | 'check_in';
type DayMode = 'weekday' | 'weekend';

function Bidang({ label, children, lebar }: { label: string; children: ReactNode; lebar?: boolean }) {
  return (
    <label className={`block text-sm ${lebar ? 'sm:col-span-2' : ''}`}>
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function FormulirPemesanan({
  mode,
  onClose,
  onSaved,
}: {
  mode: Mode;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const rooms = useTable('rooms');
  const roomTypes = useTable('room_types');
  const packages = useTable('packages');
  const packagePrices = useTable('package_room_type_prices');
  const guests = useTable('guests');
  const transactions = useTable('transactions');
  const financeSettings = useTable('finance_settings');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [guestCount, setGuestCount] = useState('2');
  const [roomId, setRoomId] = useState('');
  const [packageId, setPackageId] = useState('');
  const [dayMode, setDayMode] = useState<DayMode>('weekday');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [amount, setAmount] = useState('0');
  const [method, setMethod] = useState('QRIS');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedNumber, setSavedNumber] = useState('');
  const [searchFocus, setSearchFocus] = useState<'name' | 'phone' | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [lastRequestFingerprint, setLastRequestFingerprint] = useState('');
  const {
    sessionId,
    activeSession,
    needsAssistedContext,
    isTraining,
    trainingStatus,
    loading: sessionLoading,
    error: sessionError,
  } = useSesiKasKonteks();

  const matchedGuest = guests.rows.find(guest => guest.phone === phone.trim());

  const suggestions = useMemo(() => {
    const term = (searchFocus === 'name' ? name : phone).trim().toLowerCase();
    if (!searchFocus || matchedGuest) return [];
    if (searchFocus === 'name' && term.length < 2) return [];
    const digits = term.replace(/\D/g, '');
    if (searchFocus === 'phone' && digits.length < 3) return [];
    return guests.rows
      .filter(guest =>
        searchFocus === 'name'
          ? guest.full_name.toLowerCase().includes(term)
          : guest.phone.replace(/\D/g, '').includes(digits),
      )
      .slice(0, 6);
  }, [guests.rows, name, phone, searchFocus, matchedGuest]);

  function pilihTamu(guest: (typeof guests.rows)[number]) {
    setName(guest.full_name);
    setPhone(guest.phone);
    setAddress(guest.address);
    setSearchFocus(null);
  }

  const selectedRoom = rooms.rows.find(room => room.id === roomId);
  const selectedRoomType = roomTypes.rows.find(roomType => roomType.id === selectedRoom?.room_type_id);
  const selectedPackage = packages.rows.find(pack => pack.id === packageId);

  function priceForPackage(targetPackageId: string, targetDayMode = dayMode) {
    if (!selectedRoomType?.pricing_group) return 0;
    const price = packagePrices.rows.find(
      item => item.package_id === targetPackageId && item.pricing_group === selectedRoomType.pricing_group,
    );
    if (!price) return 0;
    return Number(targetDayMode === 'weekday' ? price.weekday_price : price.weekend_price);
  }

  const selectedPrice = selectedPackage ? priceForPackage(selectedPackage.id) : 0;
  const jumlahTamu = Math.max(1, Math.floor(Number(guestCount) || 1));
  const extra = biayaTamuTambahan(jumlahTamu);
  const total = selectedPrice + extra.total;

  const setting = financeSettings.rows[0];
  const minimumDp = setting && selectedPrice > 0
    ? setting.minimum_dp_mode === 'PERCENTAGE'
      ? Math.ceil((selectedPrice * Number(setting.minimum_dp_value)) / 100)
      : Number(setting.minimum_dp_value)
    : null;

  const availableRooms = rooms.rows.filter(
    room => room.active && (mode === 'booking' || room.status === 'ready'),
  );

  const dataLoading =
    rooms.loading || roomTypes.loading || packages.loading || packagePrices.loading ||
    guests.loading || transactions.loading || sessionLoading;

  const dataError =
    rooms.error || roomTypes.error || packages.error || packagePrices.error ||
    guests.error || transactions.error || sessionError;

  const fieldClass =
    'mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-foreground outline-none focus:border-primary';
  const readClass = `${fieldClass} flex items-center bg-secondary/60 font-semibold`;

  function handleRoomChange(nextRoomId: string) {
    setRoomId(nextRoomId);
    setPackageId('');
    setAmount('0');
    setError('');
  }

  useEffect(() => {
    let cancelled = false;
    async function resolveDayMode() {
      let operationalDate: string;
      if (mode === 'booking') {
        if (!scheduledDate) return;
        operationalDate = scheduledDate;
      } else {
        operationalDate = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
        }).format(new Date());
      }
      const { data, error: dayModeError } = await rpc('get_operational_day_mode', { _calendar_date: operationalDate });
      if (cancelled) return;
      if (dayModeError || (data !== 'weekday' && data !== 'weekend')) {
        setError('Jenis hari gagal ditentukan dari kalender operasional.');
        return;
      }
      const nextDayMode = data as DayMode;
      setDayMode(nextDayMode);
      if (mode === 'check_in' && selectedPackage) {
        setAmount(String(priceForPackage(selectedPackage.id, nextDayMode)));
      }
    }
    void resolveDayMode();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, scheduledDate, selectedPackage?.id, selectedPrice]);

  function handlePackageChange(nextPackageId: string) {
    setPackageId(nextPackageId);
    if (mode === 'check_in') setAmount(nextPackageId ? String(priceForPackage(nextPackageId)) : '0');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (dataError || dataLoading) { setError('Data belum siap. Coba lagi sebentar.'); return; }

    const normalizedPhone = phone.trim();
    const normalizedName = matchedGuest?.full_name ?? name.trim();
    const normalizedAddress = matchedGuest?.address ?? address.trim();
    const payment = Number(amount);
    const scheduledCheckIn = mode === 'booking' && scheduledDate && scheduledTime
      ? `${scheduledDate}T${scheduledTime}:00+07:00` : null;

    if (mode === 'booking' && !scheduledCheckIn) { setError('Tanggal dan jam check-in wajib dipilih.'); return; }
    if (
      !normalizedName || normalizedName.length > 100 ||
      !/^[0-9+]{8,16}$/.test(normalizedPhone) ||
      (!matchedGuest && (!normalizedAddress || normalizedAddress.length > 500))
    ) { setError('Periksa nama, alamat, dan nomor WA (8–16 angka).'); return; }
    if (extra.tambahan > 0) {
      setError('Biaya tamu tambahan belum dapat dicatat sistem. Pembaruan database menunggu persetujuan Owner; sementara isi maksimal 2 tamu.');
      return;
    }
    if (!availableRooms.some(room => room.id === roomId) || !selectedPackage?.active) {
      setError('Pilih kamar tersedia dan paket aktif.'); return;
    }
    if (!selectedRoomType?.pricing_group || selectedPrice <= 0) {
      setError('Harga resmi untuk kamar dan paket ini belum tersedia.'); return;
    }
    if (!Number.isFinite(payment) || payment < 0 || payment > selectedPrice || !['Cash', 'QRIS', 'Transfer'].includes(method)) {
      setError('Nominal pembayaran harus antara Rp 0 dan harga paket.'); return;
    }
    if (!sessionId || needsAssistedContext) {
      setError(needsAssistedContext
        ? 'Pilih sesi bantuan aktif di halaman Keuangan sebelum menyimpan transaksi.'
        : 'Buka sesi kas aktif sebelum menyimpan transaksi.');
      return;
    }
    if (mode === 'check_in' && payment !== selectedPrice) {
      setError('Pembayaran check-in langsung harus sama dengan harga resmi.'); return;
    }

    const requestFingerprint = JSON.stringify({
      mode, roomId, packageId, normalizedName, normalizedPhone, normalizedAddress,
      payment, method, dayMode, scheduledCheckIn, sessionId,
    });
    const requestKey = lastRequestFingerprint && lastRequestFingerprint !== requestFingerprint
      ? crypto.randomUUID() : idempotencyKey;
    if (requestKey !== idempotencyKey) setIdempotencyKey(requestKey);
    setLastRequestFingerprint(requestFingerprint);
    setSaving(true);

    const { data, error: failure } = await rpc(isTraining ? 'create_training_reservation' : 'create_reservation', {
      _mode: mode,
      _room_id: roomId,
      _package_id: packageId,
      _name: normalizedName,
      _phone: normalizedPhone,
      _address: normalizedAddress,
      _amount: payment,
      _method: method,
      _day_mode: dayMode,
      _idempotency_key: requestKey,
      _session_id: sessionId || null,
      ...(scheduledCheckIn ? { _scheduled_check_in: scheduledCheckIn } : {}),
    });
    setSaving(false);
    if (failure) { setError(failure.message); return; }
    setSavedNumber(data);
    await onSaved();
  }

  const judul = mode === 'booking' ? 'Form Booking' : 'Form Check-in Langsung';

  function kirimStruk() {
    const pesan = [
      'Baturaden 25 Homestay',
      `No. Transaksi: ${savedNumber}`,
      `Tamu: ${matchedGuest?.full_name ?? name.trim()}`,
      `Kamar: ${selectedRoom?.room_number ?? '-'}`,
      `Paket: ${selectedPackage?.name ?? '-'}`,
      `Total: ${rupiah(selectedPrice)} (${method})`,
      'Terima kasih.',
    ].join('\n');
    openWhatsApp(phone, pesan);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/75 p-4 backdrop-blur-sm"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={judul}
        className={`max-h-[calc(100dvh-2rem)] w-full overflow-y-auto rounded-2xl border border-gold/20 bg-background p-5 shadow-lembut ${savedNumber ? 'max-w-sm' : 'max-w-3xl'}`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{savedNumber && mode === 'check_in' ? 'Check-in Berhasil' : judul}</h2>
          <Button type="button" variant="ghost" size="icon" aria-label="Tutup" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {savedNumber ? (
          <div>
            <p className="text-sm font-semibold">{mode === 'booking' ? 'Booking tersimpan' : 'Check-in tersimpan'}</p>
            <p className="mt-2 font-mono text-sm text-primary">{savedNumber}</p>
            {mode === 'check_in' ? (
              <>
                <p className="mt-3 text-xs text-muted-foreground">
                  Cetak struk 58mm belum tersedia di versi ini. "Kirim Struk" membuka WhatsApp berisi ringkasan; pesan baru terkirim setelah Anda menekan kirim di WhatsApp.
                </p>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  <Button type="button" variant="outline" disabled title="Fitur struk 58mm belum tersedia">
                    <Printer className="size-4" />Cetak Struk
                  </Button>
                  <Button type="button" variant="outline" onClick={kirimStruk}>
                    <Send className="size-4" />Kirim Struk
                  </Button>
                  <Button type="button" onClick={onClose}>Tutup</Button>
                </div>
              </>
            ) : (
              <Button type="button" className="mt-5" onClick={onClose}>Selesai</Button>
            )}
          </div>
        ) : (
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <Bidang label="Nomor Transaksi">
              <div className={`${readClass} font-mono text-xs text-muted-foreground`}>BTRDTRX-###### · dibuat otomatis saat disimpan</div>
            </Bidang>

            <div className="relative">
              <Bidang label="Nama Tamu">
                <input
                  required={!matchedGuest}
                  maxLength={100}
                  value={matchedGuest?.full_name ?? name}
                  disabled={Boolean(matchedGuest)}
                  onFocus={() => setSearchFocus('name')}
                  onBlur={() => setTimeout(() => setSearchFocus(null), 150)}
                  onChange={event => setName(event.target.value)}
                  className={fieldClass}
                  placeholder="Ketik nama untuk mencari tamu"
                />
              </Bidang>
              {searchFocus === 'name' && suggestions.length > 0 && <Saran items={suggestions} onPick={pilihTamu} />}
            </div>

            <div className="relative">
              <Bidang label="Nomor WhatsApp">
                <input
                  required
                  type="tel"
                  inputMode="tel"
                  maxLength={16}
                  value={phone}
                  onFocus={() => setSearchFocus('phone')}
                  onBlur={() => setTimeout(() => setSearchFocus(null), 150)}
                  onChange={event => setPhone(event.target.value)}
                  className={fieldClass}
                  placeholder="Ketik nomor untuk mencari tamu"
                />
              </Bidang>
              {searchFocus === 'phone' && suggestions.length > 0 && <Saran items={suggestions} onPick={pilihTamu} />}
            </div>

            <Bidang label="Alamat">
              <input
                required={!matchedGuest}
                maxLength={500}
                value={matchedGuest?.address ?? address}
                disabled={Boolean(matchedGuest)}
                onChange={event => setAddress(event.target.value)}
                className={fieldClass}
              />
            </Bidang>

            {matchedGuest && (
              <p className="rounded-xl bg-secondary px-3 py-2 text-sm sm:col-span-2">
                Tamu terdaftar: <strong>{matchedGuest.full_name}</strong>. Data lama akan digunakan.
              </p>
            )}

            <Bidang label="Jumlah Tamu">
              <input type="number" min={1} max={20} step={1} value={guestCount} onChange={e => setGuestCount(e.target.value)} className={fieldClass} />
            </Bidang>

            <Bidang label="Pilih Kamar">
              <select required value={roomId} onChange={event => handleRoomChange(event.target.value)} className={fieldClass}>
                <option value="">Pilih kamar siap</option>
                {availableRooms.map(room => (
                  <option key={room.id} value={room.id}>Kamar {room.room_number}</option>
                ))}
              </select>
            </Bidang>

            {mode === 'booking' && (
              <>
                <Bidang label="Tanggal Check-in">
                  <input required type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className={fieldClass} />
                </Bidang>
                <Bidang label="Jam Check-in">
                  <input required type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} className={fieldClass} />
                </Bidang>
              </>
            )}

            <Bidang label="Pilih Paket">
              <select
                required
                disabled={!selectedRoomType?.pricing_group}
                value={packageId}
                onChange={event => handlePackageChange(event.target.value)}
                className={fieldClass}
              >
                <option value="">{selectedRoomType?.pricing_group ? 'Pilih paket' : 'Pilih kamar terlebih dahulu'}</option>
                {packages.rows.filter(pack => pack.active).map(pack => {
                  const price = priceForPackage(pack.id);
                  return (
                    <option key={pack.id} value={pack.id} disabled={price <= 0}>
                      {pack.name}{price > 0 ? ` · ${rupiah(price)}` : ' · Harga belum tersedia'}
                    </option>
                  );
                })}
              </select>
            </Bidang>

            <Bidang label={`Harga Kamar (${dayMode === 'weekday' ? 'Weekday' : 'Weekend'})`}>
              <div className={readClass}>{selectedPrice > 0 ? rupiah(selectedPrice) : '—'}</div>
            </Bidang>

            <Bidang label="Metode Pembayaran">
              <select value={method} onChange={event => setMethod(event.target.value)} className={fieldClass}>
                {['Cash', 'QRIS', 'Transfer'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Bidang>

            {mode === 'booking' && (
              <Bidang label={minimumDp !== null ? `Nominal DP (min. ${rupiah(minimumDp)})` : 'Nominal DP'}>
                <input
                  required
                  type="number"
                  max={selectedPrice > 0 ? selectedPrice : undefined}
                  min={0}
                  step="1"
                  value={amount}
                  onChange={event => setAmount(event.target.value)}
                  onFocus={event => event.currentTarget.select()}
                  className={fieldClass}
                />
              </Bidang>
            )}

            <div className="rounded-xl border border-gold/25 bg-secondary/50 px-4 py-3 text-sm sm:col-span-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Harga kamar</span><span>{rupiah(selectedPrice)}</span></div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Extra guest ({extra.tambahan} × {rupiah(extra.tarif)})</span>
                <span>{rupiah(extra.total)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-gold/20 pt-2 font-bold">
                <span>Total Pembayaran</span><span className="text-gold-light">{rupiah(total)}</span>
              </div>
              {extra.tambahan > 0 && (
                <p className="mt-2 text-xs text-perlu-foreground">Biaya tamu tambahan belum dapat disimpan sistem (menunggu persetujuan pembaruan database oleh Owner).</p>
              )}
            </div>

            {isTraining && (
              <p className="rounded-xl bg-perlu px-3 py-2 text-sm text-perlu-foreground sm:col-span-2">
                Training {trainingStatus === 'ACTIVE' ? 'aktif' : 'menunggu validasi'}: transaksi memakai sesi kas Owner/Supervisor yang ditugaskan.
              </p>
            )}

            {selectedPrice > 0 && (
              <p className="rounded-xl bg-secondary px-3 py-2 text-xs sm:col-span-2">
                {activeSession
                  ? 'Sesi kas aktif terhubung otomatis ke pembayaran.'
                  : needsAssistedContext
                    ? 'Sesi bantuan belum ditentukan. Buka halaman Keuangan untuk memilih konteks sesi aktif.'
                    : 'Belum ada sesi kas aktif. Buka sesi sebelum mencatat pembayaran.'}
              </p>
            )}

            {error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}

            <div className="flex justify-end gap-2 pt-1 sm:col-span-2">
              <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
              <Button type="submit" disabled={saving || dataLoading}>
                {saving ? 'Menyimpan…' : mode === 'booking' ? 'Simpan Booking' : 'Check-in'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Saran({ items, onPick }: { items: { id: string; full_name: string; phone: string }[]; onPick: (g: never) => void }) {
  return (
    <ul className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-gold/25 bg-background shadow-lembut">
      {items.map(g => (
        <li key={g.id}>
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); onPick(g as never); }}
            className="flex w-full justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-secondary"
          >
            <span className="truncate font-semibold">{g.full_name}</span>
            <span className="font-mono text-xs text-muted-foreground">{g.phone}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
