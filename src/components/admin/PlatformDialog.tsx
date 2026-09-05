'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { ActionForm, FieldError, SubmitButton } from '@/components/admin/ActionForm';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { PlatformLogo } from '@/components/admin/PlatformLogo';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addPlatformAction, deletePlatformAction } from '@/features/songs/actions';
import { LOGO_SIZE } from '@/lib/images/downscale';

type Platform = { id: string; name: string; logoId: string; songCount: number };

/**
 * Add a streaming platform, and manage the ones already registered.
 *
 * TWO COLUMNS, not one long scroll. The dialog does two jobs — add one, and see
 * what is already there — and stacking them made the list of ten push the form
 * off the top and the whole dialog scroll. Side by side, the form stays put and
 * only the list moves.
 *
 * Both jobs belong here: the registry used to be a card on the songs page, and
 * now that the page is a table of songs, removing a platform would have nowhere
 * else to happen.
 *
 * `key` on the form is what resets it after a save — React rebuilds the subtree
 * rather than the fields keeping the last platform's name and logo, which is
 * exactly the state that makes someone think their second platform saved when
 * it did not.
 */
export function PlatformDialog({ platforms }: { platforms: Platform[] }) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="size-4" />
          Add platform
        </Button>
      </DialogTrigger>

      <DialogContent className="admin-theme sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Platforms</DialogTitle>
          <DialogDescription>
            Registered once, then offered as a field on every song.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
          <ActionForm
            key={formKey}
            action={addPlatformAction}
            onSuccess={() => setFormKey((n) => n + 1)}
            className="grid content-start gap-3"
          >
            <div className="grid gap-1.5">
              <Label htmlFor="platform-name" className="text-xs text-muted-foreground">
                Name
              </Label>
              <Input id="platform-name" name="name" placeholder="Spotify" required />
              <FieldError name="name" />
            </div>

            <ImageUploadField
              name="logo"
              label="Logo"
              plate
              frameClassName="h-20 max-w-full"
              sizes={{ logo: LOGO_SIZE }}
            />

            <SubmitButton pendingLabel="Adding…" className="w-full">
              Add platform
            </SubmitButton>
          </ActionForm>

          <div className="grid content-start gap-2">
            <p className="text-xs text-muted-foreground">
              {platforms.length === 0
                ? 'None registered'
                : `${platforms.length} registered`}
            </p>

            {platforms.length === 0 ? (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Add the first one and it becomes a field on every song.
              </p>
            ) : (
              /*
                * Only the list scrolls, and it is capped at roughly six rows so
                * the dialog stays the same height whether there are three
                * platforms or thirty.
                */
              <ul className="grid max-h-[15.5rem] gap-1.5 overflow-y-auto pr-1">
                {platforms.map((platform) => (
                  <li
                    key={platform.id}
                    className="flex items-center gap-2.5 rounded-md border bg-card/50 py-1.5 pl-1.5 pr-1"
                  >
                    <PlatformLogo logoId={platform.logoId} className="h-7 w-11" />

                    <span className="min-w-0 flex-1 truncate text-sm">{platform.name}</span>

                    {/*
                      * The count is why a platform may refuse to be deleted, so
                      * it sits next to the button that would refuse. Nothing is
                      * drawn at zero: a dash beside the bin read as a second
                      * control rather than as an absence.
                      */}
                    {platform.songCount > 0 ? (
                      <span
                        title={`Used by ${platform.songCount} song${platform.songCount === 1 ? '' : 's'}`}
                        className="shrink-0 text-xs tabular-nums text-muted-foreground"
                      >
                        {platform.songCount}
                      </span>
                    ) : null}

                    <ActionForm
                      action={deletePlatformAction}
                      hiddenFields={{ id: platform.id }}
                      className="contents"
                    >
                      <SubmitButton
                        variant="ghost"
                        size="icon"
                        pendingLabel=""
                        className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </SubmitButton>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
