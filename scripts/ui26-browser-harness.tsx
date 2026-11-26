import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ActionResultDialog, type ActionResultState } from '@/components/action-result-dialog';
import '@/styles.css';

// This file is only loaded by qa/ui26-popup.html through the dedicated
// localhost-only Vite config. It imports no auth, network, Supabase, or RPCs.
function SyntheticPopupHarness() {
  const [result, setResult] = useState<ActionResultState | null>(null);
  return (
    <main className="min-h-dvh bg-[#090a0b] p-5 font-sans text-[#f5eee0]">
      <section className="mx-auto max-w-xl space-y-5 rounded-xl border border-[#b68a38] p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-[#f2d184]">Baturaden 25 Homestay · Uji Sintetis</p>
        <h1 className="font-serif text-2xl">Uji Interaksi Popup Berhasil / Gagal</h1>
        <p className="text-sm">Hanya data simulasi. Tidak ada login, transaksi, atau penyimpanan database.</p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-lg bg-[#dcb45f] px-4 py-2 font-semibold text-black"
            onClick={() => setResult({
              kind: 'success',
              title: 'Rekening berhasil ditambahkan',
              description: 'Ini data simulasi; sistem operasional tidak diubah.',
            })}
          >
            Uji sukses
          </button>
          <button
            type="button"
            className="rounded-lg border border-[#e8a6a6] px-4 py-2 font-semibold"
            onClick={() => setResult({
              kind: 'error',
              title: 'Konfigurasi belum dapat disimpan',
              description: 'Hasil uji sintetis: periksa data sebelum mencoba kembali.',
            })}
          >
            Uji gagal
          </button>
        </div>
        <p aria-live="polite">Status popup: <output data-testid="modal-state">{result ? result.kind : 'tertutup'}</output></p>
        <input aria-label="Kolom di luar popup" className="w-full rounded border p-2 text-black" placeholder="Hanya untuk uji fokus modal" />
      </section>
      <ActionResultDialog result={result} onClose={() => setResult(null)} />
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Synthetic popup harness root not found');
createRoot(root).render(<SyntheticPopupHarness />);
