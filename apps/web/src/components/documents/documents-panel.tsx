'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, LoaderCircle, Trash2, Upload } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
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
} from '@/lib/api';

const statusLabel: Record<DocumentItem['status'], string> = {
  uploading: 'Đang tải lên',
  processing: 'Đang xử lý',
  ready: 'Sẵn sàng',
  failed: 'Lỗi',
};

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

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            Tài liệu
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
              <Badge
                variant={
                  document.status === 'ready'
                    ? 'secondary'
                    : document.status === 'failed'
                      ? 'destructive'
                      : 'outline'
                }
              >
                {statusLabel[document.status]}
              </Badge>
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
    </Card>
  );
}
