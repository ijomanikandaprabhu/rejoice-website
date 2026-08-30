import { Prisma } from '@prisma/client';

/**
 * Naming the two Prisma error codes this project actually reacts to, so call
 * sites read as intent rather than as a string comparison.
 *
 * https://www.prisma.io/docs/orm/reference/error-reference
 */

/**
 * The row an `update` or `delete` targeted does not exist (P2025).
 *
 * The realistic cause is two admin tabs: the row was already removed in one, and
 * the second still shows the button. That is not a failure — the desired state
 * has been reached — so callers treat it as a no-op instead of throwing a raw
 * server-action error at the operator.
 */
export function isMissingRow(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

/** A unique constraint was violated (P2002) — a duplicate name, slug or email. */
export function isDuplicate(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
