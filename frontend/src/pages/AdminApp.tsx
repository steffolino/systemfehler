import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { useAppAuth } from '@/lib/auth';

const ROLES_CLAIM = 'https://systemfehler/roles';

function getDisplayName(user: Record<string, unknown> | undefined) {
  if (!user) return 'Unknown user';
  return (
    (typeof user.name === 'string' && user.name) ||
    (typeof user.nickname === 'string' && user.nickname) ||
    (typeof user.email === 'string' && user.email) ||
    'Unknown user'
  );
}

export default function AdminApp() {
  const { isAuthenticated, loginWithRedirect, logout, user, isLoading, isConfigured } = useAppAuth();

  const roles = useMemo(() => {
    const rawRoles = user?.[ROLES_CLAIM as keyof typeof user];
    return Array.isArray(rawRoles) ? rawRoles.filter((role): role is string => typeof role === 'string') : [];
  }, [user]);

  const isAdmin = roles.includes('admin');
  const displayName = getDisplayName(user as Record<string, unknown> | undefined);
  const email =
    typeof user?.email === 'string' && user.email ? user.email : null;

  if (!isConfigured) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center justify-center p-6">
        <Card className="w-full max-w-xl p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border text-lg font-semibold">
            A
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin authentication unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Public search is available, but admin access is disabled until Auth0 is configured for this environment.
          </p>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <div className="text-center">
          <div className="text-base font-medium">Loading admin workspace…</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Checking your session and permissions.
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center justify-center p-6">
        <Card className="w-full max-w-xl p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border text-lg font-semibold">
            A
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">Admin access</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to access moderation, quality analytics, duplicate review, and audit tools.
          </p>

          <div className="mt-6">
            <Button onClick={() => loginWithRedirect()} size="lg">
              Login with GitHub
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage moderation workflows, inspect raw data, and review platform quality.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-xl border bg-background px-4 py-3">
          <div className="min-w-0 text-right">
            <div className="truncate text-sm font-medium">{displayName}</div>
            {email && (
              <div className="truncate text-xs text-muted-foreground">{email}</div>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              logout({ logoutParams: { returnTo: window.location.origin } })
            }
          >
            Logout
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <Card className="p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Access level</div>

              <div className="mt-2 flex items-center gap-2">
                <span
                  className={[
                    'inline-flex rounded-full px-2.5 py-1 text-xs font-medium',
                    isAdmin
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800',
                  ].join(' ')}
                >
                  {isAdmin ? 'Read + write' : 'Read only'}
                </span>

                {roles.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Roles: {roles.join(', ')}
                  </span>
                )}
              </div>

              <p className="mt-3 text-sm text-muted-foreground">
                {isAdmin
                  ? 'You can review, edit, approve, reject, and manage administrative workflows.'
                  : 'You can inspect data and dashboards, but write actions should remain disabled.'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="p-5">
          <div className="text-base font-semibold">Moderation Queue</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Review pending entries, resolve edge cases, and process flagged content.
          </p>
          <div className="mt-4">
            <Button asChild variant="outline">
              <Link to="/admin/moderation">Open moderation</Link>
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-base font-semibold">Quality Analytics</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Monitor rejection reasons, score trends, and overall data quality signals.
          </p>
          <div className="mt-4">
            <Button asChild variant="outline">
              <Link to="/admin/quality">Open quality</Link>
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-base font-semibold">Raw Entries</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Inspect source data, translations, metadata, and ingestion output directly.
          </p>
          <div className="mt-4">
            <Button asChild variant="outline">
              <Link to="/admin/raw">Open raw entries</Link>
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-base font-semibold">Duplicate Review</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Compare likely duplicates and resolve merge or rejection decisions.
          </p>
          <div className="mt-4">
            <Button asChild variant="outline">
              <Link to="/admin/duplicates">Open duplicates</Link>
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-base font-semibold">User Trust</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Inspect contributor quality, risk signals, and moderation history.
          </p>
          <div className="mt-4">
            <Button asChild variant="outline">
              <Link to="/admin/user-trust">Open user trust</Link>
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-base font-semibold">Audit Log</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Review administrative actions, decisions, and system-level change history.
          </p>
          <div className="mt-4">
            <Button asChild variant="outline">
              <Link to="/admin/audit-log">Open audit log</Link>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
