import { createFileRoute, Outlet, Navigate, useRouterState } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data, isLoading } = useQuery({
    queryKey: ['me', 'admin'],
    queryFn: async () => {
      const rolesData = await api.queries.roles();
      const profile = await api.queries.profile();
      return {
        profile,
        isAdmin: rolesData.isAdmin,
        isOfficer: rolesData.roles.includes('officer'),
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