import { rpc } from "@/lib/data-live";
import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { rupiah } from '@/lib/data-contoh';
import { useTable } from '@/lib/data-live';
import { supabase } from '@/integrations/supabase/client';
import { useSesiKasKonteks } from '@/lib/sesi-kas';

type Mode = 'booking' | 'check_in';
type DayMode = 'weekday' | 'weekend';

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

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
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

  const matchedGuest = guests.rows.find(
    guest => guest.phone === phone.trim(),
  );

  const selectedRoom = rooms.rows.find(room => room.id === roomId);

  const selectedRoomType = roomTypes.rows.find(
    roomType => roomType.id === selectedRoom?.room_type_id,
  );

  const selectedPackage = packages.rows.find(
    pack => pack.id === packageId,
  );

  function priceForPackage(targetPackageId: string, targetDayMode = dayMode) {
    if (!selectedRoomType?.pricing_group) return 0;

    const price = packagePrices.rows.find(
      item =>
        item.package_id === targetPackageId &&
        item.pricing_group === selectedRoomType.pricing_group,
    );

    if (!price) return 0;

    return Number(
      targetDayMode === 'weekday'
        ? price.weekday_price
        : price.weekend_price,
    );
  }

  const selectedPrice = selectedPackage
    ? priceForPackage(selectedPackage.id)
    : 0;

  const availableRooms = rooms.rows.filter(
  room =>
    room.active &&
    (mode === 'booking' || room.status === 'ready'),
);

  const dataLoading =
    rooms.loading ||
    roomTypes.loading ||
    packages.loading ||
    packagePrices.loading ||
    guests.loading ||
    transactions.loading ||
    sessionLoading;

  const dataError =
    rooms.error ||
    roomTypes.error ||
    packages.error ||
    packagePrices.error ||
    guests.error ||
    transactions.error ||
    sessionError;

  const fieldClass =
    'mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-foreground outline-none focus:border-primary';

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
      if (!scheduledDate) {
        return;
      }

      operationalDate = scheduledDate;
    } else {
      operationalDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
    }

    const { data, error: dayModeError } = await rpc(
      'get_operational_day_mode',
      {
        _calendar_date: operationalDate,
      },
    );

    if (cancelled) {
      return;
    }

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

  return () => {
    cancelled = true;
  };
}, [mode, scheduledDate, selectedPackage?.id, selectedPrice]);

  function handlePackageChange(nextPackageId: string) {
    setPackageId(nextPackageId);

    if (mode === 'check_in') {
      setAmount(
        nextPackageId
          ? String(priceForPackage(nextPackageId))
          : '0',
      );
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (dataError || dataLoading) {
      setError('Data belum siap. Coba lagi sebentar.');
      return;
    }

    const normalizedPhone = phone.trim();
const normalizedName = matchedGuest?.full_name ?? name.trim();
const normalizedAddress = matchedGuest?.address ?? address.trim();
const payment = Number(amount);

const scheduledCheckIn =
  mode === 'booking' && scheduledDate && scheduledTime
    ? `${scheduledDate}T${scheduledTime}:00+07:00`
    : null;

if (mode === 'booking' && !scheduledCheckIn) {
  setError('Tanggal dan jam check-in wajib dipilih.');
  return;
}

    if (
      !normalizedName ||
      normalizedName.length > 100 ||
      !/^[0-9+]{8,16}$/.test(normalizedPhone) ||
      (!matchedGuest &&
        (!normalizedAddress || normalizedAddress.length > 500))
    ) {
      setError('Periksa nama, alamat, dan nomor WA (8–16 angka).');
      return;
    }

    if (
      !availableRooms.some(room => room.id === roomId) ||
      !selectedPackage?.active
    ) {
      setError('Pilih kamar tersedia dan paket aktif.');
      return;
    }

    if (!selectedRoomType?.pricing_group || selectedPrice <= 0) {
      setError('Harga resmi untuk kamar dan paket ini belum tersedia.');
      return;
    }

    if (
      !Number.isFinite(payment) ||
      payment < 0 ||
      payment > selectedPrice ||
      !['Cash', 'QRIS', 'Transfer'].includes(method)
    ) {
      setError('Nominal pembayaran harus antara Rp 0 dan harga paket.');
      return;
    }

    if (!sessionId || needsAssistedContext) {
      setError(needsAssistedContext
        ? 'Pilih sesi bantuan aktif di halaman Keuangan sebelum menyimpan transaksi.'
        : 'Buka sesi kas aktif sebelum menyimpan transaksi.');
      return;
    }

    if (mode === 'check_in' && payment !== selectedPrice) {
      setError('Pembayaran check-in langsung harus sama dengan harga resmi.');
      return;
    }

    const requestFingerprint = JSON.stringify({
      mode,
      roomId,
      packageId,
      normalizedName,
      normalizedPhone,
      normalizedAddress,
      payment,
      method,
      dayMode,
      scheduledCheckIn,
      sessionId,
    });
    const requestKey =
      lastRequestFingerprint && lastRequestFingerprint !== requestFingerprint
        ? crypto.randomUUID()
        : idempotencyKey;

    if (requestKey !== idempotencyKey) {
      setIdempotencyKey(requestKey);
    }
    setLastRequestFingerprint(requestFingerprint);
    setSaving(true);

    const reservationArgs = {
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
      ...(scheduledCheckIn
        ? { _scheduled_check_in: scheduledCheckIn }
        : {}),
    };

    const { data, error: failure } = await rpc(
      isTraining ? 'create_training_reservation' : 'create_reservation',
      reservationArgs,
    );

    setSaving(false);

    if (failure) {
      setError(failure.message);
      return;
    }

    setSavedNumber(data);
    await onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={
          mode === 'booking'
            ? 'Buat Booking Baru'
            : 'Check-in Langsung'
        }
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-background p-5 shadow-lembut"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">
            {mode === 'booking'
              ? 'Buat Booking Baru'
              : 'Check-in Langsung'}
          </h2>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Tutup"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {savedNumber ? (
          <div>
            <p className="text-sm font-semibold">
              {mode === 'booking'
                ? 'Booking tersimpan'
                : 'Check-in tersimpan'}
            </p>

            <p className="mt-2 font-mono text-sm text-primary">
              {savedNumber}
            </p>

            <Button
              type="button"
              className="mt-5"
              onClick={onClose}
            >
              Selesai
            </Button>
          </div>
        ) : (
          <form onSubmit={save} className="space-y-3">
            <label className="block text-sm">
              Nomor WA
              <input
                required
                type="tel"
                inputMode="tel"
                maxLength={16}
                value={phone}
                onChange={event => setPhone(event.target.value)}
                className={fieldClass}
                placeholder="Cari dengan nomor WA"
              />
            </label>

            {matchedGuest && (
              <p className="rounded-xl bg-secondary px-3 py-2 text-sm">
                Tamu terdaftar:{' '}
                <strong>{matchedGuest.full_name}</strong>. Data lama
                akan digunakan.
              </p>
            )}

            <label className="block text-sm">
              Nama Tamu
              <input
                required={!matchedGuest}
                maxLength={100}
                value={matchedGuest?.full_name ?? name}
                disabled={Boolean(matchedGuest)}
                onChange={event => setName(event.target.value)}
                className={fieldClass}
              />
            </label>

            {!matchedGuest && (
              <label className="block text-sm">
                Alamat
                <input
                  required
                  maxLength={500}
                  value={address}
                  onChange={event => setAddress(event.target.value)}
                  className={fieldClass}
                />
              </label>
            )}

            <label className="block text-sm">
              Pilih Kamar
              <select
                required
                value={roomId}
                onChange={event =>
                  handleRoomChange(event.target.value)
                }
                className={fieldClass}
              >
                <option value="">Pilih kamar siap</option>

                {availableRooms.map(room => (
                  <option key={room.id} value={room.id}>
                    Kamar {room.room_number}
                  </option>
                ))}
              </select>
            </label>
{mode === 'booking' && (
  <div className="grid grid-cols-2 gap-3">
    <label className="block text-sm">
      Tanggal Check-in
      <input
        required
        type="date"
        value={scheduledDate}
        onChange={event => setScheduledDate(event.target.value)}
        className={fieldClass}
      />
    </label>

    <label className="block text-sm">
      Jam Check-in
      <input
        required
        type="time"
        value={scheduledTime}
        onChange={event => setScheduledTime(event.target.value)}
        className={fieldClass}
      />
    </label>
  </div>
)}
            <label className="block text-sm">
  Jenis Hari
  <div className={`${fieldClass} flex items-center`}>
    {dayMode === 'weekday' ? 'Weekday' : 'Weekend'}
  </div>
</label>

            <label className="block text-sm">
              Pilih Paket
              <select
                required
                disabled={!selectedRoomType?.pricing_group}
                value={packageId}
                onChange={event =>
                  handlePackageChange(event.target.value)
                }
                className={fieldClass}
              >
                <option value="">
                  {selectedRoomType?.pricing_group
                    ? 'Pilih paket'
                    : 'Pilih kamar terlebih dahulu'}
                </option>

                {packages.rows
                  .filter(pack => pack.active)
                  .map(pack => {
                    const price = priceForPackage(pack.id);

                    return (
                      <option
                        key={pack.id}
                        value={pack.id}
                        disabled={price <= 0}
                      >
                        {pack.name}
                        {price > 0
                          ? ` · ${rupiah(price)}`
                          : ' · Harga belum tersedia'}
                      </option>
                    );
                  })}
              </select>
            </label>

            {selectedPackage && selectedPrice > 0 && (
              <p className="rounded-xl bg-secondary px-3 py-2 text-sm">
                Harga resmi:{' '}
                <strong>{rupiah(selectedPrice)}</strong>
              </p>
            )}

            {isTraining && (
              <p className="rounded-xl bg-perlu px-3 py-2 text-sm text-perlu-foreground">
                Training {trainingStatus === 'ACTIVE' ? 'aktif' : 'menunggu validasi'}: transaksi memakai sesi kas Owner/Supervisor yang ditugaskan.
              </p>
            )}

            {selectedPrice > 0 && (
              <p className="rounded-xl bg-secondary px-3 py-2 text-sm">
                {activeSession
                  ? 'Sesi kas aktif terhubung otomatis ke pembayaran.'
                  : needsAssistedContext
                    ? 'Sesi bantuan belum ditentukan. Buka halaman Keuangan untuk memilih konteks sesi aktif.'
                    : 'Belum ada sesi kas aktif. Buka sesi sebelum mencatat pembayaran.'}
              </p>
            )}

            <label className="block text-sm">
              {mode === 'booking'
                ? 'Nominal DP'
                : 'Nominal Pembayaran'}

              <input
                required
                type="number"
                max={
                  selectedPrice > 0
                    ? selectedPrice
                    : undefined
                }
                min={
                  mode === 'check_in' && selectedPrice > 0
                    ? selectedPrice
                    : 0
                }
                step="1"
                value={amount}
                readOnly={mode === 'check_in'}
                onChange={event => {
                  if (mode !== 'check_in') {
                    setAmount(event.target.value);
                  }
                }}
onFocus={event => event.currentTarget.select()}
                className={fieldClass}
              />
            </label>

            <label className="block text-sm">
              Metode Pembayaran
              <select
                value={method}
                onChange={event => setMethod(event.target.value)}
                className={fieldClass}
              >
                {['Cash', 'QRIS', 'Transfer'].map(paymentMethod => (
                  <option
                    key={paymentMethod}
                    value={paymentMethod}
                  >
                    {paymentMethod}
                  </option>
                ))}
              </select>
            </label>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
              >
                Batal
              </Button>

              <Button
                type="submit"
                disabled={saving || dataLoading}
              >
                {saving
                  ? 'Menyimpan…'
                  : mode === 'booking'
                    ? 'Simpan Booking'
                    : 'Simpan Check-in'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
