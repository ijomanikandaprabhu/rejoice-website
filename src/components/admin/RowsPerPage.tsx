import { QuerySelect } from '@/components/admin/QuerySelect';

/**
 * "Rows per page: [50] · 1–17 of 17", the control beside a pager.
 *
 * The size lives in the query string, not client state: these lists are Server
 * Components that read their paging from the URL, which also keeps a given view
 * bookmarkable across a reload.
 *
 * `QuerySelect` merges into the existing params and drops `page` — going from
 * 100 rows to 10 while on page 6 would land past the end of a shorter list.
 * This used to be a GET form carrying every other filter as a hidden input, and
 * twice shipped with one missing (`channel=all`, then `type`), silently resetting
 * them. Merging removes that failure mode.
 */

export const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;

/**
 * Read a `perPage` query value, falling back to the page's configured default.
 *
 * Only the offered sizes are accepted. Without this an arbitrary `?perPage=99999`
 * would become the Prisma `take` and let anyone pull the whole table in one
 * query.
 */
export function resolvePerPage(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return (ROWS_PER_PAGE_OPTIONS as readonly number[]).includes(n) ? n : fallback;
}

export function RowsPerPage({
  perPage,
  page,
  total,
  id = 'perPage',
}: {
  perPage: number;
  page: number;
  total: number;
  /** Distinct per page when two of these ever share a screen. */
  id?: string;
}) {
  const first = total === 0 ? 0 : (page - 1) * perPage + 1;
  const last = Math.min(page * perPage, total);

  return (
    // No justification of its own: the caller pairs this with the pager in a
    // single row and decides where each sits.
    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
      <label htmlFor={id} className="whitespace-nowrap">
        Rows per page:
      </label>

      <QuerySelect
        id={id}
        param="perPage"
        ariaLabel="Rows per page"
        value={String(perPage)}
        options={ROWS_PER_PAGE_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
        className="h-8 w-[4.75rem]"
      />

      <span className="whitespace-nowrap tabular-nums">
        {first}–{last} of {total.toLocaleString()}
      </span>
    </div>
  );
}
