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

/*
 * These actions return void, so they have no channel for reporting a failure.
 * The one realistic failure is a row deleted in another tab (P2025) — the
 * desired state already holds, so it is swallowed rather than thrown at the
 * operator as a raw server-action error. Anything else is logged and rethrown,
 * where the admin error boundary catches it.
 */

export async function setEnquiryStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '') as EnquiryStatus;

  if (!id || !VALID_STATUSES.includes(status)) return;

  try {
    await prisma.enquiry.update({ where: { id }, data: { status } });
  } catch (error) {
    if (!isMissingRow(error)) {
      log.error(`Failed to set status on enquiry ${id}`, error);
      throw error;
    }
  }

  revalidatePath('/admin/enquiries');
  revalidatePath('/admin');
}

export async function deleteEnquiryAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  if (!id) return;

  try {
    await prisma.enquiry.delete({ where: { id } });
  } catch (error) {
    if (!isMissingRow(error)) {
      log.error(`Failed to delete enquiry ${id}`, error);
      throw error;
    }
  }

  revalidatePath('/admin/enquiries');
  revalidatePath('/admin');
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

export async function bulkSetEnquiryStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const ids = bulkIds(formData);
  const status = String(formData.get('status') ?? '') as EnquiryStatus;
  if (!ids || !VALID_STATUSES.includes(status)) return;

  await prisma.enquiry.updateMany({ where: { id: { in: ids } }, data: { status } });

  revalidatePath('/admin/enquiries');
  revalidatePath('/admin');
}

export async function bulkDeleteEnquiriesAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const ids = bulkIds(formData);
  if (!ids) return;

  const { count } = await prisma.enquiry.deleteMany({ where: { id: { in: ids } } });
  log.info(`Deleted ${count} enquiries`);

  revalidatePath('/admin/enquiries');
  revalidatePath('/admin');
}
