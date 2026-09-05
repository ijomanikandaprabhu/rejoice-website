'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { ActionForm, Field, FieldError, SubmitButton } from '@/components/admin/ActionForm';
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
import { Separator } from '@/components/ui/separator';
import { addPlatformAction, deletePlatformAction } from '@/features/songs/actions';
import { LOGO_SIZE } from '@/lib/images/downscale';

type Platform = { id: string; name: string; logoId: string; songCount: number };

/**
 * Add a streaming platform, and manage the ones already registered.
 *
 * Both jobs live in one dialog on purpose. The platform list used to be a card
 * on the songs page; now that the page is a table of songs, removing a platform
 * would have nowhere to happen if this only offered "add".
 *
 * `key` on the form is what resets it after a save — React rebuilds the subtree
 * rather than the fields keeping the last platform's name and logo, which is
 * exactly the state that makes someone think their second platform saved
 * when it did not.
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

      <DialogContent className="admin-theme max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Platforms</DialogTitle>
          <DialogDescription>
            Registered once, then offered as a field on every song.
          </DialogDescription>
        </DialogHeader>

        <ActionForm
          key={formKey}
          action={addPlatformAction}
          onSuccess={() => setFormKey((n) => n + 1)}
        >
          <Field label="Name" htmlFor="platform-name">
            <Input id="platform-name" name="name" placeholder="Spotify" required />
            <FieldError name="name" />
          </Field>

          <ImageUploadField
            name="logo"
            label="Logo"
            plate
            hint="PNG, JPEG or WebP. Resized here before uploading."
            sizes={{ logo: LOGO_SIZE }}
          />

          <SubmitButton pendingLabel="Adding…">Add platform</SubmitButton>
        </ActionForm>

        {platforms.length > 0 ? (
          <>
            <Separator />

            <ul className="grid gap-2">
              {platforms.map((platform) => (
                <li key={platform.id} className="flex items-center gap-3 rounded-md border p-2">
                  <PlatformLogo logoId={platform.logoId} className="h-9 w-14" />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{platform.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {platform.songCount === 0
                        ? 'Not used yet'
                        : `${platform.songCount} song${platform.songCount === 1 ? '' : 's'}`}
                    </span>
                  </span>

                  <ActionForm
                    action={deletePlatformAction}
                    hiddenFields={{ id: platform.id }}
                    className="contents"
                  >
                    <SubmitButton
                      variant="ghost"
                      size="icon"
                      pendingLabel=""
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
