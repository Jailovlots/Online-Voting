import { createFileRoute, Outlet } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { AppShell } from '@/components/app-shell';

export const Route = createFileRoute('/_authenticated/student')({
  component: StudentLayout,
});

function StudentLayout() {
  const { data } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const rolesData = await api.queries.roles();
      const profile = await api.queries.profile() as any;
      return { profile, isAdmin: rolesData.isAdmin, isOfficer: rolesData.roles.includes('officer') };
    },
  });

  if (!data) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;

  return (
    <AppShell
      variant="student"
      user={{
        name: data.profile?.full_name ?? 'Student',
        email: data.profile?.email ?? '',
        isAdmin: data.isAdmin,
        isOfficer: data.isOfficer,
      }}
    >
      <Outlet />
    </AppShell>
  );
}