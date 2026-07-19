'use client';

import { FormEvent, useState } from 'react';
import { Sparkles } from 'lucide-react';

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
import { apiFetch, type ChatCitation } from '@/lib/api';

export function ChatPanel({
  tenantId,
  onError,
}: {
  tenantId: string;
  onError: (message: string) => void;
}) {
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState<ChatCitation[]>([]);
  const [isAsking, setIsAsking] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;

    setIsAsking(true);
    try {
      const data = await apiFetch<{
        answer: string;
        citations: ChatCitation[];
      }>(`/api/workspaces/${tenantId}/chat`, {
        method: 'POST',
        body: JSON.stringify({ message: message.trim() }),
      });
      setAnswer(data.answer);
      setCitations(data.citations);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Chat thất bại');
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5" />
          RAG chat
        </CardTitle>
        <CardDescription>
          Hỏi đáp theo tài liệu workspace kèm citations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="flex gap-2" onSubmit={onSubmit}>
          <Input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Tài liệu nói gì về thời hạn thanh toán?"
          />
          <Button type="submit" disabled={isAsking}>
            Hỏi
          </Button>
        </form>

        {answer ? (
          <div className="space-y-3 rounded-lg border bg-muted/30 px-3 py-3 text-sm whitespace-pre-wrap">
            {answer}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Câu trả lời sẽ xuất hiện tại đây cùng các nguồn trích dẫn.
          </p>
        )}

        {citations.length ? (
          <div className="space-y-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Nguồn
            </p>
            {citations.map((citation) => (
              <div
                key={citation.chunkId}
                className="rounded-lg border px-3 py-3 text-sm"
              >
                <div className="mb-1 flex items-center gap-2">
                  <p className="font-medium">{citation.documentName}</p>
                  <Badge variant="outline">
                    score {citation.score.toFixed(2)}
                  </Badge>
                </div>
                <p className="text-muted-foreground">{citation.snippet}</p>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
