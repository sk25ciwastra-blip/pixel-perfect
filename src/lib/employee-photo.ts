/** Owner-only employee photo contract; mirrors the private Storage bucket's 2 MiB limit. */
export const EMPLOYEE_PHOTO_MAX_BYTES = 2 * 1024 * 1024;

export function validateEmployeePhoto(file: { type: string; size: number }): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size <= 0 || file.size > EMPLOYEE_PHOTO_MAX_BYTES) {
    return 'Foto harus JPG, PNG, atau WebP, berukuran lebih dari 0 byte dan maksimal 2 MB.';
  }
  return null;
}

export function employeePhotoPath(employeeRecordId: string, contentType: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(employeeRecordId)) {
    throw new Error('ID data karyawan tidak valid.');
  }
  const extension = contentType === 'image/jpeg' ? 'jpg'
    : contentType === 'image/png' ? 'png'
    : contentType === 'image/webp' ? 'webp'
    : null;
  if (!extension) throw new Error('Format foto tidak didukung.');
  return `${employeeRecordId}.${extension}`;
}
