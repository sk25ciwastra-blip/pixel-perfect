import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { validateEmployeePhoto, employeePhotoPath, EMPLOYEE_PHOTO_MAX_BYTES } from '../src/lib/employee-photo';

const path = 'e194b6ba-1c7a-4a23-9433-f53599cf44a1';

describe('Baturaden 25 Homestay employee photo rules', () => {
  test('accepts JPEG, PNG and WebP', () => {
    for (const type of ['image/jpeg','image/png','image/webp']) {
      expect(validateEmployeePhoto({ type, size: 2000 })).toBeNull();
    }
  });
  test('accepts exactly 2 MiB', () => {
    expect(validateEmployeePhoto({ type:'image/jpeg', size: EMPLOYEE_PHOTO_MAX_BYTES })).toBeNull();
  });
  test('rejects oversize, empty and invalid formats', () => {
    expect(validateEmployeePhoto({ type:'image/png', size: EMPLOYEE_PHOTO_MAX_BYTES+1 })).toContain('2 MB');
    expect(validateEmployeePhoto({ type:'image/png', size: 0 })).toContain('2 MB');
    expect(validateEmployeePhoto({ type:'application/pdf', size: 400 })).toContain('JPG');
  });
  test('photo names use employee database UUID, never user supplied filename', () => {
    expect(employeePhotoPath(path,'image/jpeg')).toBe(path+'.jpg');
    expect(employeePhotoPath(path,'image/png')).toBe(path+'.png');
    expect(employeePhotoPath(path,'image/webp')).toBe(path+'.webp');
    expect(() => employeePhotoPath('../outside','image/jpeg')).toThrow();
    expect(() => employeePhotoPath(path,'image/svg+xml')).toThrow();
  });
  test('employee form allows upload in edit mode', () => {
    const form = readFileSync('src/components/form-karyawan.tsx','utf8');
    expect(form).toContain('disabled={busy} ref={fileRef}');
    expect(form).toContain('disabled={busy} type="button" className="fk-unggah"');
    expect(form).toContain('if (foto) {');
    expect(form).not.toContain('if (!item && foto && id)');
    expect(form).toContain("...(photo_path ? { photo_path } : {})");
  });
  test('registration retry reuses created ID instead of generating another account', () => {
    const form = readFileSync('src/components/form-karyawan.tsx','utf8');
    expect(form).toContain('createdEmployeeIdRef.current ?? undefined');
    expect(form).toContain('} else if (!id) {');
    expect(form).toContain('createdEmployeeIdRef.current = id');
  });
  test('form reports upload errors in photo area', () => {
    const form = readFileSync('src/components/form-karyawan.tsx','utf8');
    expect(form).toContain('setFotoError');
    expect(form).toContain('{fotoError && <p role="alert"');
    expect(form).toContain('createSignedUrl(data.photo_path, 60)');
  });
});
