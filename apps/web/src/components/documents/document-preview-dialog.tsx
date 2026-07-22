'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink, FileText, LoaderCircle } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { buttonVariants } from '@/components/ui/button';
import { type DocumentPreview } from '@/lib/api';
import { cn } from '@/lib/utils';

function isTextDocument(mimeType: string): boolean {
  return mimeType === 'text/plain';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const firstMatchRef = useRef<HTMLElement>(null);
  const trimmed = query.trim();
  const pattern = trimmed
    .split(/\s+/)
    .map(escapeRegExp)
    .join('\\s+');
  const parts = pattern ? text.split(new RegExp(`(${pattern})`, 'gi')) : [text];
  const exactMatch = pattern ? new RegExp(`^${pattern}$`, 'i') : null;
  const firstMatchPartIndex = parts.findIndex((part) => exactMatch?.test(part));

  useEffect(() => {
    firstMatchRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, [query, text]);

  return parts.map((part, index) => {
    if (!exactMatch?.test(part)) return part;

    return (
      <mark
        key={index}
        ref={index === firstMatchPartIndex ? firstMatchRef : undefined}
        className="rounded-sm bg-amber-200 px-0.5 text-amber-950"
      >
        {part}
      </mark>
    );
  });
}

export function DocumentPreviewDialog({
  open,
  onOpenChange,
  preview,
  highlightText = '',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: DocumentPreview | null;
  highlightText?: string;
}) {
  const [textPreview, setTextPreview] = useState<{
    url: string;
    text: string;
    error: string;
  } | null>(null);

  useEffect(() => {
    if (!open || !preview || !isTextDocument(preview.mimeType)) {
      return;
    }

    const controller = new AbortController();

    fetch(preview.downloadUrl, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Không tải được nội dung (${response.status})`);
        }
        return response.text();
      })
      .then((text) => {
        setTextPreview({ url: preview.downloadUrl, text, error: '' });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setTextPreview({
          url: preview.downloadUrl,
          text: '',
          error:
            cause instanceof Error ? cause.message : 'Không tải được nội dung',
        });
      });

    return () => controller.abort();
  }, [open, preview]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-h-[90vh] flex-col gap-3 sm:max-w-[min(1100px,calc(100%-2rem))]">
        <DialogHeader className="min-w-0 pr-10">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate">
                {preview?.name ?? 'Xem tài liệu'}
              </DialogTitle>
              <DialogDescription>
                {preview?.mimeType ?? 'Đang chuẩn bị tài liệu'}
              </DialogDescription>
            </div>
            {preview ? (
              <a
                href={preview.downloadUrl}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'shrink-0',
                )}
              >
                <ExternalLink />
                Mở tab mới
              </a>
            ) : null}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-muted/30">
          {!preview ? (
            <div className="grid h-full place-items-center">
              <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : preview.mimeType === 'application/pdf' ? (
            <iframe
              src={preview.downloadUrl}
              title={preview.name}
              referrerPolicy="no-referrer"
              className="h-full w-full bg-white"
            />
          ) : isTextDocument(preview.mimeType) ? (
            textPreview?.url !== preview.downloadUrl ? (
              <div className="grid h-full place-items-center">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" />
                  Đang tải nội dung…
                </div>
              </div>
            ) : textPreview.error ? (
              <div className="grid h-full place-items-center px-6 text-center text-sm text-destructive">
                {textPreview.error}
              </div>
            ) : (
              <pre className="h-full overflow-auto whitespace-pre-wrap break-words p-5 font-mono text-sm leading-6">
                <HighlightedText
                  text={textPreview.text}
                  query={highlightText}
                />
              </pre>
            )
          ) : (
            <div className="grid h-full place-items-center px-6 text-center">
              <div>
                <FileText className="mx-auto mb-3 size-8 text-muted-foreground" />
                <p className="font-medium">Chưa hỗ trợ xem định dạng này</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Hãy mở tài liệu trong tab mới để xem hoặc tải xuống.
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
