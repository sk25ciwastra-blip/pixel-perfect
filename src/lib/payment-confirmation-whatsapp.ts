export type ConfirmationWhatsAppWindow = { navigate: (phone: string) => void; close: () => void };

/** Call directly from the click, before any await. No guest data enters this tab yet. */
export function reserveConfirmationWhatsAppWindow(): ConfirmationWhatsAppWindow {
  // noopener/noreferrer window features return null even on success. Retain the
  // blank handle for cancellation, sever opener before any external navigation.
  const popup = window.open('about:blank', '_blank');
  if (!popup) throw new Error('Popup WhatsApp diblokir. Izinkan popup lalu klik Buka WhatsApp kembali.');
  const close = () => { if (!popup.closed) popup.close(); };
  try {
    popup.opener = null;
    const policy = popup.document.createElement('meta');
    policy.name = 'referrer';
    policy.content = 'no-referrer';
    popup.document.head.appendChild(policy);
    popup.document.title = 'Menyiapkan WhatsApp';
    popup.document.body.textContent = 'Memverifikasi akses. Tutup tab ini untuk membatalkan.';
  } catch (error) { close(); throw error; }
  return {
    close,
    navigate(phone) {
      if (popup.closed) throw new Error('Tab WhatsApp sudah ditutup; klik Buka WhatsApp kembali.');
      if (!/^62\d{8,13}$/.test(phone)) throw new Error('Nomor WhatsApp belum valid.');
      // Navigate only this reserved tab; no second window.open, message or attachment.
      popup.location.replace(`https://web.whatsapp.com/send?phone=${phone}`);
    },
  };
}
