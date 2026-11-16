import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BedDouble, Box, CalendarDays, Check, ChevronDown, ChevronRight, FileText, Image, Layers, Printer, ShieldCheck, UserRoundPlus, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ReceiptTransactionButton } from '@/components/receipt-actions';
import { supabase } from '@/integrations/supabase/client';
import { usePaymentConfirmation } from '@/lib/use-payment-confirmation';
import { featureFlags } from '@/lib/feature-flags';
import { rupiah } from '@/lib/data-contoh';
import logoPopup from '@/assets/logo-popup-berhasil.png.asset.json';
import '@/components/check-in-berhasil.css';

export function CheckInBerhasil({ transactionNumber, room, roomType, packageName, onClose }: {
  transactionNumber: string; room: string; roomType: string; packageName: string; onClose: () => void;
}) {
  const hook = usePaymentConfirmation();
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const result = useQuery({
    queryKey: ['check-in-result', transactionNumber],
    queryFn: async () => {
      const { data, error } = await supabase.from('transactions')
        .select('id,transaction_number,started_at,guest_count,extra_guest_count,price_snapshot')
        .eq('transaction_number', transactionNumber).single();
      if (error) throw error;
      return data;
    },
  });
  const t = result.data;
  const date = t?.started_at ? new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(t.started_at)) : '—';
  const time = t?.started_at ? new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(t.started_at)) + ' WIB' : '';
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
    { icon: CalendarDays, label: 'Check-in', value: `${date}${time ? ` · ${time}` : ''}` },
    { icon: Users, label: 'Jumlah Tamu', value: t ? `${t.guest_count} Orang` : '—' },
    { icon: UserRoundPlus, label: 'Tamu Tambahan', value: t ? `${t.extra_guest_count} Orang` : '—' },
  ];
  return <div className="cib-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="cib-popup" role="dialog" aria-modal="true" aria-labelledby="cib-title">
      <Button type="button" variant="ghost" size="icon" className="cib-close" aria-label="Tutup" onClick={onClose}><X className="size-4" /></Button>
      <div className="cib-logo"><img src={logoPopup.url} alt="Baturaden 25 Homestay — MANAJEMEN" /></div>
      <div className="cib-check-wrap"><svg className="cib-rays" viewBox="0 0 26 50" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M16 3l8 7M2 20l12 3M1 32l13-3M15 44l8-8" /></svg><span className="cib-check"><Check /></span><svg className="cib-rays" viewBox="0 0 26 50" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M16 3l8 7M2 20l12 3M1 32l13-3M15 44l8-8" /></svg></div>
      <h2 id="cib-title">Check-in Berhasil!</h2><p className="cib-subtitle">Transaksi berhasil disimpan.</p>
      <div className="cib-number"><FileText />{transactionNumber}</div>
      <dl className="cib-details">{rows.map(({ icon: Icon, label, value }) => <div className="cib-row" key={label}><Icon /><dt>{label}</dt><span>:</span><dd>{value}</dd></div>)}</dl>
      {result.isError && <p className="cib-message" role="alert">Check-in sudah berhasil; rincian belum dapat dimuat. <Button type="button" variant="link" onClick={() => void result.refetch()}>Muat ulang rincian</Button></p>}
      <div className="cib-total"><Layers /><span>Total Pembayaran</span><strong>{t ? rupiah(Number(t.price_snapshot)) : '—'}</strong></div>
      <div className="cib-actions">
        {featureFlags.receipt58mm ? <div className="cib-print"><ReceiptTransactionButton transactionNumber={transactionNumber} label="Cetak Struk" /></div> : <Button type="button" variant="outline" className="cib-print" disabled title="Cetak struk 58 mm belum diaktifkan"><Printer /><span><b>Cetak Struk</b><small>Thermal 58 mm</small></span></Button>}
        <Popover open={menu} onOpenChange={setMenu}><PopoverTrigger asChild><Button type="button" className="cib-digital" disabled={!t || !hook.pdfAvailable}><FileText /><span><b>Bukti Digital</b><small>Kirim PDF atau JPG</small></span><ChevronDown className="size-4" /></Button></PopoverTrigger>
          <PopoverContent className="cib-digital-menu" side="right" align="end" sideOffset={16}>
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
    </section>
  </div>;
}