/** Read all pages of RLS-visible active stays; never accept a partial response. */
export async function loadActiveStayPages<T>(
  readPage: (start: number, end: number) => Promise<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 200,
): Promise<T[]> {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) throw new Error("Ukuran halaman tidak sah");
  const rows: T[] = [];
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await readPage(start, start + pageSize - 1);
    if (error) throw new Error(error.message);
    if (data === null) throw new Error("Respons data hunian aktif tidak tersedia");
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}
