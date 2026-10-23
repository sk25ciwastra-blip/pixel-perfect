import { expect, test } from 'bun:test';
import { biayaTamuTambahan } from '../src/lib/tamu-tambahan';

test('2 tamu tanpa biaya tambahan', () => expect(biayaTamuTambahan(2).total).toBe(0));
test('3 tamu dikenai Rp50.000', () => expect(biayaTamuTambahan(3).total).toBe(50_000));
test('5 tamu dikenai Rp150.000', () => expect(biayaTamuTambahan(5).total).toBe(150_000));
