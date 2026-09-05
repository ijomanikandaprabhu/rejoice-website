'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState, type ComponentProps } from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * A password field with a reveal button inside it.
 *
 * Typing a password blind is the whole problem: on the Settings screen five of
 * these sit together — the current password on three separate forms, plus a new
 * password and its confirmation — and a typo is invisible until the form comes
 * back saying "Incorrect password". Confirming a new password twice, unseen, is
 * the worst of them.
 *
 * The state is deliberately local and starts hidden on every mount. Nothing
 * persists it: a password left readable on a tab someone comes back to is worse
 * than having no reveal at all.
 *
 * The two screens that use this are skinned differently — the sign-in panel has
 * its own colours and a taller field than the admin forms — so both the field
 * and the button take class overrides. The defaults suit the admin forms, which
 * are five of the six uses.
 */
export function PasswordInput({
  id,
  className,
  toggleClassName,
  ...props
}: Omit<ComponentProps<typeof Input>, 'type' | 'id'> & {
  /** Required, not optional: the button's `aria-controls` points at it. */
  id: string;
  toggleClassName?: string;
}) {
  const [shown, setShown] = useState(false);

  return (
    /*
     * The button sits INSIDE the field's box rather than beside it, so every
     * input in a form keeps the same width and the column does not go ragged.
     */
    <div className="relative">
      <Input
        id={id}
        type={shown ? 'text' : 'password'}
        // Reserves the space the button occupies. Without it a long password
        // runs underneath the icon.
        className={cn('pr-10', className)}
        {...props}
      />
      <button
        /*
         * `type="button"`, emphatically: inside a form a bare <button> defaults
         * to submit, so revealing the password would post the form instead of
         * showing it.
         */
        type="button"
        onClick={() => setShown((isShown) => !isShown)}
        /*
         * The label says what the button DOES and `aria-pressed` carries the
         * state, so a screen reader hears "Show password, not pressed" rather
         * than inferring it from a name that changes under them.
         *
         * This name is also load-bearing for the end-to-end tests: they find
         * the password field with an EXACT label match precisely because a
         * loose one also matches this button. Renaming it breaks sign-in for
         * the whole suite.
         */
        aria-label="Show password"
        aria-pressed={shown}
        aria-controls={id}
        className={cn(
          'absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          toggleClassName,
        )}
      >
        {shown ? (
          <EyeOff aria-hidden="true" className="size-4" />
        ) : (
          <Eye aria-hidden="true" className="size-4" />
        )}
      </button>
    </div>
  );
}
