import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { updatePassword } from '@/lib/auth.functions';
import { clearToken } from '@/lib/session-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/reset-password')({
  head: () => ({ meta: [{ title: 'Reset password — StudentGov' }] }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const updatePasswordFn = useServerFn(updatePassword);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get('password') || '');
    setLoading(true);
    try {
      await updatePasswordFn({ data: { password } });
      toast.success('Password updated. Please sign in again.');
      clearToken();
      navigate({ to: '/auth', replace: true });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <Card className="w-full max-w-md p-8">
        <h1 className="font-display text-2xl">Set a new password</h1>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div>
            <Label htmlFor="password">New password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                minLength={8}
                maxLength={72}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <Button disabled={loading} type="submit" className="w-full">
            {loading ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </Card>
    </div>
  );
}