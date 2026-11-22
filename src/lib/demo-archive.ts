type ArchiveMetadata = { demo_archived_at?: string | null };

export function transaksiBelumDiarsipkan(row: ArchiveMetadata) {
  return !row.demo_archived_at;
}

export function nomorDenganArsip(row: ArchiveMetadata & { transaction_number: string }) {
  return row.demo_archived_at ? `${row.transaction_number} · Arsip DEMO` : row.transaction_number;
}

// The feature's SQL is pending. Only the pre-migration missing-column error
// permits the legacy read. Permission, network and other failures propagate.
export async function bacaTransaksiOperasional<T extends { error: { code: string; message: string } | null }>(
  baca: (filterArsip: boolean) => PromiseLike<T>,
): Promise<T> {
  const result = await baca(true);
  if (result.error?.code === '42703' && result.error.message.includes('demo_archived_at')) {
    return baca(false);
  }
  return result;
}
