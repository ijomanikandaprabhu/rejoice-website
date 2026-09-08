'use client';

import { useRef } from 'react';

import { useActionToast, type ActionState } from '@/components/admin/ActionForm';
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
 * The selection bar on the notifications list.
 *
 * DELETE ONLY, unlike `EnquiryBulkBar`. A notification has one state worth
 * setting in bulk — read — and "Mark all read" above the list already does that
 * for every one of them, which is the only bulk read anybody wants. A "mark the
 * three you ticked as read" button would be a second way to do a job the first
 * one does better.
 */
export function NotificationBulkBar({
  deleteAction,
}: {
  deleteAction: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const { selected, clear } = useBulk();
  const formRef = useRef<HTMLFormElement>(null);
  const formAction = useActionToast(deleteAction);

  if (selected.size === 0) return null;

  const ids = [...selected];

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 p-3 text-sm">
      <span className="font-medium tabular-nums">{selected.size} selected</span>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <form ref={formRef} action={formAction} className="inline-flex">
          <ClearWhenDone onDone={clear} />
          {ids.map((id) => (
            <input key={id} type="hidden" name="ids" value={id} />
          ))}

          {/*
            Asked for here and NOT on the single-row button, deliberately. One
            click removing one note it has already shown you is not worth a
            dialog; one click removing forty is, because the forty are gone
            before the hand leaves the mouse.
          */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" size="sm">
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="admin-theme">
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Delete {ids.length} {ids.length === 1 ? 'notification' : 'notifications'}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This only clears the notes. The enquiries and videos they point at are not
                  affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    // After Radix has closed, so the closing click cannot race
                    // the submit — the ordering `EnquiryBulkBar` relies on too.
                    setTimeout(() => formRef.current?.requestSubmit(), 0);
                  }}
                >
                  Delete {ids.length}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </form>

        <Button type="button" variant="ghost" size="sm" onClick={clear}>
          Clear
        </Button>
      </div>
    </div>
  );
}
