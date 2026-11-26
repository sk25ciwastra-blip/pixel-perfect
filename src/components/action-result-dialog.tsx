import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { CircleCheck, CircleX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type ActionResultState = {
  kind: 'success' | 'error';
  title: string;
  description: string;
};

type ActionResultDialogProps = {
  result: ActionResultState | null;
  onClose: () => void;
};

/**
 * Result of an action that has already run. Do not use for confirmation before
 * delete/refund/checkout, or for the existing booking/check-in receipt flow.
 * The caller owns server acknowledgement and uncertain-result handling.
 */
export function ActionResultDialog({ result, onClose }: ActionResultDialogProps) {
  const success = result?.kind === 'success';
  const Icon = success ? CircleCheck : CircleX;

  return (
    <AlertDialogPrimitive.Root open={result !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <AlertDialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[71] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto max-h-[90dvh] rounded-2xl border border-[#d7bf86] bg-[#faf5e9] px-6 pb-6 pt-7 text-[#241e17] shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b68a38]">
          <div className="flex flex-col items-center text-center">
            <span className={`mb-4 flex size-16 items-center justify-center rounded-full border-2 ${success ? 'border-emerald-600/30 bg-emerald-50 text-emerald-700' : 'border-rose-600/30 bg-rose-50 text-rose-700'}`}>
              <Icon className="size-9" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#977334]">Baturaden 25 Homestay</p>
            <AlertDialogPrimitive.Title className="font-serif text-xl font-bold leading-snug">
              {result?.title ?? ''}
            </AlertDialogPrimitive.Title>
            <AlertDialogPrimitive.Description className="mt-3 text-sm leading-relaxed text-[#665b49]">
              {result?.description ?? ''}
            </AlertDialogPrimitive.Description>
            <div className="mt-6 h-px w-full bg-gradient-to-r from-transparent via-[#d7bf86] to-transparent" aria-hidden="true" />
            <AlertDialogPrimitive.Cancel asChild>
              <Button type="button" className="mt-5 w-full">
                Tutup
              </Button>
            </AlertDialogPrimitive.Cancel>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
