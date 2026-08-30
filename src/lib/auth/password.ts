import bcrypt from 'bcryptjs';

const ROUNDS = 12;

/** Passwords are never stored in plain text (section 8). */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
