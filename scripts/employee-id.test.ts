import { describe, expect, test } from 'bun:test';
import { nextEmployeeId } from '../src/lib/employee-id';

describe('ID karyawan', () => {
  test('starts with the requested BTRDEMP-0001 format', () => {
    expect(nextEmployeeId([])).toBe('BTRDEMP-0001');
    expect(nextEmployeeId(['KR-2026-0001'])).toBe('BTRDEMP-0001');
  });
  test('continues the stored sequence without year resets', () => {
    expect(nextEmployeeId(['BTRDEMP-0003', 'BTRDEMP-0001'])).toBe('BTRDEMP-0004');
    expect(nextEmployeeId(['BTRDEMP-9999'])).toBe('BTRDEMP-10000');
  });
});