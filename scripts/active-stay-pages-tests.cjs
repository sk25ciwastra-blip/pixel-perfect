// Isolated functional checks: no Cloud, credentials, booking or old PASS suites.
const assert = require("node:assert/strict");
const { loadActiveStayPages } = require("../src/lib/active-stay-pages.ts");

async function run() {
  for (const size of [0, 1, 199, 200, 201, 1001]) {
    const source = Array.from({ length: size }, (_, i) => ({ id: i }));
    const calls = [];
    const result = await loadActiveStayPages(async (start, end) => {
      calls.push([start, end]);
      return { data: source.slice(start, end + 1), error: null };
    });
    assert.deepEqual(result, source);
    assert.equal(calls.length, Math.floor(size / 200) + 1);
    for (const [i, [start, end]] of calls.entries()) {
      assert.equal(start, i * 200);
      assert.equal(end, start + 199);
    }
  }
  await assert.rejects(
    loadActiveStayPages(async (start, end) =>
      start >= 200 ? { data: null, error: { message: "second page failed" } } :
      { data: Array.from({ length: end - start + 1 }, (_, i) => i), error: null },
    ),
    /second page failed/,
  );
  await assert.rejects(loadActiveStayPages(async () => ({ data: null, error: null })), /tidak tersedia/);
  await assert.rejects(loadActiveStayPages(async () => ({ data: [], error: null }), 0), /Ukuran halaman/);
  console.log("PASS active stay pagination 0/1/199/200/201/1001, exact page boundaries, partial fetch failure, null response, invalid size");
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
