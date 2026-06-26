import { createFileRoute, Outlet, Navigate, useRouterState } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getMyProfile, getMyRoles } from '@/lib/queries.server';
import { AppShell } from '@/components/app-shell';

// Routes that officers are allowed to access
const OFFICER_ALLOWED_ROUTES = [
  '/admin/dashboard',
  '/admin/students',
  '/admin/candidates',
];

export const Route = createFileRoute('/_authenticated/admin')({
  component: AdminLayout,
});

function AdminLayout() {
  const profileFn = useServerFn(getMyProfile);
  const rolesFn = useServerFn(getMyRoles);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data, isLoading } = useQuery({
    queryKey: ['me', 'admin'],
    queryFn: async () => {
      const [profile, roles] = await Promise.all([profileFn(), rolesFn()]);
      return {
        profile,
        isAdmin: roles.includes('admin'),
        isOfficer: roles.includes('officer'),
      };
    },
  });

  if (isLoading || !data) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;

  // Neither admin nor officer — redirect to student area
  if (!data.isAdmin && !data.isOfficer) return <Navigate to="/student/dashboard" replace />;

  // Officer trying to access a restricted admin route — redirect to overview
  if (!data.isAdmin && data.isOfficer) {
    const allowed = OFFICER_ALLOWED_ROUTES.some((r) => pathname.startsWith(r));
    if (!allowed) return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <AppShell
      variant="admin"
      user={{
        name: data.profile?.full_name ?? 'Admin',
        email: data.profile?.email ?? '',
        isAdmin: data.isAdmin,
        isOfficer: data.isOfficer,
      }}
    >
      <Outlet />
    </AppShell>
  );
}