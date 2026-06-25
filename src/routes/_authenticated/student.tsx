import { createFileRoute, Outlet } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getMyProfile, getMyRoles } from '@/lib/queries.server';
import { AppShell } from '@/components/app-shell';

export const Route = createFileRoute('/_authenticated/student')({
  component: StudentLayout,
});

function StudentLayout() {
  const profileFn = useServerFn(getMyProfile);
  const rolesFn = useServerFn(getMyRoles);

  const { data } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const [profile, roles] = await Promise.all([profileFn(), rolesFn()]);
      return { profile, isAdmin: roles.includes('admin') };
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
      }}
    >
      <Outlet />
    </AppShell>
  );
}