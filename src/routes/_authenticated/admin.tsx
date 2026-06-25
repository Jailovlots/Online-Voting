import { createFileRoute, Outlet, Navigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getMyProfile, getMyRoles } from '@/lib/queries.server';
import { AppShell } from '@/components/app-shell';

export const Route = createFileRoute('/_authenticated/admin')({
  component: AdminLayout,
});

function AdminLayout() {
  const profileFn = useServerFn(getMyProfile);
  const rolesFn = useServerFn(getMyRoles);

  const { data, isLoading } = useQuery({
    queryKey: ['me', 'admin'],
    queryFn: async () => {
      const [profile, roles] = await Promise.all([profileFn(), rolesFn()]);
      return { profile, isAdmin: roles.includes('admin') };
    },
  });

  if (isLoading || !data) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!data.isAdmin) return <Navigate to="/student/dashboard" replace />;

  return (
    <AppShell
      variant="admin"
      user={{
        name: data.profile?.full_name ?? 'Admin',
        email: data.profile?.email ?? '',
        isAdmin: true,
      }}
    >
      <Outlet />
    </AppShell>
  );
}