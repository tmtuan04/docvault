'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink, FileText, LoaderCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

function isPlainTextDocument(mimeType: string): boolean {
  return mimeType === 'text/plain';
}

function isMarkdownDocument(mimeType: string): boolean {
  return mimeType === 'text/markdown';
}

function isTextDocument(mimeType: string): boolean {
  return isPlainTextDocument(mimeType) || isMarkdownDocument(mimeType);
}

export function canPreviewDocument(mimeType: string): boolean {
  return mimeType === 'application/pdf' || isTextDocument(mimeType);
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

function MarkdownPreview({ text }: { text: string }) {
  return (
    <article
      className={cn(
        'h-full overflow-auto bg-background p-5 text-sm leading-7 text-foreground',
        '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
        '[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground',
        '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]',
        '[&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight',
        '[&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold',
        '[&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold',
        '[&_hr]:my-6 [&_hr]:border-border',
        '[&_li]:my-1',
        '[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6',
        '[&_p]:my-3',
        '[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-[0.85em] [&_pre]:leading-6',
        '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
        '[&_strong]:font-semibold',
        '[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left',
        '[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2',
        '[&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-3 [&_th]:py-2 [&_th]:font-medium',
        '[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6',
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </article>
  );
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
                <div className="flex items-center gap-2">
                  <ExternalLink className="size-4 shrink-0" />
                  <span className="text-sm">Mở tab mới</span>
                </div>
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
            ) : isMarkdownDocument(preview.mimeType) ? (
              <MarkdownPreview text={textPreview.text} />
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
