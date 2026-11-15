/** Rasterizes the confirmation PDF into a single JPG; browser-only, loaded dynamically. */
export async function confirmationPdfToJpg(pdfBytes: Uint8Array): Promise<Blob> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const pdf = await pdfjs.getDocument({ data: pdfBytes }).promise;
  const scale = 2;
  const gap = 24;
  const canvases: HTMLCanvasElement[] = [];
  let width = 0;
  let height = 0;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
    canvases.push(canvas);
    width = Math.max(width, canvas.width);
    height += canvas.height;
  }
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height + gap * (canvases.length - 1);
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  let y = 0;
  for (const canvas of canvases) {
    ctx.drawImage(canvas, 0, y);
    y += canvas.height + gap;
  }
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/jpeg', 0.92));
  if (!blob) throw new Error('Gambar JPG tidak dapat dibuat.');
  return blob;
}

export function downloadConfirmationJpg(blob: Blob, transactionNumber: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Payment-Confirmation-${transactionNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`;
  document.body.appendChild(anchor);
  try { anchor.click(); } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
}
