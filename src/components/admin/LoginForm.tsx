'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const [showPassword, setShowPassword] = useState(false);

  /*
   * Sign-in failures surface as a toast, matching every other admin action.
   * Deliberately vague by design — `loginAction` never reveals whether it was
   * the email or the password that was wrong, so there is no field to attach
   * this to and a toast is the honest place for it.
   */
  useEffect(() => {
    if (state.message) toast.error(state.message, { duration: 8000 });
  }, [state]);

  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="from" value={from ?? ''} />

      <div className="grid gap-2">
        <Label htmlFor="email" className="text-xs font-medium uppercase tracking-[0.06em] text-panel-muted">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          className={inputClass}
        />
        {state.errors?.email ? (
          <p role="alert" className="text-xs text-panel-negative">
            {state.errors.email}
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
        {/*
         * The reveal button sits INSIDE the field's box rather than beside it,
         * so both inputs stay the same width and the form does not go ragged.
         * `pr-11` reserves the space, or a long password runs under the icon.
         */}
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            className={`${inputClass} pr-12`}
          />
          <button
            /*
             * `type="button"`, emphatically: inside a form a bare <button>
             * defaults to submit, so revealing the password would post the form
             * instead of showing it.
             */
            type="button"
            onClick={() => setShowPassword((shown) => !shown)}
            /*
             * The label says what the button DOES and `aria-pressed` carries the
             * state, so a screen reader hears "Show password, not pressed"
             * rather than inferring it from a name that changes under them.
             */
            aria-label="Show password"
            aria-pressed={showPassword}
            aria-controls="password"
            className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-input text-panel-muted transition-colors hover:text-panel-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-panel-accent"
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" className="size-4" />
            ) : (
              <Eye aria-hidden="true" className="size-4" />
            )}
          </button>
        </div>
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
