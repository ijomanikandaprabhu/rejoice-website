'use client';

import { Mail, Phone } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

/**
 * The full enquiry, behind "See more".
 *
 * A table row can only carry one clipped line, but the message IS the enquiry —
 * so the whole text lives here rather than on another page. Reading one no
 * longer means losing your place in the list.
 */

export function EnquiryDialog({
  name,
  email,
  phone,
  subject,
  message,
  receivedLabel,
}: {
  name: string;
  email: string;
  phone?: string | null;
  subject?: string | null;
  message: string;
  receivedLabel: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="link" size="sm" className="h-auto p-0 text-xs">
          See more
        </Button>
      </DialogTrigger>

      <DialogContent className="admin-theme max-w-2xl">
        <DialogHeader>
          <DialogTitle>{subject || `Enquiry from ${name}`}</DialogTitle>
          <DialogDescription>
            {name} · {receivedLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <a
            href={`mailto:${email}`}
            className="inline-flex items-center gap-1.5 hover:text-foreground"
          >
            <Mail className="size-3.5" />
            {email}
          </a>
          {phone ? (
            <a
              href={`tel:${phone.replace(/\s/g, '')}`}
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              <Phone className="size-3.5" />
              {phone}
            </a>
          ) : null}
        </div>

        {/*
         * `whitespace-pre-line` keeps the sender's own line breaks. A message
         * typed as paragraphs should not collapse into a wall of text.
         *
         * Rendered as text, never as markup — this is untrusted input from a
         * public form.
         */}
        <p className="max-h-[50vh] overflow-y-auto whitespace-pre-line text-sm leading-relaxed">
          {message}
        </p>

        <div className="flex justify-end">
          <Button asChild variant="outline" size="sm">
            <a
              href={`mailto:${email}?subject=${encodeURIComponent(`Re: ${subject || 'Your enquiry'}`)}`}
            >
              Reply by email
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
