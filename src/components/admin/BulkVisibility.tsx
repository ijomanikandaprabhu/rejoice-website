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

/**
 * The bar that shows or hides the selected rows.
 *
 * Selection itself lives in `BulkSelection`, shared with the enquiries table.
 *
 * NOT VIDEO-SPECIFIC. It started that way and the songs table wanted exactly
 * the same bar, so what varies is passed in: the filter is an opaque bag of
 * hidden fields, and the noun and the confirmation wording are props. Keeping
 * one bar is the point — the escalation path below is the dangerous half of
 * this feature and it should exist once.
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
  noun = 'videos',
  confirmDescription = 'This applies to every video matching the current filter, including those on other pages. Nothing on YouTube is changed.',
}: {
  action: (formData: FormData) => Promise<void>;
  /** Rows matching the current filter, across every page. */
  total: number;
  pageIds: string[];
  /**
   * The current filter, written out as hidden fields when the operator
   * escalates to "everything matching". Every dimension of the filter must be
   * here — see the note where these are rendered.
   */
  params: Record<string, string | undefined>;
  /** Plural, for "Hide 12 songs?". */
  noun?: string;
  confirmDescription?: string;
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
          noun={noun}
          confirmDescription={confirmDescription}
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
          noun={noun}
          confirmDescription={confirmDescription}
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
  noun,
  confirmDescription,
  onDone,
}: {
  action: (formData: FormData) => Promise<void>;
  visible: boolean;
  label: string;
  pendingLabel: string;
  confirmCount: number | null;
  selected: Set<string>;
  allMatching: boolean;
  params: Record<string, string | undefined>;
  noun: string;
  confirmDescription: string;
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
           * EVERY dimension of the filter has to be in `params`. `type` was
           * missed once and the effect was silent and severe: escalating on
           * Shorts posted no type, so the server matched all 1,748 videos and
           * "hide all 603 Shorts" would have hidden the whole catalogue.
           *
           * Whatever the caller puts in `params` is what the server gets, so a
           * new filter has to be added to the caller's `params` at the same
           * time it is added to that table's `build...Where`.
           */}
          <input type="hidden" name="mode" value="filter" />
          {Object.entries(params).map(([name, value]) =>
            value ? <input key={name} type="hidden" name={name} value={value} /> : null,
          )}
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
        <AlertDialogContent className="admin-theme">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {label} {confirmCount.toLocaleString()} {noun}?
            </AlertDialogTitle>
            <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
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
