import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { signIn, signUp } from '@/lib/auth.functions';
import { saveToken } from '@/lib/session-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Vote, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const COURSES = ['BPED', 'BSIS', 'ACT'] as const;

export const Route = createFileRoute('/auth')({
  head: () => ({ meta: [{ title: 'Sign in — StudentGov' }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const signInFn = useServerFn(signIn);
  const signUpFn = useServerFn(signUp);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') || '').trim();
    const password = String(fd.get('password') || '');
    setLoading(true);
    try {
      if (mode === 'signup') {
        const full_name = String(fd.get('full_name') || '').trim();
        const student_id = String(fd.get('student_id') || '').trim();
        const course = String(fd.get('course') || '').trim();
        const year_level = String(fd.get('year_level') || '1');
        const section = String(fd.get('section') || '').trim();
        await signUpFn({ data: { email, password, full_name, student_id, course, year_level, section } });
        toast.success('Account created — you can sign in now.');
        setMode('signin');
        setShowPassword(false);
      } else {
        const result = await signInFn({ data: { email, password } });
        saveToken(result.token);
        toast.success('Welcome back!');
        navigate({ to: result.isAdmin ? '/admin/dashboard' : '/student/dashboard', replace: true });
      }
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between p-12 text-primary-foreground relative overflow-hidden" style={{ background: 'var(--gradient-hero)' }}>
        <Link to="/" className="flex items-center gap-2">
          <div className="size-9 rounded-lg grid place-items-center" style={{ background: 'var(--gradient-gold)' }}>
            <Vote className="size-5 text-primary" />
          </div>
          <span className="font-display text-xl">StudentGov</span>
        </Link>
        <div>
          <h2 className="font-display text-4xl leading-tight">
            Every voice counts. <span className="text-gold">Make yours heard.</span>
          </h2>
          <p className="mt-4 text-primary-foreground/80 max-w-md">
            Sign in with your student credentials to access the official ballot for the 2026 Student Government elections.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">© 2026 Student Government</p>
        <div className="absolute -bottom-40 -right-20 size-[400px] rounded-full bg-gold/20 blur-3xl" />
      </div>

      <div className="flex items-center justify-center p-6 md:p-12">
        <Card className="w-full max-w-md p-8 shadow-[var(--shadow-elegant)]">
          <h1 className="font-display text-3xl">
            {mode === 'signup' ? 'Create account' : 'Welcome back'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === 'signup'
              ? 'Register with your school email to receive your ballot.'
              : 'Sign in to cast your vote.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === 'signup' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="full_name">Full name</Label>
                    <Input id="full_name" name="full_name" required maxLength={120} />
                  </div>
                  <div>
                    <Label htmlFor="student_id">Student ID</Label>
                    <Input id="student_id" name="student_id" required maxLength={40} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="course">Course</Label>
                    <Select name="course" required>
                      <SelectTrigger id="course">
                        <SelectValue placeholder="Select course" />
                      </SelectTrigger>
                      <SelectContent>
                        {COURSES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="year_level">Year</Label>
                    <Input id="year_level" name="year_level" type="number" min={1} max={6} defaultValue={1} />
                  </div>
                  <div>
                    <Label htmlFor="section">Section</Label>
                    <Input id="section" name="section" placeholder="e.g. A" required maxLength={10} />
                  </div>
                </div>
              </>
            )}
            <div>
              <Label htmlFor="email">School email</Label>
              <Input id="email" name="email" type="email" required maxLength={255} />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  maxLength={72}
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
            <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground">
              {loading ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-6 text-sm text-muted-foreground space-y-2 text-center">
            {mode === 'signin' ? (
              <div>
                New here?{' '}
                <button
                  className="text-primary font-medium hover:underline"
                  onClick={() => { setMode('signup'); setShowPassword(false); }}
                >
                  Create an account
                </button>
              </div>
            ) : (
              <button
                className="hover:underline"
                onClick={() => { setMode('signin'); setShowPassword(false); }}
              >
                ← Back to sign in
              </button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}