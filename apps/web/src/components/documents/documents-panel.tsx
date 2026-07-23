'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Check,
  CircleAlert,
  Eye,
  FileText,
  LoaderCircle,
  Trash2,
  Upload,
} from 'lucide-react';

import {
  canPreviewDocument,
  DocumentPreviewDialog,
} from '@/components/documents/document-preview-dialog';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  apiFetch,
  uploadDocumentFile,
  type DocumentItem,
  type DocumentPreview,
} from '@/lib/api';

const statusLabel: Record<DocumentItem['status'], string> = {
  uploading: 'Đang tải lên',
  processing: 'Đang xử lý',
  ready: 'Sẵn sàng',
  failed: 'Lỗi',
};

function DocumentStatusIcon({ status }: { status: DocumentItem['status'] }) {
  if (status === 'ready') {
    return (
      <span
        title={statusLabel.ready}
        aria-label={statusLabel.ready}
        className="grid size-8 shrink-0 place-items-center"
      >
        <Check className="size-4 text-emerald-600" strokeWidth={2.5} />
      </span>
    );
  }

  if (status === 'failed') {
    return (
      <span
        title={statusLabel.failed}
        aria-label={statusLabel.failed}
        className="grid size-8 shrink-0 place-items-center"
      >
        <CircleAlert className="size-4 text-destructive" />
      </span>
    );
  }

  return (
    <span
      title={statusLabel[status]}
      aria-label={statusLabel[status]}
      className="grid size-8 shrink-0 place-items-center"
    >
      <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
    </span>
  );
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsPanel({
  tenantId,
  canWrite,
  onError,
}: {
  tenantId: string;
  canWrite: boolean;
  onError: (message: string) => void;
}) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loadedTenantId, setLoadedTenantId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [preview, setPreview] = useState<DocumentPreview | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loadingPreviewId, setLoadingPreviewId] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const isLoading = loadedTenantId !== tenantId;

  useEffect(() => {
    let cancelled = false;

    apiFetch<DocumentItem[]>(`/api/workspaces/${tenantId}/documents`)
      .then((data) => {
        if (cancelled) return;
        setDocuments(data);
        setLoadedTenantId(tenantId);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        onError(
          cause instanceof Error ? cause.message : 'Không tải được tài liệu',
        );
        setLoadedTenantId(tenantId);
      });

    return () => {
      cancelled = true;
    };
  }, [tenantId, onError, refreshKey]);

  useEffect(() => {
    const shouldPoll = documents.some(
      (document) =>
        document.status === 'processing' || document.status === 'uploading',
    );
    if (!shouldPoll) return;

    const timer = window.setInterval(() => {
      setRefreshKey((current) => current + 1);
    }, 2500);

    return () => window.clearInterval(timer);
  }, [documents]);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length || !canWrite) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        await uploadDocumentFile({ tenantId, file });
      }
      setRefreshKey((current) => current + 1);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Upload thất bại');
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function removeDocument(documentId: string) {
    try {
      await apiFetch(`/api/workspaces/${tenantId}/documents/${documentId}`, {
        method: 'DELETE',
      });
      setRefreshKey((current) => current + 1);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Xóa thất bại');
    }
  }

  async function openPreview(documentId: string) {
    setLoadingPreviewId(documentId);
    try {
      const result = await apiFetch<DocumentPreview>(
        `/api/workspaces/${tenantId}/documents/${documentId}/download-url`,
      );
      setPreview(result);
      setPreviewOpen(true);
    } catch (cause) {
      onError(
        cause instanceof Error ? cause.message : 'Không mở được tài liệu',
      );
    } finally {
      setLoadingPreviewId('');
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 leading-none">
            <FileText className="size-4 shrink-0" />
            <span className="translate-y-px">Tài liệu</span>
          </CardTitle>
          <CardDescription>
            Hỗ trợ PDF, DOCX, TXT, MD. Worker sẽ extract và index sau khi upload.
          </CardDescription>
        </div>
        {canWrite ? (
          <>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.docx,.txt,.md,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => {
                void handleFiles(event.target.files);
              }}
            />
            <Button
              variant="outline"
              disabled={isUploading}
              onClick={() => inputRef.current?.click()}
            >
              {isUploading ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Upload />
              )}
              Upload
            </Button>
          </>
        ) : null}
      </CardHeader>
      <CardContent
        className="space-y-2"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (!canWrite) return;
          void handleFiles(event.dataTransfer.files);
        }}
      >
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Đang tải danh sách…</p>
        ) : documents.length === 0 ? (
          <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            Kéo thả file vào đây hoặc bấm Upload để bắt đầu.
          </div>
        ) : (
          documents.map((document) => (
            <div
              key={document.id}
              className="flex items-center gap-3 rounded-lg border px-3 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{document.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(document.sizeBytes)} · {document.mimeType}
                </p>
              </div>
              <DocumentStatusIcon status={document.status} />
              {document.status === 'ready' &&
              canPreviewDocument(document.mimeType) ? (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Xem ${document.name}`}
                  disabled={loadingPreviewId === document.id}
                  onClick={() => {
                    void openPreview(document.id);
                  }}
                >
                  {loadingPreviewId === document.id ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <Eye />
                  )}
                </Button>
              ) : null}
              {canWrite ? (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Xóa tài liệu"
                  onClick={() => {
                    void removeDocument(document.id);
                  }}
                >
                  <Trash2 />
                </Button>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
      <DocumentPreviewDialog
        open={previewOpen}
        preview={preview}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) setPreview(null);
        }}
      />
    </Card>
  );
}
