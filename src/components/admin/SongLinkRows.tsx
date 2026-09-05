'use client';

import { Plus, X } from 'lucide-react';
import { useState } from 'react';

import { FieldError } from '@/components/admin/ActionForm';
import { FormSelect } from '@/components/admin/FormSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * The repeatable "where to hear it" rows on a song form.
 *
 * Every row posts `link.platformId` and `link.url`, so the action reads them
 * back as two parallel lists. Rows left blank are dropped server-side rather
 * than rejected — the form always offers one spare, and an untouched spare is
 * not a mistake.
 *
 * Removing a row unmounts it, which is what takes its fields out of the
 * submission. There is no "deleted" flag to keep in step.
 */
export function SongLinkRows({
  platforms,
  initial = [],
}: {
  platforms: Array<{ id: string; name: string }>;
  initial?: Array<{ platformId: string; url: string }>;
}) {
  const [rows, setRows] = useState(() =>
    (initial.length > 0 ? initial : [{ platformId: '', url: '' }]).map((row, index) => ({
      ...row,
      // A stable key that does not change when rows are removed. Using the
      // index would make React reuse the wrong inputs after a removal.
      key: `row-${index}`,
    })),
  );

  const options = platforms.map((platform) => ({ value: platform.id, label: platform.name }));

  if (platforms.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add a platform first — there is nothing to link to yet.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {rows.map((row, index) => (
        <div key={row.key} className="grid gap-2 sm:grid-cols-[minmax(0,14rem)_1fr_auto] sm:items-start">
          <div className="grid gap-1">
            <FormSelect
              name="link.platformId"
              options={options}
              defaultValue={row.platformId}
              placeholder="Platform"
              ariaLabel={`Platform for link ${index + 1}`}
            />
            <FieldError name={`link.${index}.platformId`} />
          </div>

          <div className="grid gap-1">
            <Input
              name="link.url"
              type="url"
              inputMode="url"
              defaultValue={row.url}
              placeholder="https://open.spotify.com/track/…"
              aria-label={`Link ${index + 1}`}
            />
            <FieldError name={`link.${index}.url`} />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove link ${index + 1}`}
            // The last row is kept so the form never presents nothing to fill
            // in; clearing it is how a song ends up with no links.
            disabled={rows.length === 1}
            onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}

      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setRows((current) => [
              ...current,
              { platformId: '', url: '', key: `row-${Date.now()}` },
            ])
          }
        >
          <Plus className="size-4" />
          Add another link
        </Button>
      </div>
    </div>
  );
}
