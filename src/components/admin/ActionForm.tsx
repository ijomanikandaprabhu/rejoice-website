'use client';

import { Loader2 } from 'lucide-react';
import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useFormStatus } from 'react-dom';
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
  ariaLabel,
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
  /**
   * The accessible name, for a button whose content is only an icon. Without
   * it a screen reader announces the button with no name at all — a tooltip
   * does not supply one, it only describes.
   */
  ariaLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      name={name}
      value={value}
      aria-label={ariaLabel}
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
  onSuccess,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  hiddenFields?: Record<string, string>;
  /**
   * Called once, when the action comes back successful. For a form inside a
   * dialog, which has to close itself afterwards.
   *
   * The result is already tracked here for the toast, so this is a handful of
   * lines; the alternative is a second `useActionState` in every such dialog,
   * which is how two copies of this logic start.
   */
  onSuccess?: () => void;
  /**
   * Guard the submit behind a confirmation dialog. For actions whose effect is
   * larger than the button implies — anything that deletes records the operator
   * cannot get back by clicking again.
   */
  confirm?: string;
  confirmTitle?: string;
  confirmLabel?: string;
}) {
  /*
   * The result is announced INSIDE the action, not from an effect on `state`.
   * See `announce` below for why: an effect dies with its component, and some
   * of these forms are removed by the very action they just ran — the channel
   * disconnect card is gone the moment the channel is.
   *
   * `state` is still needed here, for the field errors published to context.
   */
  /*
   * `onSuccess` through a ref, kept current from an effect rather than written
   * during render — a render-time ref write is a change React cannot see, and
   * the rule that says so is an error here.
   *
   * The ref exists because callers pass an inline arrow: naming `onSuccess`
   * directly in the action below would capture whichever identity that render
   * produced, and re-create the action on every render for no gain.
   */
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  const [state, formAction] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await action(prev, formData);
      announce(result);
      if (result.ok && result.message) onSuccessRef.current?.();
      return result;
    },
    { ok: false },
  );
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
   * The one case `announce` cannot cover: a save rejected with field errors and
   * NO message.
   *
   * Those failures are silent by design — the detail belongs inline under the
   * offending input via <FieldError>, since a floating message cannot point at
   * a field. But several forms carry a validation rule with no <FieldError>
   * beside it, and then nothing happened at all: the spinner finished and the
   * form sat there looking saved.
   *
   * It stays an effect because it depends on `state.errors`, which is what the
   * component renders from — and a form that failed validation is still on
   * screen by definition, so nothing here can unmount before it runs.
   */
  useEffect(() => {
    if (state.message) return;
    if (!state.ok && state.errors && Object.keys(state.errors).length > 0) {
      toast.error('Not saved — check the highlighted fields.', { duration: 8000 });
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
          <AlertDialogContent className="admin-theme">
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
 * Announce a result, from inside the action rather than from an effect.
 *
 * WHY NOT A `useEffect` ON THE STATE, which is the obvious shape and was the
 * shape here: an effect belongs to the component, and a delete removes the
 * component. Deleting an enquiry revalidates the list, the row — and the button
 * inside it that owns the effect — unmounts in that same commit, and the effect
 * for the new state never runs. So every action that made its own control
 * disappear said nothing, which was exactly the set of irreversible ones:
 * deleting an enquiry, deleting a song, disconnecting a channel, and both bulk
 * deletes. Everything that merely toggled a row kept its button and toasted
 * fine, which is why this looked like it worked.
 *
 * `toast` writes to sonner's own store, which outlives any component, so
 * calling it here reports the result whether or not the caller survives it.
 */
function announce(result: ActionState) {
  if (!result.message) return;
  if (result.ok) {
    toast.success(result.message);
  } else {
    // Failures outlive successes: something to read and act on should not
    // vanish at the same speed as "Saved".
    toast.error(result.message, { duration: 8000 });
  }
}

/**
 * `useActionState` plus the toast, for the one-click actions.
 *
 * Extracted because three places need exactly this — the row buttons, the
 * enquiry bulk bar and the visibility bulk bar.
 */
export function useActionToast(
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>,
) {
  const [, formAction] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await action(prev, formData);
      announce(result);
      return result;
    },
    { ok: false },
  );

  return formAction;
}

/**
 * A one-button form for actions that take no input (sync, delete, toggle).
 * `confirm` guards destructive actions with an AlertDialog before they run.
 *
 * ## It reports back now
 *
 * This used to take an action returning `void`, which meant it could not say
 * anything at all — the row changed and that was the whole of the feedback.
 * Measured in the running admin: marking an enquiry read said nothing, and a
 * bulk "mark as read" across three rows said nothing either. Deleting an
 * enquiry — the one irreversible thing in here — confirmed nothing.
 *
 * It shares `ActionForm`'s toast behaviour rather than inventing a second one,
 * including the detail that the effect depends on `state` and not
 * `state.message`: `useActionState` returns a fresh object per submit, so hiding
 * two songs in a row still fires twice instead of looking like the button
 * stopped working.
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
  label,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  hiddenFields?: Record<string, string>;
  children: ReactNode;
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  pendingLabel?: string;
  confirm?: string;
  className?: string;
  /**
   * The button's name when `children` is an icon and nothing else.
   *
   * An icon-only button has no accessible name at all: a screen reader
   * announces "button" and stops, which for the three delete buttons in this
   * admin means the irreversible control is the one that says least. It also
   * cannot be addressed by role and name, so a test has to reach for it by
   * position.
   *
   * Not required, because a button whose children are words already has a name
   * and repeating it here would only let the two drift apart.
   */
  label?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const formAction = useActionToast(action);

  const hidden = hiddenFields
    ? Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))
    : null;

  if (!confirm) {
    return (
      <form action={formAction} className="inline-flex">
        {hidden}
        <SubmitButton
          variant={variant}
          size={size}
          pendingLabel={pendingLabel}
          className={className}
          ariaLabel={label}
        >
          {children}
        </SubmitButton>
      </form>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="inline-flex">
      {hidden}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant={variant}
            size={size}
            className={className}
            aria-label={label}
          >
            {children}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="admin-theme">
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
