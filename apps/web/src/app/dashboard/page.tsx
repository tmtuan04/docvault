'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  FileText,
  LoaderCircle,
  LogOut,
  Plus,
  Search,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch, type Workspace, type WorkspaceMember } from '@/lib/api';
import { authClient } from '@/lib/auth-client';

const roleLabel: Record<Workspace['role'], string> = {
  owner: 'Chủ sở hữu',
  admin: 'Quản trị',
  member: 'Thành viên',
  viewer: 'Chỉ xem',
};

export default function DashboardPage() {
  const router = useRouter();
  const session = authClient.useSession();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>(
    'member',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteResult, setInviteResult] = useState('');

  const selected = useMemo(
    () => workspaces.find((workspace) => workspace.id === selectedId) ?? null,
    [selectedId, workspaces],
  );

  useEffect(() => {
    if (!session.isPending && !session.data) {
      router.replace('/login');
    }
  }, [router, session.data, session.isPending]);

  useEffect(() => {
    if (!session.data?.user.id) return;

    let cancelled = false;
    apiFetch<Workspace[]>('/api/workspaces')
      .then((data) => {
        if (cancelled) return;
        setWorkspaces(data);
        const remembered = window.localStorage.getItem('docvault-workspace');
        const initial =
          data.find((workspace) => workspace.id === remembered)?.id ??
          data[0]?.id ??
          '';
        setSelectedId(initial);
        setIsLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(
          cause instanceof Error ? cause.message : 'Không thể tải workspace',
        );
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session.data?.user.id]);

  useEffect(() => {
    if (!selectedId) return;

    window.localStorage.setItem('docvault-workspace', selectedId);
    let cancelled = false;
    apiFetch<WorkspaceMember[]>(`/api/workspaces/${selectedId}/members`)
      .then((data) => {
        if (!cancelled) setMembers(data);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : 'Không thể tải thành viên',
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const workspace = await apiFetch<Workspace>('/api/workspaces', {
        method: 'POST',
        body: JSON.stringify({ name: workspaceName }),
      });
      setWorkspaces((current) => [workspace, ...current]);
      setSelectedId(workspace.id);
      setWorkspaceName('');
      setCreateOpen(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Không thể tạo workspace',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;

    setError('');
    setInviteResult('');
    setIsSubmitting(true);

    try {
      const result = await apiFetch<{ inviteUrl?: string }>(
        `/api/workspaces/${selected.id}/invitations`,
        {
          method: 'POST',
          body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
        },
      );
      setInviteResult(
        result.inviteUrl ??
          'Đã tạo lời mời. Email provider sẽ gửi liên kết cho người nhận.',
      );
      setInviteEmail('');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Không thể tạo lời mời',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function signOut() {
    await authClient.signOut();
    router.replace('/login');
    router.refresh();
  }

  if (session.isPending || isLoading) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl space-y-6 px-6 py-8">
        <Skeleton className="h-12 w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </main>
    );
  }

  if (!session.data) return null;

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-4">
          <div className="flex items-center gap-2 font-semibold">
            <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <FileText className="size-4" />
            </div>
            <span className="hidden sm:inline">DocVault</span>
          </div>

          <Separator orientation="vertical" className="h-7" />

          {workspaces.length ? (
            <Select
              value={selectedId}
              onValueChange={(value) => {
                if (value) setSelectedId(value);
              }}
              items={workspaces.map((workspace) => ({
                value: workspace.id,
                label: workspace.name,
              }))}
            >
              <SelectTrigger className="w-full max-w-64">
                <SelectValue placeholder="Chọn workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm text-muted-foreground">
              Chưa có workspace
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setCreateOpen(true)}
              className="hidden sm:flex"
            >
              <Plus />
              Tạo workspace
            </Button>
            <Avatar>
              {session.data.user.image ? (
                <AvatarImage src={session.data.user.image} />
              ) : null}
              <AvatarFallback>
                {(session.data.user.name || session.data.user.email)
                  .slice(0, 2)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              aria-label="Đăng xuất"
            >
              <LogOut />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Đã xảy ra lỗi</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {!selected ? (
          <Card className="mx-auto max-w-xl text-center">
            <CardHeader>
              <div className="mx-auto mb-2 grid size-12 place-items-center rounded-xl bg-muted">
                <Building2 className="size-6" />
              </div>
              <CardTitle>Tạo workspace đầu tiên</CardTitle>
              <CardDescription>
                Workspace mới nhận 14 ngày dùng thử gói Team.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus />
                Tạo workspace
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight">
                    {selected.name}
                  </h1>
                  <Badge variant="secondary">{roleLabel[selected.role]}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selected.trial.isExpired
                    ? 'Thời gian dùng thử đã kết thúc.'
                    : `Còn ${selected.trial.daysRemaining} ngày dùng thử Team.`}
                </p>
              </div>
              {selected.role === 'owner' || selected.role === 'admin' ? (
                <Button variant="outline" onClick={() => setInviteOpen(true)}>
                  <UserPlus />
                  Mời thành viên
                </Button>
              ) : null}
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <Search className="size-5 text-muted-foreground" />
                  <CardTitle>Tìm kiếm tài liệu</CardTitle>
                  <CardDescription>
                    Keyword search sẽ được bật ở bước Docs/RAG tiếp theo.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <Sparkles className="size-5 text-muted-foreground" />
                  <CardTitle>RAG chat</CardTitle>
                  <CardDescription>
                    Hỏi đáp có citations sau khi ingest pipeline hoàn thành.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <Users className="size-5 text-muted-foreground" />
                  <CardTitle>{members.length} thành viên</CardTitle>
                  <CardDescription>
                    Quyền truy cập được quản lý theo workspace role.
                  </CardDescription>
                </CardHeader>
              </Card>
            </section>

            <Card>
              <CardHeader>
                <CardTitle>Thành viên</CardTitle>
                <CardDescription>
                  Những người hiện có quyền truy cập workspace.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-muted/60"
                  >
                    <Avatar size="sm">
                      {member.image ? <AvatarImage src={member.image} /> : null}
                      <AvatarFallback>
                        {(member.name || member.email)
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {member.name || member.email}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {member.email}
                      </p>
                    </div>
                    <Badge variant="outline">{roleLabel[member.role]}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <form onSubmit={createWorkspace}>
            <DialogHeader>
              <DialogTitle>Tạo workspace</DialogTitle>
              <DialogDescription>
                Bạn sẽ là owner và nhận 14 ngày dùng thử Team.
              </DialogDescription>
            </DialogHeader>
            <div className="my-5 space-y-2">
              <Label htmlFor="workspace-name">Tên workspace</Label>
              <Input
                id="workspace-name"
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                placeholder="Công ty Demo"
                minLength={2}
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <LoaderCircle className="animate-spin" />
                ) : null}
                Tạo workspace
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          setInviteOpen(open);
          if (!open) setInviteResult('');
        }}
      >
        <DialogContent>
          <form onSubmit={createInvitation}>
            <DialogHeader>
              <DialogTitle>Mời thành viên</DialogTitle>
              <DialogDescription>
                Tạo liên kết mời có hiệu lực trong 7 ngày.
              </DialogDescription>
            </DialogHeader>
            <div className="my-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="dongnghiep@congty.vn"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Vai trò</Label>
                <Select
                  value={inviteRole}
                  onValueChange={(value) => {
                    if (value) setInviteRole(value as typeof inviteRole);
                  }}
                  items={[
                    { value: 'admin', label: 'Quản trị' },
                    { value: 'member', label: 'Thành viên' },
                    { value: 'viewer', label: 'Chỉ xem' },
                  ]}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Quản trị</SelectItem>
                    <SelectItem value="member">Thành viên</SelectItem>
                    <SelectItem value="viewer">Chỉ xem</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {inviteResult ? (
                <Alert>
                  <AlertTitle>Đã tạo lời mời</AlertTitle>
                  <AlertDescription className="break-all">
                    {inviteResult}
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <LoaderCircle className="animate-spin" />
                ) : null}
                Tạo lời mời
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
