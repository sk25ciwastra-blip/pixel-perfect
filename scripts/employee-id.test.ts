import { describe, expect, test } from 'bun:test';
import { nextEmployeeId } from '../src/lib/employee-id';

describe('ID karyawan asli Baturaden 25 Homestay', () => {
  test('starts at B25EMP-001 and ignores all historical DEMO namespaces', () => {
    expect(nextEmployeeId([])).toBe('B25EMP-001');
    expect(nextEmployeeId(['BTRDEMP-0001','BTRDEMP-0002','BTRDEMP-0003','KR-02','QA-RCP-01'])).toBe('B25EMP-001');
  });
  test('receptionist 001, supervisor 002, forward-only preview', () => {
    expect(nextEmployeeId(['B25EMP-001'])).toBe('B25EMP-002');
    expect(nextEmployeeId(['B25EMP-001', 'B25EMP-002'])).toBe('B25EMP-003');
    expect(nextEmployeeId(['B25EMP-099', 'B25EMP-002'])).toBe('B25EMP-100');
  });
  test('supports 1000+ IDs and does not reset per calendar year', () => {
    expect(nextEmployeeId(['B25EMP-999'])).toBe('B25EMP-1000');
    expect(nextEmployeeId(['B25EMP-1042','BTRDEMP-9999'])).toBe('B25EMP-1043');
  });
});
