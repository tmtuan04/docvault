import { InviteClient } from './invite-client';

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{
    tenant?: string | string[];
    token?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const tenantId = typeof query.tenant === 'string' ? query.tenant : '';
  const token = typeof query.token === 'string' ? query.token : '';

  if (!tenantId || !token) {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">Liên kết không hợp lệ</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Lời mời thiếu tenant hoặc token.
          </p>
        </div>
      </main>
    );
  }

  return <InviteClient tenantId={tenantId} token={token} />;
}
