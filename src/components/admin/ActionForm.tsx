'use client';

import { Loader2 } from 'lucide-react';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { toast } from 'sonner';

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
 * Shared wrapper for every admin form.
 *
 * Server actions all return the same `{ ok, message, errors }` shape, so one
 * component owns the pending state, the result banner and the per-field error
 * lookup instead of each page repeating it.
 *
 * Field errors are published through context so server-rendered children can
 * still show them via <FieldError name="..." />.
 */

export type ActionState = { ok: boolean; message?: string; errors?: Record<string, string> };
export type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

const ErrorContext = createContext<Record<string, string>>({});

export function FieldError({ name }: { name: string }) {
  const errors = useContext(ErrorContext);
  const message = errors[name];
  if (!message) return null;
  return (
    <p role="alert" className="text-xs font-medium text-destructive">
      {message}
    </p>
  );
}

export function SubmitButton({
  children = 'Save changes',
  pendingLabel = 'Saving…',
  variant = 'default',
  size = 'default',
  className,
  name,
  value,
}: {
  children?: ReactNode;
  pendingLabel?: string;
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  /**
   * Submitted alongside the form when THIS button is the one clicked, which is
   * how one form serves two verbs — the bulk bar posts Show and Hide through the
   * same action.
   */
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      name={name}
      value={value}
      variant={variant}
      size={size}
      disabled={pending}
      className={className}
    >
      {pending ? (
        <>
          <Loader2 className="animate-spin" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

export function ActionForm({
  action,
  children,
  className = 'space-y-5',
  hiddenFields,
  confirm,
  confirmTitle = 'Are you sure?',
  confirmLabel = 'Continue',
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  hiddenFields?: Record<string, string>;
  /**
   * Guard the submit behind a confirmation dialog. For actions whose effect is
   * larger than the button implies — anything that deletes records the operator
   * cannot get back by clicking again.
   */
  confirm?: string;
  confirmTitle?: string;
  confirmLabel?: string;
}) {
  const [state, formAction] = useFormState(action, { ok: false });
  const formRef = useRef<HTMLFormElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  /*
   * "Has the operator confirmed" is deliberately a ref, not state, and separate
   * from `dialogOpen`. Two reasons, both of which bite if you merge them:
   *
   *   - Radix closes the dialog when its action button is clicked, so any flag
   *     tied to the open state is already back to false by the time we
   *     re-submit — the guard would block again and re-open the dialog forever.
   *   - A state update would not have landed by the time `requestSubmit()`
   *     fires; a ref is read synchronously.
   */
  const confirmedRef = useRef(false);

  /*
   * Action feedback goes to a toast rather than a banner inside the form.
   *
   * The dependency is `state`, not `state.message`: `useFormState` hands back a
   * fresh object on every submit, so an action that legitimately returns the
   * same message twice still fires twice. Keying on the string would swallow
   * the second one and look like the button had stopped working.
   *
   * Nothing fires on mount because the initial state carries no message.
   *
   * Field-level errors are deliberately NOT toasted in detail — they stay inline
   * under their input via <FieldError>, since a floating message cannot point at
   * which field is wrong.
   *
   * But a rejected save must never be *silent*. Several forms carried fields
   * with a validation rule and no <FieldError> beside them, and because those
   * failures also carry no `message`, the early return below meant the spinner
   * simply finished and nothing happened at all. The fallback toast is the
   * backstop: inline errors stay the real signal, and this guarantees the
   * operator at least learns the save did not go through.
   */
  useEffect(() => {
    if (!state.message) {
      if (!state.ok && state.errors && Object.keys(state.errors).length > 0) {
        toast.error('Not saved — check the highlighted fields.', { duration: 8000 });
      }
      return;
    }
    if (state.ok) {
      toast.success(state.message);
    } else {
      // Failures outlive successes: something the operator has to read and act
      // on should not vanish at the same speed as "Saved".
      toast.error(state.message, { duration: 8000 });
    }
  }, [state]);

  return (
    <ErrorContext.Provider value={state.errors ?? {}}>
      <form
        ref={formRef}
        action={formAction}
        className={className}
        onSubmit={(event) => {
          if (!confirm) return;

          // Second pass, after confirming — let it through and re-arm the guard
          // so the next submit is challenged again.
          if (confirmedRef.current) {
            confirmedRef.current = false;
            return;
          }

          event.preventDefault();
          setDialogOpen(true);
        }}
      >
        {hiddenFields
          ? Object.entries(hiddenFields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))
          : null}

        {children}
      </form>

      {confirm ? (
        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
              <AlertDialogDescription>{confirm}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  confirmedRef.current = true;
                  // Resubmit after Radix has finished closing, so the click
                  // that closed the dialog cannot race the new submit.
                  setTimeout(() => formRef.current?.requestSubmit(), 0);
                }}
              >
                {confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </ErrorContext.Provider>
  );
}

/**
 * A one-button form for actions that take no input (sync, delete, toggle).
 * `confirm` guards destructive actions with an AlertDialog before they run.
 */
export function ActionButton({
  action,
  hiddenFields,
  children,
  variant = 'outline',
  size = 'sm',
  pendingLabel = 'Working…',
  confirm,
  className,
}: {
  action: (formData: FormData) => Promise<void>;
  hiddenFields?: Record<string, string>;
  children: ReactNode;
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  pendingLabel?: string;
  confirm?: string;
  className?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  const hidden = hiddenFields
    ? Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))
    : null;

  if (!confirm) {
    return (
      <form action={action} className="inline-flex">
        {hidden}
        <SubmitButton variant={variant} size={size} pendingLabel={pendingLabel} className={className}>
          {children}
        </SubmitButton>
      </form>
    );
  }

  return (
    <form ref={formRef} action={action} className="inline-flex">
      {hidden}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant={variant} size={size} className={className}>
            {children}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>{confirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => formRef.current?.requestSubmit()}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

/**
 * Label + control + error, matching shadcn's form spacing.
 *
 * `content-start` matters: a grid's rows stretch to fill spare height by
 * default, so a Field sitting beside a taller one in a two-column row would
 * have its label, control and hint pushed apart to fill that height, and stop
 * lining up with its neighbour. Pinning the rows to the top leaves the spare
 * height at the bottom, where it is invisible.
 */
export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className ?? 'grid content-start gap-2'}>
      <label htmlFor={htmlFor} className="text-sm font-medium leading-none">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
