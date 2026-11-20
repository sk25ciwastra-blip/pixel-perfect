/** Baturaden 25 Homestay: perubahan password akun sendiri, bukan administrasi akun staf lain. */
export type PasswordFields = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type AuthErrorLike = { message: string; code?: string } | null;
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
    if (changed.error?.code === 'reauthentication_needed' ||
        changed.error?.code === 'reauthentication_not_valid') {
      return { ok: false, message: 'Diperlukan verifikasi tambahan. Gunakan fitur Lupa password di halaman login.' };
    }
    if (changed.error) {
      return { ok: false, message: 'Password belum berubah. Periksa persyaratan password dan coba kembali.' };
    }
    return { ok: true, message: 'Password berhasil diubah untuk akun Anda sendiri.' };
  } catch {
    return { ok: false, message: 'Tidak dapat terhubung ke layanan akun. Coba kembali.' };
  }
}
