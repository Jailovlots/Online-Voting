import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { ReactNode, useState } from "react";
import { clearToken } from "@/lib/session-store";
import { Vote, LayoutDashboard, Users, Megaphone, ScrollText, Trophy, Calendar, UserCircle, Settings, LogOut, ShieldCheck, ListChecks, Menu, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

type Item = { to: string; label: string; icon: any };

const studentNav: Item[] = [
  { to: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/student/candidates", label: "Candidates", icon: Users },
  { to: "/student/vote", label: "Cast Ballot", icon: Vote },
  { to: "/student/announcements", label: "Announcements", icon: Megaphone },
  { to: "/student/profile", label: "My Profile", icon: UserCircle },
];

const adminNav: Item[] = [
  { to: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/students", label: "Students", icon: Users },
  { to: "/admin/elections", label: "Elections", icon: Calendar },
  { to: "/admin/candidates", label: "Candidates", icon: Users },
  { to: "/admin/positions", label: "Positions", icon: ListChecks },
  { to: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { to: "/admin/results", label: "Results", icon: Trophy },
  { to: "/admin/audit", label: "Audit Logs", icon: ScrollText },
];

export function AppShell({
  variant,
  user,
  children,
}: {
  variant: "student" | "admin";
  user: { name: string; email: string; isAdmin: boolean };
  children: ReactNode;
}) {
  const nav = variant === "admin" ? adminNav : studentNav;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    clearToken();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="px-6 py-5 border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-9 rounded-lg grid place-items-center" style={{ background: "var(--gradient-gold)" }}>
              <Vote className="size-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <div className="font-display text-lg leading-tight">StudentGov</div>
              <div className="text-xs text-sidebar-foreground/60 capitalize">{variant} portal</div>
            </div>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
          {variant === "student" && user.isAdmin && (
            <Link
              to="/admin/dashboard"
              className="mt-4 flex items-center gap-3 rounded-md px-3 py-2 text-sm bg-gold text-gold-foreground font-medium"
            >
              <ShieldCheck className="size-4" /> Switch to Admin
            </Link>
          )}
          {variant === "admin" && (
            <Link
              to="/student/dashboard"
              className="mt-4 flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent"
            >
              <UserCircle className="size-4" /> Student view
            </Link>
          )}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="size-9 rounded-full bg-sidebar-accent grid place-items-center font-semibold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{user.name}</div>
              <div className="text-xs text-sidebar-foreground/60 truncate">{user.email}</div>
            </div>
            <button onClick={signOut} className="p-2 rounded hover:bg-sidebar-accent" title="Sign out">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside 
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-6 py-5 border-b border-sidebar-border flex items-center justify-between">
          <Link to="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2">
            <div className="size-9 rounded-lg grid place-items-center" style={{ background: "var(--gradient-gold)" }}>
              <Vote className="size-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <div className="font-display text-lg leading-tight">StudentGov</div>
              <div className="text-xs text-sidebar-foreground/60 capitalize">{variant} portal</div>
            </div>
          </Link>
          <button onClick={() => setMobileMenuOpen(false)} className="p-1 rounded hover:bg-sidebar-accent text-sidebar-foreground" title="Close menu">
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
          {variant === "student" && user.isAdmin && (
            <Link
              to="/admin/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="mt-4 flex items-center gap-3 rounded-md px-3 py-2 text-sm bg-gold text-gold-foreground font-medium"
            >
              <ShieldCheck className="size-4" /> Switch to Admin
            </Link>
          )}
          {variant === "admin" && (
            <Link
              to="/student/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="mt-4 flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent"
            >
              <UserCircle className="size-4" /> Student view
            </Link>
          )}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="size-9 rounded-full bg-sidebar-accent grid place-items-center font-semibold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{user.name}</div>
              <div className="text-xs text-sidebar-foreground/60 truncate">{user.email}</div>
            </div>
            <button onClick={() => { setMobileMenuOpen(false); signOut(); }} className="p-2 rounded hover:bg-sidebar-accent" title="Sign out">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="md:hidden flex items-center justify-between border-b px-4 py-3 bg-card">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="p-1 rounded hover:bg-muted text-foreground"
              aria-label="Toggle menu"
            >
              <Menu className="size-6" />
            </button>
            <Link to="/" className="font-display text-lg font-semibold">StudentGov</Link>
          </div>
          <button onClick={signOut} className="p-2 rounded hover:bg-muted" title="Sign out">
            <LogOut className="size-5 text-muted-foreground" />
          </button>
        </header>
        <div className="p-4 md:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}