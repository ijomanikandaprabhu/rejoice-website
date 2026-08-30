import { Mail, Phone, Trash2 } from 'lucide-react';
import Link from 'next/link';

import { ActionButton } from '@/components/admin/ActionForm';
import { BulkProvider, RowCheckbox, SelectAllCheckbox } from '@/components/admin/BulkSelection';
import { EnquiryBulkBar } from '@/components/admin/EnquiryBulkBar';
import { EnquiryDialog } from '@/components/admin/EnquiryDialog';
import { Pagination } from '@/components/admin/Pagination';
import { resolvePerPage, RowsPerPage } from '@/components/admin/RowsPerPage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { pageSizes } from '@/config/app.config';
import {
  bulkDeleteEnquiriesAction,
  bulkSetEnquiryStatusAction,
  deleteEnquiryAction,
  setEnquiryStatusAction,
} from '@/features/enquiries/actions';
import { prisma } from '@/lib/db/prisma';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** Admin → Enquiries (section 23). */

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'NEW', label: 'New' },
  { value: 'READ', label: 'Read' },
] as const;

const STATUS_VARIANT = {
  NEW: 'default',
  READ: 'secondary',
} as const;

export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string; perPage?: string };
}) {
  const status = FILTERS.find((f) => f.value === searchParams.status)?.value ?? '';
  const page = Math.max(Number(searchParams.page ?? '1') || 1, 1);
  const take = resolvePerPage(searchParams.perPage, pageSizes.adminEnquiries);

  const where = status ? { status: status as 'NEW' | 'READ' } : {};

  const [enquiries, total, counts] = await Promise.all([
    prisma.enquiry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * take,
      take,
    }),
    prisma.enquiry.count({ where }),
    prisma.enquiry.groupBy({ by: ['status'], _count: true }),
  ]);

  const countFor = (value: string) =>
    value === ''
      ? counts.reduce((n, c) => n + c._count, 0)
      : (counts.find((c) => c.status === value)?._count ?? 0);

  const pageCount = Math.max(Math.ceil(total / take), 1);

  const pageHref = (n: number) => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (take !== pageSizes.adminEnquiries) p.set('perPage', String(take));
    if (n > 1) p.set('page', String(n));
    const query = p.toString();
    return query ? `/admin/enquiries?${query}` : '/admin/enquiries';
  };

  return (
    <>
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Enquiries</h1>
        <p className="text-sm text-muted-foreground">
          Messages submitted through the contact form.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <Button
            key={f.value || 'all'}
            asChild
            variant={status === f.value ? 'default' : 'outline'}
            size="sm"
          >
            <Link href={f.value ? `/admin/enquiries?status=${f.value}` : '/admin/enquiries'}>
              {f.label}
              <span className="tabular-nums opacity-70">({countFor(f.value)})</span>
            </Link>
          </Button>
        ))}
      </nav>

      {/*
       * "Nothing here" and "nothing on THIS page" are different facts.
       *
       * Working through a list and deleting as you go can leave you stranded
       * past the last page, where an empty result used to claim there were no
       * enquiries at all — while dozens sat two pages back.
       */}
      {enquiries.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            {total > 0 ? (
              <>
                <p className="font-medium">Nothing on this page</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  There {total === 1 ? 'is' : 'are'} {total.toLocaleString()}{' '}
                  {total === 1 ? 'enquiry' : 'enquiries'} in total — go back to page 1.
                </p>
                <Button asChild variant="outline" size="sm" className="mt-4">
                  {/* Page 1 keeps the active status filter, same as the pager
                      below builds its links. */}
                  <Link href={status ? `/admin/enquiries?status=${status}` : '/admin/enquiries'}>
                    Back to page 1
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <p className="font-medium">No enquiries</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Messages sent through the contact form will appear here.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <BulkProvider>
          <EnquiryBulkBar
            setStatusAction={bulkSetEnquiryStatusAction}
            deleteAction={bulkDeleteEnquiriesAction}
          />

          <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <SelectAllCheckbox ids={enquiries.map((e) => e.id)} />
                  </TableHead>
                  <TableHead className="w-12 text-right">#</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="hidden lg:table-cell">Received</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enquiries.map((enquiry, i) => (
                  <TableRow key={enquiry.id}>
                    <TableCell className="align-top">
                      <RowCheckbox id={enquiry.id} />
                    </TableCell>

                    {/* Position in the current filtered view, not a stable id. */}
                    <TableCell className="text-right align-top text-sm tabular-nums text-muted-foreground">
                      {(page - 1) * take + i + 1}
                    </TableCell>

                    <TableCell className="align-top">
                      <div className="min-w-0">
                        <p className="font-medium">{enquiry.name}</p>
                        <a
                          href={`mailto:${enquiry.email}`}
                          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Mail className="size-3" />
                          {enquiry.email}
                        </a>
                        {enquiry.phone ? (
                          <a
                            href={`tel:${enquiry.phone.replace(/\s/g, '')}`}
                            className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <Phone className="size-3" />
                            {enquiry.phone}
                          </a>
                        ) : null}
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      <div className="max-w-md">
                        {enquiry.subject ? (
                          <p className="truncate text-sm font-medium">{enquiry.subject}</p>
                        ) : null}
                        {/* One clipped line; the whole message lives in the dialog. */}
                        <p className="truncate text-sm text-muted-foreground">{enquiry.message}</p>
                        <EnquiryDialog
                          name={enquiry.name}
                          email={enquiry.email}
                          phone={enquiry.phone}
                          subject={enquiry.subject}
                          message={enquiry.message}
                          receivedLabel={formatDateTime(enquiry.createdAt)}
                        />
                      </div>
                    </TableCell>

                    <TableCell className="hidden align-top text-xs tabular-nums text-muted-foreground lg:table-cell">
                      <time dateTime={enquiry.createdAt.toISOString()}>
                        {formatDateTime(enquiry.createdAt)}
                      </time>
                    </TableCell>

                    <TableCell className="align-top">
                      <Badge variant={STATUS_VARIANT[enquiry.status]}>{enquiry.status}</Badge>
                    </TableCell>

                    <TableCell className="text-right align-top">
                      <div className="flex justify-end gap-1">
                        {/*
                         * One action, whichever way round: a new enquiry can be
                         * read, a read one can go back to new. Without the
                         * second, marking as read would be a one-way door.
                         */}
                        {enquiry.status === 'NEW' ? (
                          <ActionButton
                            action={setEnquiryStatusAction}
                            hiddenFields={{ id: enquiry.id, status: 'READ' }}
                            variant="ghost"
                            size="sm"
                          >
                            Read
                          </ActionButton>
                        ) : (
                          <ActionButton
                            action={setEnquiryStatusAction}
                            hiddenFields={{ id: enquiry.id, status: 'NEW' }}
                            variant="ghost"
                            size="sm"
                          >
                            Unread
                          </ActionButton>
                        )}

                        <ActionButton
                          action={deleteEnquiryAction}
                          hiddenFields={{ id: enquiry.id }}
                          variant="ghost"
                          size="sm"
                          confirm="This deletes the enquiry permanently."
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </ActionButton>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </BulkProvider>
      )}

      {/* Size control and pager on one line — see YouTube Content. */}
      <div className="flex flex-col-reverse items-center gap-4 sm:flex-row sm:justify-between">
        <RowsPerPage id="enquiriesPerPage" perPage={take} page={page} total={total} />

        <Pagination page={page} pageCount={pageCount} buildHref={pageHref} />
      </div>
    </>
  );
}
