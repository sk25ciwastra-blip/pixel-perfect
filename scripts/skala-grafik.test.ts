import { expect, test } from "bun:test";
import { skalaAdaptif, posisiSkala, skalaGrafik, labelJuta } from "../src/lib/skala-grafik";

test("skala harian 0, 1M, 3M, 6M", () => {
  expect(skalaGrafik.harian.map(labelJuta)).toEqual(["0", "1M", "3M", "6M"]);
});
test("skala mingguan 0, 5M, 10M, 20M", () => {
  expect(skalaGrafik.mingguan.map(labelJuta)).toEqual(["0", "5M", "10M", "20M"]);
});
test("skala bulanan 0, 40M, 60M, 100M", () => {
  expect(skalaGrafik.bulanan.map(labelJuta)).toEqual(["0", "40M", "60M", "100M"]);
});
test("nilai di garis bantu jatuh tepat pada garisnya", () => {
  expect(posisiSkala(3_000_000, skalaGrafik.harian)).toBeCloseTo(2 / 3);
  expect(posisiSkala(2_000_000, skalaGrafik.harian)).toBeCloseTo(0.5);
  expect(posisiSkala(9_000_000, skalaGrafik.harian)).toBe(1);
});
test("data di atas batas menambah garis bantu", () => {
  expect(skalaAdaptif(skalaGrafik.harian, 7_400_000)).toEqual([0, 1_000_000, 3_000_000, 6_000_000, 8_000_000]);
  expect(skalaAdaptif(skalaGrafik.harian, 5_000_000)).toEqual(skalaGrafik.harian);
});
