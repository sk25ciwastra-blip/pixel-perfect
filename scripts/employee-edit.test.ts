import { expect, test } from 'bun:test';
import { employeeEditProfile } from '../src/lib/employee-edit';
test('edit submits only address and emergency contact, excluding locked fields', () => {
  expect(employeeEditProfile({ address: 'Alamat baru', emergency_name: 'Kontak', emergency_relation: 'Saudara', emergency_phone: '081234567890', ...{ nik: '1234567890123456', phone: '089876543210', photo_path: 'foto.png', birth_place: 'Bandung', gender: 'Laki-laki' } })).toEqual({ address: 'Alamat baru', emergency_name: 'Kontak', emergency_relation: 'Saudara', emergency_phone: '081234567890' });
});