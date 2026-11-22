/** Baturaden 25 Homestay: perubahan password akun sendiri, bukan administrasi akun staf lain. */
export type PasswordFields = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type AuthErrorLike = { message: string; code?: string | undefined; status?: number | undefined } | null;
type AuthUserLike = { id: string; email?: string | null } | null;

export type OwnPasswordAuth = {
  getUser: () => Promise<{ data: { user: AuthUserLike }; error: AuthErrorLike }>;
  signInWithPassword: (credentials: { email: string; password: string }) => Promise<{
    data: { user: AuthUserLike };
    error: AuthErrorLike;
  }>;
  updateUser: (attributes: { password: string; current_password: string }) => Promise<{
    error: AuthErrorLike;
  }>;
};

export type PasswordChangeResult = { ok: boolean; message: string };

export function validatePasswordFields(values: PasswordFields): string | null {
  if (!values.currentPassword || !values.newPassword || !values.confirmPassword) {
    return 'Lengkapi password saat ini, password baru, dan konfirmasi password.';
  }
  if (values.newPassword.length < 8) {
    return 'Password baru minimal 8 karakter.';
  }
  if (values.newPassword !== values.confirmPassword) {
    return 'Konfirmasi password baru tidak sama.';
  }
  if (values.newPassword === values.currentPassword) {
    return 'Password baru harus berbeda dari password saat ini.';
  }
  return null;
}

/**
 * Never render arbitrary Auth messages: they can contain identifiers or server
 * details. Only expose Supabase's documented, non-sensitive error categories.
 * Unknown codes are normalized so staff can report the code without sharing
 * their password (or a screenshot of DevTools request payload).
 */
export function safePasswordUpdateError(error: Exclude<AuthErrorLike, null>): string {
  switch (error.code) {
    case 'weak_password':
      return 'Password baru belum memenuhi kebijakan keamanan. Gunakan password unik yang panjang, kombinasi huruf besar, kecil, angka, dan simbol.';
    case 'same_password':
      return 'Password baru sama dengan password yang digunakan sebelumnya. Pilih password yang berbeda.';
    case 'reauthentication_needed':
    case 'reauthentication_not_valid':
      return 'Diperlukan verifikasi tambahan untuk perubahan password. Gunakan fitur Lupa password di halaman login.';
    case 'invalid_credentials':
    case 'invalid_password':
      return 'Password saat ini tidak sesuai atau verifikasi akun gagal. Masuk kembali dan coba lagi.';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Terlalu banyak percobaan. Coba kembali nanti, tanpa mengulangi permintaan berkali-kali.';
    case 'session_expired':
    case 'session_not_found':
    case 'bad_jwt':
      return 'Sesi akun sudah tidak berlaku. Keluar, login kembali, lalu coba ubah password.';
    case 'validation_failed':
      return 'Server menolak format password baru. Gunakan password unik dengan kombinasi huruf besar, kecil, angka, dan simbol.';
    default: {
      const safeCode = typeof error.code === 'string' && /^[a-z_]{3,64}$/.test(error.code)
        ? error.code
        : null;
      const codeText = safeCode ? ` (kode: ${safeCode})` : '';
      return `Password belum berubah karena ditolak layanan akun${codeText}. Hubungi Owner dengan menyebutkan kode ini saja, bukan password.`;
    }
  }
}

/**
 * Menegaskan identitas login yang sama sebelum mengubah password.
 * signInWithPassword memverifikasi password lama di Auth dan memperbarui
 * sesi untuk akun yang sama; updateUser hanya mengubah akun login itu.
 * Tidak pernah log/menyimpan password atau memakai service-role.
 */
export async function changeOwnPassword(
  auth: OwnPasswordAuth,
  values: PasswordFields,
): Promise<PasswordChangeResult> {
  const validationError = validatePasswordFields(values);
  if (validationError) return { ok: false, message: validationError };

  try {
    const current = await auth.getUser();
    const account = current.data.user;
    if (current.error || !account?.id || !account.email) {
      return { ok: false, message: 'Sesi login tidak valid. Masuk kembali untuk mengubah password.' };
    }

    const verified = await auth.signInWithPassword({
      email: account.email,
      password: values.currentPassword,
    });
    if (verified.error || !verified.data.user?.id) {
      return { ok: false, message: 'Password saat ini tidak sesuai atau verifikasi gagal.' };
    }
    if (verified.data.user.id !== account.id) {
      return { ok: false, message: 'Identitas akun berubah. Hentikan proses dan masuk kembali.' };
    }

    const changed = await auth.updateUser({
      current_password: values.currentPassword,
      password: values.newPassword,
    });
    if (changed.error) {
      return { ok: false, message: safePasswordUpdateError(changed.error) };
    }
    return { ok: true, message: 'Password berhasil diubah untuk akun Anda sendiri.' };
  } catch {
    return { ok: false, message: 'Tidak dapat terhubung ke layanan akun. Coba kembali.' };
  }
}
