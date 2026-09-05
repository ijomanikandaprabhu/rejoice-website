'use client';

import { useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { loginAction, type ActionState } from '@/features/auth/actions';

const initialState: ActionState = { ok: false };

/*
 * Glass, over the film.
 *
 * `.admin-glass-field` (globals.css) carries the surface: the same recipe as the
 * public footer's glass pills, with the admin's lime for focus. Only the type
 * colours are set here, and they stay the panel's.
 *
 * `h-12` rather than the panel's usual `h-11`: over moving footage a slightly
 * taller target is easier to hit.
 */
const inputClass =
  'admin-glass-field h-12 w-full rounded-input px-4 text-sm text-panel-fg placeholder:text-panel-muted/70';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-12 w-full rounded-pill bg-panel-accent text-sm font-semibold text-panel-bg transition-opacity hover:bg-panel-accent hover:opacity-90 disabled:opacity-60"
    >
      {pending ? 'Signing in…' : 'Sign in'}
    </Button>
  );
}

export function LoginForm({ from }: { from?: string }) {
  const [state, formAction] = useFormState(loginAction, initialState);

  /*
   * Sign-in failures surface as a toast, matching every other admin action.
   * Deliberately vague by design — `loginAction` never reveals which of the
   * identifier and the password was wrong, so there is no field to attach this
   * to and a toast is the honest place for it.
   */
  useEffect(() => {
    if (state.message) toast.error(state.message, { duration: 8000 });
  }, [state]);

  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="from" value={from ?? ''} />

      <div className="grid gap-2">
        <Label
          htmlFor="identifier"
          className="text-xs font-medium uppercase tracking-[0.06em] text-panel-muted"
        >
          Email or User ID
        </Label>
        {/*
         * `type="text"`, NOT `type="email"`. The browser refuses to submit a
         * value that is not an address when the type says email, so a User ID
         * would be rejected before this form was ever posted — and the message
         * would come from the browser, not from us.
         *
         * `autoComplete="username"` is unchanged, so a saved sign-in keeps
         * filling this field.
         */}
        <Input
          id="identifier"
          name="identifier"
          type="text"
          inputMode="text"
          autoComplete="username"
          required
          autoFocus
          className={inputClass}
        />
        {state.errors?.identifier ? (
          <p role="alert" className="text-xs text-panel-negative">
            {state.errors.identifier}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label
          htmlFor="password"
          className="text-xs font-medium uppercase tracking-[0.06em] text-panel-muted"
        >
          Password
        </Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          /*
           * The panel's own skin, which is why PasswordInput takes overrides:
           * `pr-12` for the taller 48px button this field uses, and the panel
           * colours in place of the admin form's muted grey.
           */
          className={`${inputClass} pr-12`}
          /*
           * `!rounded-r-input`, with the important modifier, because
           * tailwind-merge does not know these two radius utilities conflict —
           * it keeps BOTH `rounded-r-md` and `rounded-r-input`, and the winner
           * is then decided by which rule Tailwind happens to emit last. It
           * emits `rounded-r-md` later, so without this the panel's 8px corner
           * quietly became 6px.
           */
          toggleClassName="w-12 !rounded-r-input text-panel-muted hover:text-panel-fg focus-visible:ring-panel-accent"
        />
        {state.errors?.password ? (
          <p role="alert" className="text-xs text-panel-negative">
            {state.errors.password}
          </p>
        ) : null}
      </div>

      <Submit />
    </form>
  );
}
