'use client';

import { useRef } from 'react';

import { SubmitButton } from '@/components/admin/ActionForm';
import { ClearWhenDone, useBulk } from '@/components/admin/BulkSelection';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import type { VideoListParams } from '@/features/youtube/contentFilters';

/**
 * The bar that shows or hides the selected videos.
 *
 * Selection itself lives in `BulkSelection`, shared with the enquiries table.
 *
 * This bar owns ONE form per verb, placed outside the table. Each row already
 * renders its own single-video toggle form, and a form inside a form is invalid
 * HTML — which is why the selection is posted as hidden inputs from out here
 * rather than by wrapping the table.
 */

export function BulkBar({
  action,
  total,
  pageIds,
  params,
}: {
  action: (formData: FormData) => Promise<void>;
  /** Rows matching the current filter, across every page. */
  total: number;
  pageIds: string[];
  params: VideoListParams;
}) {
  const { selected, allMatching, setAllMatching, clear } = useBulk();

  if (selected.size === 0) return null;

  const wholePageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const canEscalate = wholePageSelected && total > pageIds.length;
  const count = allMatching ? total : selected.size;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 p-3 text-sm">
      <span className="font-medium tabular-nums">{count.toLocaleString()} selected</span>

      {canEscalate && !allMatching ? (
        <Button type="button" variant="link" size="sm" onClick={() => setAllMatching(true)}>
          Select all {total.toLocaleString()} matching this filter
        </Button>
      ) : null}

      {allMatching ? (
        <span className="text-muted-foreground">everything matching this filter</span>
      ) : null}

      {/*
       * One form PER VERB, each carrying its own hidden `visible` value.
       *
       * The obvious shape — a single form with two submit buttons differing by
       * `name="visible"` — silently does the wrong thing here. React 18 does not
       * include the submitter's name/value in the FormData handed to a server
       * action (that arrived in React 19), so `visible` was absent and
       * `=== 'true'` made BOTH buttons hide. Show appeared to do nothing.
       */}
      <div className="ml-auto flex items-center gap-2">
        <BulkForm
          action={action}
          visible
          label="Show"
          pendingLabel="Showing…"
          confirmCount={allMatching ? count : null}
          selected={selected}
          allMatching={allMatching}
          params={params}
          onDone={clear}
        />
        <BulkForm
          action={action}
          visible={false}
          label="Hide"
          pendingLabel="Hiding…"
          confirmCount={allMatching ? count : null}
          selected={selected}
          allMatching={allMatching}
          params={params}
          onDone={clear}
        />
      </div>

      <Button type="button" variant="ghost" size="sm" onClick={clear}>
        Clear
      </Button>
    </div>
  );
}

/**
 * One verb, one form. Carries the selection (or the filter) plus a fixed
 * `visible` value as hidden inputs — never relying on which button was clicked.
 *
 * `confirmCount` non-null means the action reaches rows that are not on screen,
 * so the submit goes behind an are-you-sure first.
 */
function BulkForm({
  action,
  visible,
  label,
  pendingLabel,
  confirmCount,
  selected,
  allMatching,
  params,
  onDone,
}: {
  action: (formData: FormData) => Promise<void>;
  visible: boolean;
  label: string;
  pendingLabel: string;
  confirmCount: number | null;
  selected: Set<string>;
  allMatching: boolean;
  params: VideoListParams;
  onDone: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  const fields = (
    <>
      <input type="hidden" name="visible" value={visible ? 'true' : 'false'} />
      {allMatching ? (
        <>
          {/*
           * Post the FILTER, not the ids. The action rebuilds the same `where`
           * server-side, so nothing here can name a row the filter excludes.
           *
           * EVERY dimension of the filter has to be here. `type` was missed once
           * and the effect was silent and severe: escalating on Shorts posted no
           * type, so the server matched all 1,748 videos and "hide all 603
           * Shorts" would have hidden the whole catalogue. Add any new filter
           * field to this list at the same time you add it to
           * `buildVideoListWhere`.
           */}
          <input type="hidden" name="mode" value="filter" />
          {params.q ? <input type="hidden" name="q" value={params.q} /> : null}
          {params.filter ? <input type="hidden" name="filter" value={params.filter} /> : null}
          {params.channel ? <input type="hidden" name="channel" value={params.channel} /> : null}
          {params.type ? <input type="hidden" name="type" value={params.type} /> : null}
        </>
      ) : (
        [...selected].map((id) => <input key={id} type="hidden" name="ids" value={id} />)
      )}
    </>
  );

  if (confirmCount === null) {
    return (
      <form action={action} className="inline-flex">
        <ClearWhenDone onDone={onDone} />
        {fields}
        <SubmitButton variant="outline" size="sm" pendingLabel={pendingLabel}>
          {label}
        </SubmitButton>
      </form>
    );
  }

  return (
    <form ref={formRef} action={action} className="inline-flex">
      <ClearWhenDone onDone={onDone} />
      {fields}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            {label}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {label} {confirmCount.toLocaleString()} videos?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This applies to every video matching the current filter, including those on other
              pages. Nothing on YouTube is changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // After Radix has closed, so the closing click cannot race the
                // submit — the same ordering ActionForm relies on.
                setTimeout(() => formRef.current?.requestSubmit(), 0);
              }}
            >
              {label} {confirmCount.toLocaleString()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
