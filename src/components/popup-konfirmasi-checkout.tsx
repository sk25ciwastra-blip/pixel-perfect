import * as Dialog from '@radix-ui/react-dialog';
import { BedDouble, Brush, FileText, LogOut, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoPopup from '@/assets/logo-popup-wordmark.png.asset.json';
import '@/components/check-in-berhasil.css';
import '@/components/popup-konfirmasi-checkout.css';

/** Branded confirmation; never performs a checkout by itself. */
export function PopupKonfirmasiCheckOut({ roomNumber, guestName, transactionNumber, processing, trigger, onCancel, onConfirm }: {
  roomNumber: string; guestName: string; transactionNumber: string;
  processing: boolean; trigger: HTMLButtonElement | null;
  onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open && !processing) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="cib-overlay" />
        <Dialog.Content
          className="cib-popup checkout-confirm-popup"
          onCloseAutoFocus={(event) => {
            if (trigger?.isConnected) {
              event.preventDefault();
              trigger.focus();
            }
          }}
          onEscapeKeyDown={(event) => { if (processing) event.preventDefault(); }}
          onPointerDownOutside={(event) => { if (processing) event.preventDefault(); }}
        >
          <div className="cib-logo">
            <img src={logoPopup.url} alt="Baturaden 25 Homestay" />
            <div className="cib-manajemen" aria-hidden="true"><span /><b>MANAGEMENT</b><span /></div>
          </div>
          <div className="cib-check-wrap">
            <span className="cib-check checkout-confirm-icon"><LogOut aria-hidden="true" /></span>
          </div>
          <Dialog.Title>Konfirmasi Check-out</Dialog.Title>
          <Dialog.Description className="cib-subtitle">
            Periksa kembali rincian transaksi sebelum Check-out.
          </Dialog.Description>
          <div className="cib-number"><FileText aria-hidden="true" />{transactionNumber}</div>
          <dl className="cib-details">
            <div className="cib-row"><BedDouble /><dt>Kamar</dt><span>:</span><dd>{roomNumber}</dd></div>
            <div className="cib-row"><FileText /><dt>Nama Tamu</dt><span>:</span><dd>{guestName}</dd></div>
            <div className="cib-row"><Brush /><dt>Setelah Check-out</dt><span>:</span><dd>Housekeeping</dd></div>
          </dl>
          <p className="cib-reminder"><ShieldAlert aria-hidden="true" />Kamar akan masuk alur Housekeeping setelah Check-out berhasil.</p>
          <div className="cib-actions checkout-confirm-actions">
            <Button type="button" className="cib-digital" onClick={onCancel} disabled={processing}>Batal</Button>
            <Button type="button" className="cib-print" onClick={onConfirm} disabled={processing} aria-busy={processing}>
              {processing ? "Memproses…" : "Konfirmasi Check-out"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
