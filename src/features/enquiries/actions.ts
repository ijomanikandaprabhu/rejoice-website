'use server';

import type { EnquiryStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';

import { requireAdmin } from '@/lib/auth/guard';
import { isMissingRow } from '@/lib/db/errors';
import { prisma } from '@/lib/db/prisma';
import { createLogger } from '@/lib/logger';

/** Enquiry management (section 23). */

const log = createLogger('enquiries');

const VALID_STATUSES: EnquiryStatus[] = ['NEW', 'READ'];

export type ActionState = { ok: boolean; message?: string; errors?: Record<string, string> };

/*
 * These used to return void, which meant they had no channel for reporting
 * anything at all: a delete succeeded in silence, a delete that failed replaced
 * the whole admin with the error screen, and a bulk action on twenty rows said
 * nothing about how many it touched. They return a message now, and
 * `ActionButton` shows it.
 *
 * A row deleted in another tab (P2025) is still not an error — the desired
 * state already holds, so it reports success rather than alarming the operator
 * about something that is already true.
 */

export async function setEnquiryStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '') as EnquiryStatus;

  // Used to `return` here, which did nothing and said nothing.
  if (!id || !VALID_STATUSES.includes(status)) {
    return { ok: false, message: 'That enquiry could not be updated.' };
  }

  try {
    await prisma.enquiry.update({ where: { id }, data: { status } });
  } catch (error) {
    if (!isMissingRow(error)) {
      log.error(`Failed to set status on enquiry ${id}`, error);
      return { ok: false, message: 'Could not update that enquiry. Please try again.' };
    }
  }

  revalidatePath('/admin/enquiries');
  revalidatePath('/admin');

  return { ok: true, message: status === 'READ' ? 'Marked as read.' : 'Marked as unread.' };
}

export async function deleteEnquiryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  if (!id) return { ok: false, message: 'That enquiry could not be deleted.' };

  try {
    await prisma.enquiry.delete({ where: { id } });
  } catch (error) {
    if (!isMissingRow(error)) {
      log.error(`Failed to delete enquiry ${id}`, error);
      return { ok: false, message: 'Could not delete that enquiry. Please try again.' };
    }
  }

  revalidatePath('/admin/enquiries');
  revalidatePath('/admin');

  /* Deleting is the one thing here that cannot be undone, so it says so. */
  return { ok: true, message: 'Enquiry deleted.' };
}

/**
 * Bulk operations from the selection bar.
 *
 * Ids come from checkboxes on the current page, so they are used directly —
 * unlike the video bulk action, this deliberately has no "select everything
 * matching the filter" mode. Hiding a video is undone with one click; deleting
 * an enquiry is not, and making a filter-wide delete easy is the wrong trade.
 *
 * The cap bounds the `IN (…)` a forged post could ask for; 100 is the largest
 * page size on offer.
 */
const BULK_ID_LIMIT = 100;

function bulkIds(formData: FormData): string[] | null {
  const ids = formData.getAll('ids').map(String).filter(Boolean);
  if (ids.length === 0 || ids.length > BULK_ID_LIMIT) return null;
  return ids;
}

export async function bulkSetEnquiryStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const ids = bulkIds(formData);
  const status = String(formData.get('status') ?? '') as EnquiryStatus;
  if (!ids || !VALID_STATUSES.includes(status)) {
    return { ok: false, message: 'Nothing was updated — the selection was not valid.' };
  }

  /*
   * `count` is what came back, not what was asked for. Selecting twenty rows
   * and being told "20 marked as read" when the database changed eighteen is
   * exactly the kind of confident wrong answer worth avoiding.
   */
  const { count } = await prisma.enquiry.updateMany({
    where: { id: { in: ids } },
    data: { status },
  });

  revalidatePath('/admin/enquiries');
  revalidatePath('/admin');

  const what = status === 'READ' ? 'read' : 'unread';
  return {
    ok: true,
    message: `${count} ${plural(count, 'enquiry', 'enquiries')} marked as ${what}.`,
  };
}

export async function bulkDeleteEnquiriesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const ids = bulkIds(formData);
  if (!ids) return { ok: false, message: 'Nothing was deleted — the selection was not valid.' };

  const { count } = await prisma.enquiry.deleteMany({ where: { id: { in: ids } } });
  log.info(`Deleted ${count} enquiries`);

  revalidatePath('/admin/enquiries');
  revalidatePath('/admin');

  return { ok: true, message: `${count} ${plural(count, 'enquiry', 'enquiries')} deleted.` };
}

/** Because "1 enquiries deleted" undermines every other word on the screen. */
function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}
