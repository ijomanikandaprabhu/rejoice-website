'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useFormStatus } from 'react-dom';

import { Checkbox } from '@/components/ui/checkbox';

/**
 * Row selection shared by the admin tables.
 *
 * Selection lives in React state here rather than in the table, so the rows stay
 * Server Components: only ids cross the client boundary, never row data.
 *
 * Generic over ids on purpose — the videos table and the enquiries table both
 * use these, and each supplies its own action bar.
 */

type BulkContext = {
  selected: Set<string>;
  toggle: (id: string) => void;
  setMany: (ids: string[], checked: boolean) => void;
  /** True once the administrator escalates from "this page" to "everything matching". */
  allMatching: boolean;
  setAllMatching: (value: boolean) => void;
  clear: () => void;
};

const Ctx = createContext<BulkContext | null>(null);

export function useBulk(): BulkContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('Bulk selection components must be inside <BulkProvider>.');
  return ctx;
}

export function BulkProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);

  const value = useMemo<BulkContext>(
    () => ({
      selected,
      allMatching,
      setAllMatching,
      toggle: (id) =>
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          // Unticking a row means the set is no longer "everything matching".
          setAllMatching(false);
          return next;
        }),
      setMany: (ids, checked) =>
        setSelected((prev) => {
          const next = new Set(prev);
          for (const id of ids) {
            if (checked) next.add(id);
            else next.delete(id);
          }
          if (!checked) setAllMatching(false);
          return next;
        }),
      clear: () => {
        setSelected(new Set());
        setAllMatching(false);
      },
    }),
    [selected, allMatching],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function RowCheckbox({ id }: { id: string }) {
  const { selected, toggle } = useBulk();
  return (
    <Checkbox
      checked={selected.has(id)}
      onCheckedChange={() => toggle(id)}
      aria-label="Select this row"
    />
  );
}

export function SelectAllCheckbox({ ids }: { ids: string[] }) {
  const { selected, setMany } = useBulk();
  const onPage = ids.filter((id) => selected.has(id)).length;
  const state = onPage === 0 ? false : onPage === ids.length ? true : 'indeterminate';

  return (
    <Checkbox
      checked={state}
      onCheckedChange={(checked) => setMany(ids, checked === true)}
      aria-label="Select every row on this page"
    />
  );
}
/**
 * Drops the selection once the action has finished.
 *
 * Left ticked, the rows stay selected against a list that has already changed —
 * so a second click would re-apply the verb to a stale set. Clearing must happen
 * AFTER the submit, never in `onSubmit`: the hidden inputs are rendered from this
 * same state, and emptying it first would strip them before React serialises the
 * form.
 *
 * `useFormStatus` only reports the form it is rendered inside, which is why this
 * is a child rather than a hook in the bar.
 */
export function ClearWhenDone({ onDone }: { onDone: () => void }) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) onDone();
    wasPending.current = pending;
  }, [pending, onDone]);

  return null;
}
