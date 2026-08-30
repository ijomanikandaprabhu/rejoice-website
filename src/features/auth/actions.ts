'use server';

import { AuthError } from 'next-auth';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { rateLimits } from '@/config/app.config';
import { signIn, signOut } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { requireAdmin } from '@/lib/auth/guard';
import { prisma } from '@/lib/db/prisma';
import { clientIpFrom, rateLimit, resetRateLimit } from '@/lib/utils/rateLimit';
import { adminEmailSchema, adminPasswordSchema, fieldErrors, loginSchema } from '@/lib/validation';

export type ActionState = { ok: boolean; message?: string; errors?: Record<string, string> };

/** Administrator login (section 8). Rate-limited per IP (section 37). */
export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ip = clientIpFrom(headers());
  const key = `login:${ip}`;
  const limit = rateLimit(key, rateLimits.login.limit, rateLimits.login.windowMs);

  if (!limit.allowed) {
    const minutes = Math.ceil(limit.retryAfterMs / 60_000);
    return {
      ok: false,
      message: `Too many login attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  const from = String(formData.get('from') ?? '') || '/admin';

  try {
    await signIn('credentials', { ...parsed.data, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      // Deliberately vague: do not reveal whether the email exists.
      return { ok: false, message: 'Incorrect email or password.' };
    }
    throw error;
  }

  // Successful login clears the attempt counter for this IP.
  resetRateLimit(key);

  redirect(from.startsWith('/admin') ? from : '/admin');
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: '/admin/login' });
}

/**
 * Cap on how often the current password can be guessed from inside a session.
 *
 * Both credential actions verify `currentPassword` with bcrypt and say plainly
 * when it is wrong. Without a cap, a stolen session cookie can brute-force it —
 * and every attempt costs a 12-round hash on the server, so it doubles as a
 * cheap way to exhaust CPU. Keyed by admin id, not IP: the account is what is
 * being attacked.
 */
function credentialGuard(adminId: string): ActionState | null {
  const limit = rateLimit(
    `credentials:${adminId}`,
    rateLimits.credentials.limit,
    rateLimits.credentials.windowMs,
  );
  if (limit.allowed) return null;

  const minutes = Math.ceil(limit.retryAfterMs / 60_000);
  return {
    ok: false,
    message: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
  };
}

/** Change the administrator email (section 24). Requires the current password. */
export async function changeEmailAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireAdmin();

  const blocked = credentialGuard(user.id);
  if (blocked) return blocked;

  const parsed = adminEmailSchema.safeParse({
    email: formData.get('email'),
    currentPassword: formData.get('currentPassword'),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const admin = await prisma.admin.findUnique({ where: { id: user.id } });
  if (!admin) return { ok: false, message: 'Account not found.' };

  if (!(await verifyPassword(parsed.data.currentPassword, admin.passwordHash))) {
    return { ok: false, errors: { currentPassword: 'Incorrect password.' } };
  }

  const email = parsed.data.email.toLowerCase();

  const taken = await prisma.admin.findFirst({ where: { email, NOT: { id: admin.id } } });
  if (taken) return { ok: false, errors: { email: 'That email is already in use.' } };

  await prisma.admin.update({ where: { id: admin.id }, data: { email } });

  // The top bar and the Settings screen read the address from the database, so
  // dropping their cache entry is enough for the new one to appear. The session
  // token still carries the old address, which is why sign-in is called out.
  revalidatePath('/admin', 'layout');

  return { ok: true, message: 'Email address updated. Use it the next time you sign in.' };
}

/** Change the administrator password (section 24). */
export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireAdmin();

  const blocked = credentialGuard(user.id);
  if (blocked) return blocked;

  const parsed = adminPasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const admin = await prisma.admin.findUnique({ where: { id: user.id } });
  if (!admin) return { ok: false, message: 'Account not found.' };

  if (!(await verifyPassword(parsed.data.currentPassword, admin.passwordHash))) {
    return { ok: false, errors: { currentPassword: 'Incorrect password.' } };
  }

  await prisma.admin.update({
    where: { id: admin.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  });

  return { ok: true, message: 'Password updated.' };
}
