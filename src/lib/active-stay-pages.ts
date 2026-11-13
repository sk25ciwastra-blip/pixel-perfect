/** Read all pages of RLS-visible active stays; never accept a partial response. */
export async function loadActiveStayPages<T>(
  readPage: (start: number, end: number) => Promise<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 200,
  getKey?: (row: T) => string,
): Promise<T[]> {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) throw new Error("Ukuran halaman tidak sah");
  const rows: T[] = [];
  const seen = new Set<string>();
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await readPage(start, start + pageSize - 1);
    if (error) throw new Error(error.message);
    if (data === null) throw new Error("Respons data hunian aktif tidak tersedia");
    if (data.length > pageSize) throw new Error("Respons halaman hunian melebihi batas");
    if (getKey) {
      for (const row of data) {
        const key = getKey(row);
        if (!key || seen.has(key)) throw new Error("Data hunian berubah selama pembacaan; muat ulang");
        seen.add(key);
      }
    }
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}
