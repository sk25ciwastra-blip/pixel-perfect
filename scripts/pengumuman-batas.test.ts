import { expect, test } from "bun:test";
import { MAKS_HURUF, rapikanTeks, bolehDisimpan } from "../src/lib/pengumuman-batas.mjs";

test("batas teks pengumuman 140 karakter", () => {
  expect(MAKS_HURUF).toBe(140);
});
test("tepat 140 karakter boleh disimpan, 141 ditolak", () => {
  expect(bolehDisimpan("a".repeat(140))).toBe(true);
  expect(bolehDisimpan("a".repeat(141))).toBe(false);
});
test("pengumuman kosong tidak boleh disimpan", () => {
  expect(bolehDisimpan("")).toBe(false);
  expect(bolehDisimpan("   \n  ")).toBe(false);
});
test("baris baru digabung menjadi spasi", () => {
  expect(rapikanTeks("kamar\ntamu")).toBe("kamar tamu");
  expect(rapikanTeks("a\n\nb")).toBe("a b");
});
test("hitung batas dilakukan setelah baris baru digabung", () => {
  expect(bolehDisimpan("a".repeat(138) + "\n\nb")).toBe(true);
  expect(bolehDisimpan("a".repeat(139) + "\n\nb")).toBe(false);
});
