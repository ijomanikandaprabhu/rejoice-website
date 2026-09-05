import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * Seed the single administrator and the default
 * site settings.
 *
 * Page copy and the services list are not seeded — they live in
 * `src/config/content.config.ts`.
 *
 * Safe to re-run: everything is an upsert, and the admin password is only set
 * when the account is first created — re-seeding never resets a password that
 * has been changed through Settings.
 */

const prisma = new PrismaClient();

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? 'admin@rejoice.local').toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    throw new Error(
      'ADMIN_PASSWORD is not set. Add it to .env before seeding — the administrator account needs a password.',
    );
  }
  if (password.length < 10) {
    throw new Error('ADMIN_PASSWORD must be at least 10 characters.');
  }

  /*
   * The short identifier that signs in as an alternative to the email address.
   * Defaulted so a database built from scratch matches production, where the
   * migration set the same number.
   */
  const userId = Number(process.env.ADMIN_USER_ID ?? 1975);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('ADMIN_USER_ID must be a positive whole number.');
  }

  const existing = await prisma.admin.findUnique({ where: { email } });

  if (existing) {
    console.log(`Administrator ${email} already exists — password left unchanged.`);

    // Backfill only. An administrator who already carries an id keeps it —
    // overwriting one would take away a way of signing in that is in use.
    if (existing.userId === null) {
      await prisma.admin.update({ where: { id: existing.id }, data: { userId } });
      console.log(`Gave ${email} User ID ${userId}`);
    }
  } else {
    await prisma.admin.create({
      data: {
        email,
        userId,
        name: 'Rejoice Administrator',
        passwordHash: await bcrypt.hash(password, 12),
      },
    });
    console.log(`Created administrator ${email} with User ID ${userId}`);
  }


  await prisma.siteSetting.upsert({
    where: { key: 'general' },
    create: { key: 'general', value: { siteName: 'Rejoice' } },
    update: {},
  });

  console.log('Seed complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
