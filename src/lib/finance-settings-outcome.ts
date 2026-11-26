import type { ActionResultState } from '@/components/action-result-dialog';

/**
 * Pure orchestration of UI feedback for the two existing, non-atomic finance RPCs.
 *
 * The caller owns authorization, the exact DP/commission RPCs and validation.
 * These callbacks may be replaced with in-memory stubs in regression tests.
 *
 * Important: "success" below confirms acknowledgement plus successful refresh;
 * it is NOT a claim that values were independently compared to the database.
 */
export type FinanceSaveActionResult = {
  error?: { message: string } | null;
  partial?: boolean;
  validationError?: string;
};

type FinanceOutcomeOptions = {
  action: () => Promise<FinanceSaveActionResult>;
  refreshFinance: () => Promise<unknown>;
  refreshCommission: () => Promise<unknown>;
  successLabel: string;
};

async function rereadFinanceSettings(options: FinanceOutcomeOptions): Promise<boolean> {
  const results = await Promise.allSettled([
    options.refreshFinance(),
    options.refreshCommission(),
  ]);
  return results.every(result => result.status === 'fulfilled');
}

export async function resolveFinanceSettingsOutcome(options: FinanceOutcomeOptions): Promise<ActionResultState> {
  try {
    // Call the existing action exactly once. It owns the order of the two RPCs.
    const result = await options.action();
    if (result.error) {
      if (result.partial) {
        const refreshed = await rereadFinanceSettings(options);
        return {
          kind: 'error',
          title: 'Konfigurasi tersimpan sebagian',
          description: refreshed
            ? 'Minimum DP berhasil disimpan, tetapi komisi belum berhasil diperbarui. Periksa kedua pengaturan sebelum mengulangi penyimpanan.'
            : 'Minimum DP sudah diterima sistem, tetapi pembaruan komisi bermasalah dan data terbaru belum dapat diperiksa. Periksa kedua pengaturan sebelum menyimpan ulang.',
        };
      }
      return {
        kind: 'error',
        title: result.validationError ? 'Nilai pengaturan belum valid' : 'Konfigurasi belum dapat disimpan',
        description: result.validationError ??
          'Sistem belum dapat mengonfirmasi penyimpanan Minimum DP. Periksa pengaturan yang berlaku sebelum mencoba kembali.',
      };
    }

    const refreshed = await rereadFinanceSettings(options);
    if (!refreshed) {
      return {
        kind: 'error',
        title: 'Periksa kembali konfigurasi',
        description: 'Kedua penyimpanan diterima sistem, tetapi hasil terbaru belum dapat dibaca sepenuhnya. Periksa Minimum DP dan komisi sebelum menyimpan ulang.',
      };
    }
    return {
      kind: 'success',
      title: options.successLabel,
      description: 'Pengaturan Minimum DP dan komisi telah disimpan, dan data terbaru berhasil dimuat ulang.',
    };
  } catch {
    return {
      kind: 'error',
      title: 'Hasil penyimpanan belum dapat dipastikan',
      description: 'Terjadi gangguan saat memproses konfigurasi. Sebagian perubahan mungkin sudah tersimpan. Periksa Minimum DP dan komisi sebelum mencoba kembali.',
    };
  }
}
