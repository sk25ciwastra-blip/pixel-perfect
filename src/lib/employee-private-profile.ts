/** Private employee enrollment contract. Do not log or expose raw NIK/contact data. */
export type EmployeePrivateProfile = {
  nik: string;
  phone: string;
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
};

export function validateEmployeePrivateProfile(profile: EmployeePrivateProfile): EmployeePrivateProfile {
  // NIK is a string; leading zeros are significant.
  if (!/^[0-9]{16}$/.test(profile.nik)) throw new Error("NIK harus tepat 16 digit angka");
  const phone = profile.phone.trim();
  const emergencyPhone = profile.emergencyPhone.trim();
  if (!/^\+?[0-9]{9,15}$/.test(phone) || !/^\+?[0-9]{9,15}$/.test(emergencyPhone)) {
    throw new Error("Nomor telepon harus 9–15 digit angka");
  }
  const emergencyName = profile.emergencyName.trim();
  const emergencyRelationship = profile.emergencyRelationship.trim();
  if (emergencyName.length < 2 || emergencyName.length > 100 ||
      emergencyRelationship.length < 2 || emergencyRelationship.length > 60) {
    throw new Error("Kontak darurat belum lengkap");
  }
  return { nik: profile.nik, phone, emergencyName, emergencyRelationship, emergencyPhone };
}

export function maskNik(nik: string): string {
  if (!/^[0-9]{16}$/.test(nik)) return "••••";
  return `•••• •••• •••• ${nik.slice(-4)}`;
}

export const FACE_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const FACE_PHOTO_MAX_BYTES = 2 * 1024 * 1024;

export function validateFacePortraitFile(file: { type: string; size: number }): void {
  if (!FACE_PHOTO_TYPES.includes(file.type as typeof FACE_PHOTO_TYPES[number]) ||
      !Number.isFinite(file.size) || file.size < 1 || file.size > FACE_PHOTO_MAX_BYTES) {
    throw new Error("Pas foto wajah harus JPG, PNG atau WebP dengan ukuran maksimal 2 MB");
  }
  // MIME/size are only preliminary checks; server must verify actual file bytes.
}
