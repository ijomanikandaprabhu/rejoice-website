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
 * Acts on the enquiries ticked in the table.
 *
 * Selection comes from `BulkSelection`, shared with the videos table.
 *
 * One form per verb, each carrying its own hidden value. A single form with
 * several submit buttons would be neater, but React 18 does not include the
 * clicked button's name/value in the FormData handed to a server action — the
 * video bar shipped that way once and every button silently did the same thing.
 */

export function EnquiryBulkBar({
  setStatusAction,
  deleteAction,
}: {
  setStatusAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
}) {
  const { selected, clear } = useBulk();

  if (selected.size === 0) return null;

  const ids = [...selected];

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 p-3 text-sm">
      <span className="font-medium tabular-nums">{selected.size} selected</span>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <StatusForm
          action={setStatusAction}
          ids={ids}
          status="READ"
          label="Mark as read"
          pendingLabel="Marking…"
          onDone={clear}
        />
        {/*
         * The reverse of "read", so bulk selection is not one-way. Without it
         * the only way back from read would be one row at a time.
         */}
        <StatusForm
          action={setStatusAction}
          ids={ids}
          status="NEW"
          label="Mark as unread"
          pendingLabel="Marking…"
          onDone={clear}
        />
        <DeleteForm action={deleteAction} ids={ids} onDone={clear} />
      </div>

      <Button type="button" variant="ghost" size="sm" onClick={clear}>
        Clear
      </Button>
    </div>
  );
}

function HiddenIds({ ids }: { ids: string[] }) {
  return (
    <>
      {ids.map((id) => (
        <input key={id} type="hidden" name="ids" value={id} />
      ))}
    </>
  );
}

function StatusForm({
  action,
  ids,
  status,
  label,
  pendingLabel,
  onDone,
}: {
  action: (formData: FormData) => Promise<void>;
  ids: string[];
  status: string;
  label: string;
  pendingLabel: string;
  onDone: () => void;
}) {
  return (
    <form action={action} className="inline-flex">
      <ClearWhenDone onDone={onDone} />
      <input type="hidden" name="status" value={status} />
      <HiddenIds ids={ids} />
      <SubmitButton variant="outline" size="sm" pendingLabel={pendingLabel}>
        {label}
      </SubmitButton>
    </form>
  );
}

/** Deletion is not undoable, so it asks first — however many rows are ticked. */
function DeleteForm({
  action,
  ids,
  onDone,
}: {
  action: (formData: FormData) => Promise<void>;
  ids: string[];
  onDone: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action} className="inline-flex">
      <ClearWhenDone onDone={onDone} />
      <HiddenIds ids={ids} />

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="destructive" size="sm">
            Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {ids.length} {ids.length === 1 ? 'enquiry' : 'enquiries'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The messages are removed permanently.
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
              Delete {ids.length}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
