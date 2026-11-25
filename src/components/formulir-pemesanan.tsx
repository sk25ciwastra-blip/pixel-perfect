import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { BedDouble, CreditCard, FileText, Info, Printer, Send, UserRound, X } from 'lucide-react';
import '@/components/check-in-reference.css';
import { Button } from '@/components/ui/button';
import { rupiah } from '@/lib/data-contoh';
import { rpc, useTable, useTransaksiOperasional } from '@/lib/data-live';
import { useSesiKasKonteks } from '@/lib/sesi-kas';
import { openWhatsApp } from '@/lib/whatsapp';
import { biayaTamuTambahan } from '@/lib/tamu-tambahan';
import { paketTerurut, tipeKamarTerurut } from '@/lib/urutan-pilihan';
import { featureFlags, extraGuestAktif } from '@/lib/feature-flags';
import { choosePaymentMethods, amountAfterPaymentSwitch } from '@/lib/payment-method-choice';
import { ReceiptTransactionButton } from '@/components/receipt-actions';
import { CheckInBerhasil } from '@/components/check-in-berhasil';
import { BookingQuote } from '@/components/booking-quote';
import { canPreviewBookingQuote, quoteCheckInWib, type BookingQuoteDraft } from '@/lib/booking-quote';
import { usePeran } from '@/lib/peran';
import { supabase } from '@/integrations/supabase/client';
import {
  createReservationCombined,
  createTrainingReservationCombined,
  minimumDpAmount,
  shouldUseCombinedPayment,
  type CombinedPaymentComponent,
} from '@/lib/combined-payments';

import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { bookingPhoneInput, canonicalIndonesianWhatsApp, findSameGuest, suggestGuests, type GuestSearchRow } from '@/lib/guest-search';
import { offerQueryKey, offerWhatsApp, offerWibFields, type Offer, type OfferDetail } from '@/lib/reservation-offers';

type Mode = 'booking' | 'check_in' | 'offer';
type DayMode = 'weekday' | 'weekend';
type MetodePembayaran = 'Cash' | 'QRIS' | 'Transfer';

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
  initialRoomId = '',
  onClose,
  onSaved,
  offer,
  onOfferSaved,
}: {
  mode: Mode;
  initialRoomId?: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  offer?: OfferDetail;
  onOfferSaved?: (item: OfferDetail) => void;
}) {
  const { posisiKode, masuk } = usePeran();
  const client = useQueryClient();
  const isOffer = mode === 'offer';
  const scheduled = mode !== 'check_in';
  const initialSlot = offer ? offerWibFields(offer.scheduled_check_in) : null;
  const pending = useRef(false);
  const offerRequest = useRef<{ key: string; id: string } | null>(null);
  const [paymentVerified, setPaymentVerified] = useState(false);
  const rooms = useTable('rooms');
  const roomTypes = useTable('room_types');
  const packages = useTable('packages');
  const packagePrices = useTable('package_room_type_prices');
  const guests = useTable('guests');
  const transactions = useTransaksiOperasional();
  const financeSettings = useTable('finance_settings');

  const [name, setName] = useState(offer?.guest_name ?? '');
  const [phone, setPhone] = useState(offer?.phone ?? '');
  const [address, setAddress] = useState(offer?.address ?? '');
  const [extraGuests, setExtraGuests] = useState('0');
  const [roomId, setRoomId] = useState(offer?.room_id ?? initialRoomId);
  const [packageId, setPackageId] = useState(offer?.package_id ?? '');
  const [dayMode, setDayMode] = useState<DayMode>('weekday');
  const [dayModeDate, setDayModeDate] = useState('');
  const [scheduledDate, setScheduledDate] = useState(initialSlot?.date ?? '');
  const [scheduledTime, setScheduledTime] = useState(initialSlot?.time ?? '');
  const [methods, setMethods] = useState<MetodePembayaran[]>(['QRIS']);
  const [nominal, setNominal] = useState<Record<string, string>>({});
  const method = methods[0] ?? '';
  const amount = nominal[method] ?? '0';
  const setAmount = (v: string) => setNominal(n => ({ ...n, [methods[0] ?? 'QRIS']: v }));
  const [paymentIdempotencyKeys, setPaymentIdempotencyKeys] = useState<Record<string, string>>(() => ({ QRIS: crypto.randomUUID() }));
  function toggleMethod(m: MetodePembayaran) {
    const next = choosePaymentMethods(methods, m, featureFlags.combinedPayment && !offer);
    const adding = !methods.includes(m);
    setNominal(current => {
      if (!featureFlags.combinedPayment || offer) return amountAfterPaymentSwitch(current, methods, m, false);
      if (adding) return { ...current, [m]: current[m] ?? '' };
      const amounts = { ...current };
      if (!next.includes(m)) delete amounts[m];
      return amounts;
    });
    if (adding) setPaymentIdempotencyKeys(keys => ({ ...keys, [m]: keys[m] ?? crypto.randomUUID() }));
    setMethods(next);
    setError('');
  }
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

  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const guestLookupId = useId();
  const canSearch = canPreviewBookingQuote('booking', posisiKode, masuk) && !offer;
  const [remoteGuests, setRemoteGuests] = useState<{ key: string; rows: GuestSearchRow[] }>({ key: '', rows: [] });
  const term = searchFocus === 'name' ? name.trim() : phone.trim();
  const searchKey = searchFocus + ':' + term;
  useEffect(() => {
    if (!canSearch || !searchFocus || (searchFocus === 'name' ? term.length < 2 : term.replace(/\D/g, '').length < 3)) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const { data, error } = await supabase.rpc('search_reservation_guests', { _field: searchFocus, _term: term });
          if (!cancelled && !error) setRemoteGuests({ key: searchKey, rows: data ?? [] });
        } catch { /* Keep existing RLS-scoped results and manual entry when the new RPC is unavailable. */ }
      })();
    }, 180);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [canSearch, searchFocus, searchKey, term]);
  const guestRows = remoteGuests.key === searchKey
    ? [...new Map([...remoteGuests.rows, ...guests.rows].map(row => [row.id, row])).values()]
    : guests.rows;
  const matchedGuest = canSearch ? findSameGuest([...remoteGuests.rows, ...guests.rows], phone) : undefined;
  const suggestions = canSearch ? suggestGuests(guestRows, searchFocus, name, phone) : [];
  function lookupAttributes(field: 'name' | 'phone') {
    if (!canSearch) return {};
    const expanded = searchFocus === field && suggestions.length > 0;
    const listId = guestLookupId + '-' + field;
    return {
      role: 'combobox',
      'aria-autocomplete': 'list' as const,
      'aria-expanded': expanded,
      'aria-controls': expanded ? listId : undefined,
      'aria-activedescendant': expanded && suggestionIndex >= 0 ? listId + '-' + suggestionIndex : undefined,
    };
  }
  function focusGuest(field: 'name' | 'phone') {
    setSearchFocus(field);
    setSuggestionIndex(-1);
  }
  function navigateGuests(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') { setSearchFocus(null); return; }
    if (!suggestions.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setSuggestionIndex(current => current < 0 ? (step > 0 ? 0 : suggestions.length - 1) : (current + step + suggestions.length) % suggestions.length);
    }
    if (event.key === 'Enter' && suggestions[suggestionIndex]) {
      event.preventDefault();
      pilihTamu(suggestions[suggestionIndex]);
    }
  }

  function pilihTamu(guest: GuestSearchRow) {
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
  const jumlahTamu = 2 + Math.max(0, Math.floor(Number(extraGuests) || 0));
  const extra = biayaTamuTambahan(jumlahTamu);
  const total = selectedPrice + extra.total;
  const paymentTotal = methods.reduce((sum, m) => sum + Math.max(0, Number(nominal[m]) || 0), 0);

  const setting = financeSettings.rows[0];
  const minimumDp = offer?.minimum_dp ?? minimumDpAmount(total, setting);
  const extraGuestOn = typeof window !== 'undefined' && extraGuestAktif(window.location.hostname);
  const showQuote = !offer && canPreviewBookingQuote(scheduled ? 'booking' : mode, posisiKode, masuk);
  const [quoteDp, setQuoteDp] = useState<{
    setting: { minimum_dp_mode: string; minimum_dp_value: number } | null;
    loading: boolean;
  }>({ setting: null, loading: true });
  useEffect(() => {
    if (!showQuote) return;
    let cancelled = false;
    setQuoteDp({ setting: null, loading: true });
    async function readQuoteDp() {
      try {
        const { data, error } = await supabase.rpc('get_booking_quote_minimum_dp');
        if (!cancelled) setQuoteDp({ setting: error ? null : data?.[0] ?? null, loading: false });
      } catch {
        if (!cancelled) setQuoteDp({ setting: null, loading: false });
      }
    }
    void readQuoteDp();
    return () => { cancelled = true; };
  }, [showQuote, posisiKode]);
  const quoteMinimumDp = minimumDpAmount(total, quoteDp.setting);
  const quoteDraft: BookingQuoteDraft = {
    name: matchedGuest?.full_name ?? name,
    phone: bookingPhoneInput(phone),
    roomNumber: selectedRoom?.active ? selectedRoom.room_number : '',
    roomType: selectedRoomType?.name ?? '',
    packageName: selectedPackage?.active ? selectedPackage.name : '',
    checkIn: quoteCheckInWib(scheduledDate, scheduledTime) ?? '',
    guestCount: jumlahTamu,
    dayMode,
    roomPrice: selectedPrice,
    extraCharge: extra.total,
    total,
    minimumDp: quoteMinimumDp === null ? null : Math.ceil(quoteMinimumDp),
    dpMode: quoteDp.setting?.minimum_dp_mode,
    dpValue: quoteDp.setting ? Number(quoteDp.setting.minimum_dp_value) : undefined,
  };
  const quoteData = [rooms, roomTypes, packages, packagePrices, guests];
  const quoteLoading = quoteDp.loading || quoteData.some(source => source.loading);
  const quoteLoadError = quoteData.some(source => Boolean(source.error));
  const quoteDayReady = Boolean(scheduledDate && dayModeDate === scheduledDate);

  useEffect(() => {
    if (mode === 'check_in' && methods.length === 1 && selectedPrice > 0) {
      const selectedMethod = methods[0];
      if (!selectedMethod) return;
      setNominal((current) => current[selectedMethod] === String(total)
        ? current : { ...current, [selectedMethod]: String(total) });
    }
  }, [mode, methods, selectedPrice, total]);

  const availableRooms = rooms.rows.filter(
    room => room.active && (scheduled || room.status === 'ready'),
  );
  const [typeChoice, setTypeChoice] = useState('');
  const activeTypeId = typeChoice || selectedRoom?.room_type_id || '';
  const roomsOfType = availableRooms.filter(room => room.room_type_id === activeTypeId)
    .sort((a, b) => a.room_number.localeCompare(b.room_number, 'id', { numeric: true }));
  const typesWithRooms = tipeKamarTerurut(roomTypes.rows.filter(t => availableRooms.some(r => r.room_type_id === t.id)));
  const paketUrut = paketTerurut(packages.rows);
  const selectedRoomUnavailable = mode === 'check_in' && Boolean(selectedRoom) && !availableRooms.some(room => room.id === roomId);

  const dataLoading =
    rooms.loading || roomTypes.loading || packages.loading || packagePrices.loading ||
    guests.loading || transactions.loading || financeSettings.loading || sessionLoading;

  const dataError =
    rooms.error || roomTypes.error || packages.error || packagePrices.error ||
    guests.error || transactions.error || financeSettings.error || sessionError;

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
      if (scheduled) {
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
        setDayModeDate('');
        setError('Jenis hari gagal ditentukan dari kalender operasional.');
        return;
      }
      const nextDayMode = data as DayMode;
      setDayMode(nextDayMode);
      if (scheduled) setDayModeDate(operationalDate);
    }
    void resolveDayMode();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, scheduledDate, selectedPackage?.id, selectedPrice]);

  function handlePackageChange(nextPackageId: string) {
    setPackageId(nextPackageId);
    if (mode === 'check_in') setAmount(nextPackageId ? String(priceForPackage(nextPackageId)) : '0');
  }

  async function saveOffer() {
    const canonicalPhone = canonicalIndonesianWhatsApp(phone);
    if (!showQuote || !quoteDayReady || quoteLoading || quoteLoadError || quoteMinimumDp === null || !quoteDraft.checkIn ||
        !quoteDraft.roomNumber || !quoteDraft.packageName || !quoteDraft.name.trim() || !(matchedGuest?.address ?? address).trim() ||
        !canonicalPhone) {
      setError('Lengkapi data tamu, WhatsApp Indonesia, jadwal, dan tunggu harga serta DP resmi.');
      return;
    }
    const data = {
      _name: matchedGuest?.full_name ?? name, _phone: canonicalPhone, _address: matchedGuest?.address ?? address,
      _room: roomId, _package: packageId, _start: quoteDraft.checkIn,
    };
    const key = JSON.stringify(data);
    if (offerRequest.current?.key !== key) offerRequest.current = { key, id: crypto.randomUUID() };
    let tab: Window | null = null;
    try {
      tab = window.open('about:blank', '_blank');
      if (tab) tab.opener = null;
    } catch { tab?.close(); tab = null; }
    pending.current = true;
    setSaving(true);
    try {
      const response = await supabase.rpc('create_reservation_offer', { ...data, _id: offerRequest.current.id });
      if (response.error || !response.data) throw new Error(response.error?.message ?? 'Permintaan reservasi belum dapat disimpan.');
      const item = response.data as unknown as OfferDetail;
      void client.invalidateQueries({ queryKey: offerQueryKey });
      if (item.status !== 'DRAFT' && item.status !== 'SENT') {
        tab?.close();
        toast.error(item.reason ?? 'Reservasi tidak lagi aktif. Lihat Riwayat Reservasi di Detail Tamu.');
      } else {
        try {
          const { url } = offerWhatsApp(item);
          if (tab && url) tab.location.replace(url);
          else tab?.close();
        } catch { tab?.close(); tab = null; }
        toast.success('Reservasi masuk antrean menunggu pembayaran. Kirim instruksi pembayaran melalui WhatsApp.');
      }
      onOfferSaved?.(item);
    } catch (failure) {
      tab?.close();
      setError(failure instanceof Error ? failure.message : 'Penyimpanan belum dapat dikonfirmasi. Coba lagi.');
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    setError('');
    if (isOffer) { await saveOffer(); return; }
    if (dataError || dataLoading) { setError('Data belum siap. Coba lagi sebentar.'); return; }

    const normalizedPhone = bookingPhoneInput(matchedGuest?.phone ?? phone);
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
    if (methods.length === 0) { setError('Pilih minimal 1 metode pembayaran.'); return; }
    if (methods.length > 1 && !featureFlags.combinedPayment) {
      setError('Pembayaran gabungan belum diaktifkan. Pilih satu metode pembayaran sampai backend siap.');
      return;
    }
    if (extra.tambahan > 0 && !extraGuestOn) {
      setError('Biaya tamu tambahan belum dapat dicatat sistem. Pembaruan database menunggu persetujuan Owner; sementara isi maksimal 2 tamu.');
      return;
    }
    if (!availableRooms.some(room => room.id === roomId) || !selectedPackage?.active) {
      setError('Pilih kamar tersedia dan paket aktif.'); return;
    }
    if (!selectedRoomType?.pricing_group || selectedPrice <= 0) {
      setError('Harga resmi untuk kamar dan paket ini belum tersedia.'); return;
    }
    if (methods.some(m => !Number.isFinite(Number(nominal[m])) || Number(nominal[m]) <= 0) || paymentTotal > total || !methods.every(m => ['Cash', 'QRIS', 'Transfer'].includes(m))) {
      setError('Setiap nominal metode harus positif dan jumlah pembayaran tidak boleh melebihi total tagihan.'); return;
    }
    if (mode === 'booking' && minimumDp !== null && paymentTotal < minimumDp) {
      const dpBasis = setting?.minimum_dp_mode === 'PERCENTAGE'
        ? `${Number(setting.minimum_dp_value)}% dari total tagihan`
        : 'sesuai pengaturan Owner';
      setError(`DP minimum adalah ${rupiah(minimumDp)} (${dpBasis}).`); return;
    }
    if (!sessionId || needsAssistedContext) {
      setError(needsAssistedContext
        ? 'Pilih sesi bantuan aktif di halaman Keuangan sebelum menyimpan transaksi.'
        : 'Buka sesi kas aktif sebelum menyimpan transaksi.');
      return;
    }
    if (mode === 'check_in' && paymentTotal !== total) {
      setError('Pembayaran check-in langsung harus sama dengan harga resmi.'); return;
    }

    if (offer) {
      if (!paymentVerified || isTraining || methods.length !== 1) {
        setError('Konfirmasi penerimaan pembayaran, pilih satu metode, dan gunakan sesi non-Training.');
        return;
      }
      pending.current = true;
      setSaving(true);
      try {
        const { data, error: failure } = await supabase.rpc('transition_reservation_offer', {
          _id: offer.id, _action: 'convert', _amount: paymentTotal, _method: method, _session: sessionId, _payment_verified: paymentVerified,
        });
        if (failure || !data) throw new Error(failure?.message ?? 'Booking belum dapat dikonfirmasi.');
        const result = data as unknown as Offer;
        void client.invalidateQueries({ queryKey: offerQueryKey });
        if (result.status !== 'CONVERTED' || !result.transaction_number) {
          setError(result.reason ?? 'Reservasi tidak lagi aktif.');
          return;
        }
        setSavedNumber(result.transaction_number);
        toast.success('Booking resmi berhasil disimpan.');
        void onSaved().catch(() => toast.error('Booking tersimpan. Muat ulang untuk memperbarui tampilan.'));
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : 'Booking belum dapat dikonfirmasi. Coba lagi dengan reservasi yang sama.');
      } finally {
        pending.current = false;
        setSaving(false);
      }
      return;
    }

    const requestFingerprint = JSON.stringify({
      mode, roomId, packageId, normalizedName, normalizedPhone, normalizedAddress,
      payments: methods.map(m => ({ method: m, amount: Number(nominal[m]) || 0 })), dayMode, scheduledCheckIn, sessionId, guestCount: jumlahTamu,
    });
    const requestKey = lastRequestFingerprint && lastRequestFingerprint !== requestFingerprint
      ? crypto.randomUUID() : idempotencyKey;
    const componentKeys = { ...paymentIdempotencyKeys };
    if (lastRequestFingerprint && lastRequestFingerprint !== requestFingerprint) methods.forEach(m => { componentKeys[m] = crypto.randomUUID(); });
    if (requestKey !== idempotencyKey) setIdempotencyKey(requestKey);
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
      _scheduled_check_in: scheduledCheckIn,
      ...(extraGuestOn ? { _guest_count: jumlahTamu } : {}),
    };
    const combinedArgs = {
      _mode: mode, _room_id: roomId, _package_id: packageId, _name: normalizedName,
      _phone: normalizedPhone, _address: normalizedAddress,
      _payments: methods.map(m => ({ method: m, amount: Number(nominal[m]), idempotency_key: componentKeys[m] })) as CombinedPaymentComponent[],
      _day_mode: dayMode, _request_idempotency_key: requestKey, _request_fingerprint: requestFingerprint,
      _session_id: sessionId || null,
      _scheduled_check_in: scheduledCheckIn,
      ...(extraGuestOn ? { _guest_count: jumlahTamu } : {}),
    };
    const combined = shouldUseCombinedPayment(methods.length, featureFlags.combinedPayment);
    const { data, error: failure } = combined
      ? await (isTraining ? createTrainingReservationCombined(combinedArgs) : createReservationCombined(combinedArgs))
      : await rpc(isTraining ? 'create_training_reservation' : 'create_reservation', reservationArgs);
    setSaving(false);
    if (failure) { setError(failure.message); return; }
    setIdempotencyKey(crypto.randomUUID());
    setPaymentIdempotencyKeys(Object.fromEntries(methods.map(m => [m, crypto.randomUUID()])));
    setLastRequestFingerprint('');
    setSavedNumber(data?.transaction_number ?? data);
    await onSaved();
  }

  const judul = isOffer ? 'Buat Reservasi' : mode === 'booking' ? 'Verifikasi Pembayaran' : 'Form Check-in Langsung';

  function kirimStruk() {
    const pesan = [
      'Baturaden 25 Homestay',
      `No. Transaksi: ${savedNumber}`,
      `Tamu: ${matchedGuest?.full_name ?? name.trim()}`,
      `Kamar: ${selectedRoom?.room_number ?? '-'}`,
      `Paket: ${selectedPackage?.name ?? '-'}`,
      `Total: ${rupiah(total)} (${methods.join(' + ')})`,
      'Terima kasih.',
    ].join('\n');
    openWhatsApp(phone, pesan);
  }

  if (savedNumber) return <CheckInBerhasil mode={mode === 'check_in' ? 'check_in' : 'booking'} transactionNumber={savedNumber} room={selectedRoom?.room_number ?? '—'} roomType={selectedRoomType?.name ?? '—'} packageName={selectedPackage?.name ?? '—'} onClose={onClose} />;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/75 p-4 backdrop-blur-sm"
      onMouseDown={event => { if (event.target === event.currentTarget && !pending.current) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={judul}
        className={`max-h-[calc(100dvh-2rem)] w-full overflow-y-auto rounded-2xl border border-gold/20 bg-background p-5 shadow-lembut ${savedNumber ? 'max-w-sm' : isOffer ? 'checkin-reference border-[#c7aa75] bg-[#fffaf0] text-[#2a2119] shadow-[0_24px_65px_rgba(15,12,9,0.3)]' : 'checkin-reference'}`}
      >
        {!savedNumber ? <div className="ci-header">
          <p>{isOffer ? 'BATURADEN 25 HOMESTAY / PERMINTAAN RESERVASI' : 'OPERASIONAL / TRANSAKSI BARU'}</p>
          <div className="ci-header-title"><h2>{isOffer ? 'Buat Reservasi' : mode === 'booking' ? 'Reservasi' : 'Check-in Langsung'}</h2><span className={isOffer ? 'ci-header-id rounded-full border border-[#d7bc85] bg-[#f8eaca] px-3 py-1 text-[#6a4c24]' : 'ci-header-id'}>{isOffer ? 'Belum mengunci kamar' : 'ID otomatis setelah disimpan'}</span></div>
          <Button type="button" variant="ghost" size="icon" aria-label="Tutup" disabled={saving} onClick={onClose}><X /></Button>
        </div> : <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{savedNumber && mode === 'check_in' ? 'Check-in Berhasil' : judul}</h2>
          <Button type="button" variant="ghost" size="icon" aria-label="Tutup" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>}

        {isOffer && <div className="mb-4 rounded-xl border border-[#dec99f] bg-[#fff5df] px-4 py-3 text-xs leading-relaxed text-[#624d2c]"><strong className="block text-sm text-[#36291a]">Reservasi menunggu pembayaran</strong>Kamar belum terkunci sebelum pembayaran berhasil diverifikasi. Setelah disimpan, kirim rincian harga dan QRIS resmi secara manual melalui WhatsApp.</div>}

        {savedNumber ? (
          <div>
            <p className="text-sm font-semibold">{mode === 'booking' ? 'Booking tersimpan' : 'Check-in tersimpan'}</p>
            <p className="mt-2 font-mono text-sm text-primary">{savedNumber}</p>
            {mode === 'check_in' ? (
              <>
                <p className="mt-3 text-xs text-muted-foreground">
                  {featureFlags.receipt58mm ? 'Cetak Struk membuka dialog cetak 58mm; hasil fisik perlu diperiksa pada printer. ' : 'Cetak struk 58mm belum diaktifkan. '}"Kirim Struk" membuka WhatsApp berisi ringkasan; pesan baru terkirim setelah Anda menekan kirim di WhatsApp.
                </p>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {featureFlags.receipt58mm ? <ReceiptTransactionButton transactionNumber={savedNumber} /> : (
                    <Button type="button" variant="outline" disabled title="Fitur struk 58mm belum diaktifkan">
                      <Printer className="size-4" />Cetak Struk
                    </Button>
                  )}
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
          <form onSubmit={save} className="ci-form">
            <div className="ci-grid">
              <section className="ci-pane"><h3><UserRound />Identitas Tamu</h3><div className="ci-fields">
                <div className="relative z-20" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setSearchFocus(null); }}>
                  <Bidang label="Nomor WhatsApp"><input required type="tel" inputMode="tel" maxLength={16} value={phone}
                    {...lookupAttributes('phone')}
                    readOnly={Boolean(offer)} onFocus={() => focusGuest('phone')} onKeyDown={navigateGuests}
                    onChange={event => { setPhone(event.target.value); focusGuest('phone'); }} className={fieldClass}
                    placeholder="Ketik sebagian nomor untuk mencari tamu" /></Bidang>
                  {searchFocus === 'phone' && <Saran id={guestLookupId + '-phone'} items={suggestions} active={suggestionIndex} onPick={pilihTamu} />}
                </div>
                <div className="relative z-10" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setSearchFocus(null); }}>
                  <Bidang label="Nama Tamu"><input required maxLength={100} value={matchedGuest?.full_name ?? name}
                    {...lookupAttributes('name')}
                    readOnly={Boolean(offer || matchedGuest)} onFocus={() => focusGuest('name')} onKeyDown={navigateGuests}
                    onChange={event => { setName(event.target.value); focusGuest('name'); }} className={fieldClass}
                    placeholder="Ketik sebagian nama untuk mencari tamu" /></Bidang>
                  {searchFocus === 'name' && <Saran id={guestLookupId + '-name'} items={suggestions} active={suggestionIndex} onPick={pilihTamu} />}
                </div>
                <Bidang label="Alamat"><input required maxLength={500} value={matchedGuest?.address ?? address}
                  readOnly={Boolean(offer || matchedGuest)} onChange={event => setAddress(event.target.value)} className={fieldClass} /></Bidang>
                <Bidang label="Jumlah Tamu"><div className={readClass}>{jumlahTamu}</div></Bidang>
              </div>{matchedGuest && <p className="ci-notice">Tamu terdaftar: <strong>{matchedGuest.full_name}</strong>. Data lama digunakan.</p>}</section>
              <section className="ci-pane"><h3><BedDouble />Rincian Menginap</h3><div className="ci-fields">
                <Bidang label="Tipe Kamar"><select required disabled={Boolean(offer)} value={activeTypeId} onChange={event => { setTypeChoice(event.target.value); handleRoomChange(''); }} className={fieldClass}><option value="">Pilih tipe kamar</option>{typesWithRooms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Bidang>
                <Bidang label="Nomor Kamar"><select required disabled={!activeTypeId || Boolean(offer)} value={roomId} onChange={event => handleRoomChange(event.target.value)} className={fieldClass}><option value="">{activeTypeId ? 'Pilih nomor kamar' : 'Pilih tipe kamar terlebih dahulu'}</option>{selectedRoomUnavailable && selectedRoom && <option value={selectedRoom.id} disabled>Kamar {selectedRoom.room_number} · Belum tersedia</option>}{roomsOfType.map(room => <option key={room.id} value={room.id}>Kamar {room.room_number}</option>)}</select></Bidang>
                {scheduled && <>
                <Bidang label="Tanggal Check-in"><input required type="date" readOnly={Boolean(offer)} value={scheduledDate} onChange={event => { setDayModeDate(''); setScheduledDate(event.target.value); }} className={fieldClass} /></Bidang>
                <Bidang label="Jam Check-in"><input required type="time" readOnly={Boolean(offer)} value={scheduledTime} onChange={event => setScheduledTime(event.target.value)} className={fieldClass} /></Bidang>
                </>}
                <Bidang label="Pilih Paket"><select required disabled={!selectedRoomType?.pricing_group || Boolean(offer)} value={packageId} onChange={event => handlePackageChange(event.target.value)} className={fieldClass}><option value="">{selectedRoomType?.pricing_group ? 'Pilih paket' : 'Pilih kamar terlebih dahulu'}</option>{paketUrut.map(pack => { const price = priceForPackage(pack.id); return <option key={pack.id} value={pack.id} disabled={price <= 0}>{pack.name}</option>; })}</select></Bidang>
                <Bidang label={`Harga Kamar (${dayMode === 'weekday' ? 'WEEKDAY' : 'WEEKEND'})`}><div className={readClass}>{selectedPrice > 0 ? rupiah(selectedPrice) : '—'}</div></Bidang>
                {mode === 'check_in' && <Bidang label="TAMU TAMBAHAN (RP. 50.000/ORANG)"><input type="number" min={0} max={18} step={1} value={extraGuests} onChange={event => setExtraGuests(event.target.value)} onFocus={event => event.currentTarget.select()} className={fieldClass} /></Bidang>}
              </div>{selectedRoomUnavailable && <p role="alert" className="ci-notice text-destructive">Kamar belum tersedia untuk Check-in Langsung. Pilih kamar tersedia; Check-in ganda tidak diizinkan.</p>}</section>
              {!isOffer && <><section className="ci-pane"><h3><CreditCard />Pembayaran</h3><p className="ci-method-label">Metode Pembayaran (maks. {featureFlags.combinedPayment && !offer ? '2' : '1'})</p><div className="ci-methods">{(['Cash', 'QRIS', 'Transfer'] as MetodePembayaran[]).map(m => <Button key={m} type="button" variant="outline" aria-pressed={methods.includes(m)} disabled={!methods.includes(m) && methods.length >= 2} onClick={() => toggleMethod(m)}>{m.toUpperCase()}</Button>)}</div><div className="ci-fields">{methods.map(m => <Bidang key={m} label={`Nominal ${m.toUpperCase()}${mode === 'booking' && minimumDp !== null && m === methods[0] ? ` (DP min. ${rupiah(minimumDp)})` : ''}`}><input required type="number" min={0} max={total > 0 ? total : undefined} step="1" value={nominal[m] ?? '0'} readOnly={mode === 'check_in' && methods.length === 1} onChange={event => setNominal(n => ({ ...n, [m]: event.target.value }))} onFocus={event => event.currentTarget.select()} className={fieldClass} /></Bidang>)}</div>{methods.length > 1 && <p className="ci-notice">{featureFlags.combinedPayment ? 'Dua metode dicatat dalam satu transaksi dengan riwayat pembayaran masing-masing.' : 'Pembayaran gabungan belum diaktifkan.'}</p>}</section>
              <section className="ci-pane"><h3><FileText />Ringkasan Pembayaran</h3><div className="ci-summary"><Baris k="Harga kamar" v={rupiah(selectedPrice)} /><Baris k={`Tamu tambahan (${extra.tambahan} × ${rupiah(extra.tarif)})`} v={rupiah(extra.total)} /><div className="ci-total"><span>Total Tagihan</span><span>{rupiah(total)}</span></div>{methods.map(m => <Baris key={m} k={`Dibayar ${m.toUpperCase()}`} v={rupiah(Math.max(0, Number(nominal[m]) || 0))} />)}<div className="ci-balance"><span>Sisa Tagihan</span><span>{rupiah(Math.max(0, total - paymentTotal))}</span></div></div>{mode === 'booking' && minimumDp !== null && <p className="ci-notice">Minimum DP {setting?.minimum_dp_mode === 'PERCENTAGE' ? `${Number(setting.minimum_dp_value)}%` : 'Owner'}: {rupiah(minimumDp)}</p>}{extra.tambahan > 0 && !extraGuestOn && <p className="ci-notice text-destructive">Biaya tamu tambahan belum dapat disimpan sistem, menunggu persetujuan Owner.</p>}</section></>}
            </div>
            {offer && <label className="ci-notice flex items-center gap-2">
              <input type="checkbox" checked={paymentVerified} onChange={event => setPaymentVerified(event.target.checked)} />
              Saya sudah memverifikasi pembayaran yang benar-benar diterima.
            </label>}
            {isOffer && <div className="rounded-2xl border border-[#ddc69b] bg-[#fffdf7] p-4 shadow-[0_4px_18px_rgba(40,30,13,0.07)]" aria-label="Ringkasan Reservasi"><p className="mb-3 text-[11px] font-bold uppercase tracking-[.12em] text-[#8c6a38]">Ringkasan Reservasi</p><div className="grid grid-cols-2 gap-3"><div><p className="text-xs text-[#7b6748]">Total Tagihan</p><strong className="mt-1 block font-serif text-lg tabular-nums text-[#33271a]">{quoteDayReady && selectedPrice > 0 ? rupiah(total) : '—'}</strong></div><div className="border-l border-[#e6d5b4] pl-3"><p className="text-xs text-[#7b6748]">Minimum DP</p><strong className="mt-1 block font-serif text-lg tabular-nums text-[#33271a]">{quoteDayReady && selectedPrice > 0 && quoteMinimumDp !== null ? rupiah(Math.ceil(quoteMinimumDp)) : '—'}</strong></div></div><p className="mt-3 border-t border-[#e7d7b7] pt-3 text-xs text-[#705b3d]">Nilai mengikuti tarif dan minimum DP resmi. Reservasi masuk antrean hingga pembayaran diverifikasi.</p></div>}
            {showQuote && !isOffer && !saving && <BookingQuote
              key={JSON.stringify([quoteDraft, roomId, packageId, quoteDayReady, quoteLoading, quoteLoadError])}
              draft={quoteDraft}
              dayReady={quoteDayReady}
              loading={quoteLoading}
              loadError={quoteLoadError}
            />}
            {!isOffer && isTraining && <p className="ci-notice">Training {trainingStatus === 'ACTIVE' ? 'aktif' : 'menunggu validasi'}: transaksi memakai sesi kas Owner/Supervisor yang ditugaskan.</p>}
            {!isOffer && selectedPrice > 0 && <p className="ci-notice">{activeSession ? 'Sesi kas aktif terhubung otomatis ke pembayaran.' : needsAssistedContext ? 'Sesi bantuan belum ditentukan. Buka halaman Keuangan untuk memilih konteks sesi aktif.' : 'Belum ada sesi kas aktif. Buka sesi sebelum mencatat pembayaran.'}</p>}
            {error && <p role="alert" className="ci-notice text-destructive">{error}</p>}
            <footer className="ci-footer"><p className="ci-reminder"><Info />{isOffer ? 'Kirim rincian harga dan lampiran QRIS resmi secara manual. Nomor TRX belum diterbitkan.' : 'Pastikan paket yang dipilih telah sesuai dengan waktu yang dibutuhkan'}</p><div className={isOffer ? 'ci-footer-actions max-w-full flex-wrap' : 'ci-footer-actions'}><Button type="button" variant="outline" disabled={saving} onClick={onClose}>Batal</Button><Button type="submit" disabled={saving || (isOffer ? quoteLoading : dataLoading) || selectedRoomUnavailable}>{saving ? 'Menyimpan…' : isOffer ? 'Simpan Reservasi & Buka WhatsApp' : offer ? 'Verifikasi Pembayaran & Terbitkan TRX' : mode === 'booking' ? 'Booking' : 'Check-in'}</Button></div></footer>
          </form>
        )}
      </div>
    </div>
  );
}

function Saran({ id, items, active, onPick }: { id: string; items: GuestSearchRow[]; active: number; onPick: (guest: GuestSearchRow) => void }) {
  if (!items.length) return null;
  return (
    <ul id={id} role="listbox" aria-label="Saran tamu" className="absolute left-0 right-0 top-full z-10 mt-1 max-h-52 overflow-y-auto rounded-xl border border-gold/25 bg-[var(--success-paper)] text-[var(--premium-ink)] shadow-lembut">
      {items.map((g, index) => (
        <li key={g.id} role="presentation">
          <button
            type="button"
            role="option"
            id={id + '-' + index}
            aria-selected={index === active}
            tabIndex={-1}
            onPointerDown={event => event.preventDefault()}
            onClick={() => onPick(g)}
            className={'flex w-full justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-[var(--premium-highlight)]' +
              (index === active ? ' bg-[var(--premium-highlight)]' : '')}
          >
            <span className="truncate font-semibold">{g.full_name}</span>
            <span className="font-mono text-xs text-muted-foreground">{g.phone}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Baris({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{k}</span><span>{v}</span></div>;
}
