'use client';

import { FormEvent, useState, type ReactNode } from 'react';
import { FileText, LoaderCircle, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiFetch, type SearchResult } from '@/lib/api';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Wraps every occurrence of the query in <mark> for quick scanning. */
function highlight(text: string, query: string): ReactNode {
  const trimmed = query.trim();
  if (!trimmed) return text;

  const parts = text.split(new RegExp(`(${escapeRegExp(trimmed)})`, 'gi'));

  return parts.map((part, index) =>
    part.toLowerCase() === trimmed.toLowerCase() ? (
      <mark
        key={index}
        className="rounded-sm bg-amber-100 px-0.5 font-medium text-amber-900"
      >
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export function SearchPanel({
  tenantId,
  onError,
}: {
  tenantId: string;
  onError: (message: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;

    setIsSearching(true);
    try {
      const data = await apiFetch<{ results: SearchResult[] }>(
        `/api/workspaces/${tenantId}/search?q=${encodeURIComponent(q)}`,
      );
      setResults(data.results);
      setSubmittedQuery(q);
      setHasSearched(true);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Tìm kiếm thất bại');
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="size-5" />
          Tìm kiếm
        </CardTitle>
        <CardDescription>
          Tìm theo tên tài liệu và nội dung đã index.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="flex gap-2" onSubmit={onSubmit}>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ví dụ: điều khoản bảo mật"
          />
          <Button type="submit" disabled={isSearching}>
            {isSearching ? <LoaderCircle className="animate-spin" /> : null}
            Tìm
          </Button>
        </form>

        {!hasSearched ? (
          <p className="text-sm text-muted-foreground">
            Nhập từ khóa để tìm trong tài liệu đã ở trạng thái Sẵn sàng.
          </p>
        ) : results.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            Không tìm thấy kết quả cho “{submittedQuery}”.
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {results.length} đoạn khớp với “{submittedQuery}”
            </p>
            {results.map((result) => (
              <div
                key={result.chunkId}
                className="space-y-1.5 rounded-lg border px-3 py-3"
              >
                <div className="flex items-center gap-2">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">
                    {result.documentName}
                  </p>
                  <Badge variant="outline">Đoạn {result.chunkIndex + 1}</Badge>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {highlight(result.snippet, submittedQuery)}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
