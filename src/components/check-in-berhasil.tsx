import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BedDouble, Box, CalendarDays, Check, ChevronDown, ChevronRight, FileText, Image, Layers, Printer, ShieldCheck, UserRoundPlus, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ReceiptTransactionButton } from '@/components/receipt-actions';
import { supabase } from '@/integrations/supabase/client';
import { usePaymentConfirmation } from '@/lib/use-payment-confirmation';
import { featureFlags } from '@/lib/feature-flags';
import { rupiah } from '@/lib/data-contoh';
import logoPopup from '@/assets/logo-popup-wordmark.png.asset.json';
import '@/components/check-in-berhasil.css';

export function PopupBerhasil({ title, subtitle, number, children, onClose }: {
  title: string; subtitle: string; number: string; children: ReactNode; onClose: () => void;
}) {
  return <div className="cib-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="cib-popup" role="dialog" aria-modal="true" aria-labelledby="cib-title">
      <Button type="button" variant="ghost" size="icon" className="cib-close" aria-label="Tutup" onClick={onClose}><X className="size-4" /></Button>
      <div className="cib-logo">
        <img src={logoPopup.url} alt="Baturaden 25 Homestay" />
        <div className="cib-manajemen" aria-hidden="true"><span /><b>MANAGEMENT</b><span /></div>
      </div>
      <div className="cib-check-wrap"><svg className="cib-rays" viewBox="0 0 26 50" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M16 3l8 7M2 20l12 3M1 32l13-3M15 44l8-8" /></svg><span className="cib-check"><Check /></span><svg className="cib-rays" viewBox="0 0 26 50" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M16 3l8 7M2 20l12 3M1 32l13-3M15 44l8-8" /></svg></div>
      <h2 id="cib-title">{title}</h2><p className="cib-subtitle">{subtitle}</p>
      {number && <div className="cib-number"><FileText />{number}</div>}
      {children}
    </section>
  </div>;
}

export function CheckInBerhasil({ transactionNumber, room, roomType, packageName, onClose, mode = 'check_in' }: {
  transactionNumber: string; room: string; roomType: string; packageName: string; onClose: () => void; mode?: 'check_in' | 'booking';
}) {
  const hook = usePaymentConfirmation();
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState('');
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)');
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const [message, setMessage] = useState('');
  const result = useQuery({
    queryKey: ['check-in-result', transactionNumber],
    queryFn: async () => {
      const { data, error } = await supabase.from('transactions')
        .select('id,transaction_number,started_at,scheduled_check_in,guest_count,extra_guest_count,price_snapshot')
        .eq('transaction_number', transactionNumber).single();
      if (error) throw error;
      return data;
    },
  });
  const t = result.data;
  const booking = mode === 'booking';
  const payments = useQuery({
    queryKey: ['check-in-result-payments', t?.id],
    enabled: booking && !!t,
    queryFn: async () => {
      const { data, error } = await supabase.from('payments').select('amount,kind').eq('transaction_id', t!.id);
      if (error) throw error;
      return data;
    },
  });
  const dpDiterima = (payments.data ?? []).filter(p => p.kind === 'dp').reduce((sum, p) => sum + Number(p.amount), 0);
  const timestamp = booking ? t?.scheduled_check_in : t?.started_at;
  const date = timestamp ? new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(timestamp)) : '—';
  const time = timestamp ? new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(timestamp)) + ' WIB' : '';
  const download = async (format: 'pdf' | 'jpg') => {
    if (!t || busy) return;
    setBusy(format); setMessage('');
    try {
      if (format === 'pdf') await hook.download(t.id); else await hook.downloadJpg(t.id);
      setMessage(`${format.toUpperCase()} berhasil diunduh. Lampirkan berkas secara manual melalui WhatsApp.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Bukti pembayaran belum dapat diunduh.'); }
    finally { setBusy(''); }
  };
  const rows = [
    { icon: BedDouble, label: 'Kamar / Tipe', value: `${room} / ${roomType}` },
    { icon: Box, label: 'Paket', value: packageName },
    { icon: CalendarDays, label: booking ? 'Jadwal Check-in' : 'Check-in', value: `${date}${time ? ` · ${time}` : ''}` },
    { icon: Users, label: 'Jumlah Tamu', value: t ? `${t.guest_count} Orang` : '—' },
    { icon: UserRoundPlus, label: 'Tamu Tambahan', value: t ? `${t.extra_guest_count} Orang` : '—' },
  ];
  return <PopupBerhasil title={booking ? 'Booking Berhasil!' : 'Check-in Berhasil!'} subtitle={booking ? 'Reservasi berhasil disimpan.' : 'Transaksi berhasil disimpan.'} number={transactionNumber} onClose={onClose}>
      <dl className="cib-details">{rows.map(({ icon: Icon, label, value }) => <div className="cib-row" key={label}><Icon /><dt>{label}</dt><span>:</span><dd>{value}</dd></div>)}</dl>
      {result.isError && <p className="cib-message" role="alert">{booking ? 'Booking' : 'Check-in'} sudah berhasil; rincian belum dapat dimuat. <Button type="button" variant="link" onClick={() => void result.refetch()}>Muat ulang rincian</Button></p>}
      <div className="cib-total"><Layers /><span>{booking ? 'DP Diterima' : 'Total Pembayaran'}</span><strong>{booking ? (payments.data ? rupiah(dpDiterima) : '—') : (t ? rupiah(Number(t.price_snapshot)) : '—')}</strong></div>
      <div className="cib-actions">
        {featureFlags.receipt58mm ? <div className="cib-print"><ReceiptTransactionButton transactionNumber={transactionNumber} label="Cetak Struk" /></div> : <Button type="button" variant="outline" className="cib-print" disabled title="Cetak struk 58 mm belum diaktifkan"><Printer /><span><b>Cetak Struk</b><small>Thermal 58 mm</small></span></Button>}
        <Popover open={menu} onOpenChange={setMenu}><PopoverTrigger asChild><Button type="button" className="cib-digital" disabled={!t || !hook.pdfAvailable}><FileText /><span><b>Bukti Digital</b><small>Kirim PDF atau JPG</small></span><ChevronDown className="size-4" /></Button></PopoverTrigger>
          <PopoverContent className="cib-digital-menu" side={mobile ? 'bottom' : 'right'} align={mobile ? 'center' : 'end'} sideOffset={mobile ? 10 : 16}>
            <div className="cib-menu-heading"><FileText /><h3>Bukti Digital</h3><Button type="button" variant="ghost" size="icon" aria-label="Tutup pilihan bukti" onClick={() => setMenu(false)}><X className="size-4" /></Button></div>
            <p>Pilih format bukti pembayaran untuk dikirim kepada tamu.</p>
            <Button type="button" variant="outline" className="cib-format cib-format-pdf" disabled={!!busy} onClick={() => void download('pdf')}><FileText /><span><b>{busy === 'pdf' ? 'Menyiapkan…' : 'Unduh PDF'}</b><small>Format dokumen (PDF)</small></span><ChevronRight /></Button>
            <Button type="button" variant="outline" className="cib-format cib-format-jpg" disabled={!!busy} onClick={() => void download('jpg')}><Image /><span><b>{busy === 'jpg' ? 'Menyiapkan…' : 'Unduh JPG'}</b><small>Format gambar (JPG)</small></span><ChevronRight /></Button>
            <p>Unduh bukti pembayaran dalam format PDF atau JPG, lalu bagikan kepada tamu melalui WhatsApp.</p>
            {message && <p role="status">{message}</p>}
          </PopoverContent>
        </Popover>
      </div>
      <p className="cib-reminder"><ShieldCheck />Pastikan setiap tamu menerima bukti pembayaran resmi, baik dalam bentuk digital maupun struk cetak.</p>
  </PopupBerhasil>;
}