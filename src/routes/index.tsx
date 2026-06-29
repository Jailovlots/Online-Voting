import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ShieldCheck, BarChart3, Users, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StudentGov — Online Voting System" },
      { name: "description", content: "Secure, transparent online voting for the Student Government — cast your ballot, meet the candidates, and track live results." },
      { property: "og:title", content: "StudentGov — Online Voting System" },
      { property: "og:description", content: "Secure, transparent online voting for the Student Government." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen">
      <header className="absolute top-0 inset-x-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-primary-foreground">
            <img src="/school-logo.png" alt="School Logo" className="size-10 object-contain" />
            <span className="font-display text-xl">StudentGov</span>
          </Link>
          <Link to="/auth" className="rounded-md bg-gold text-gold-foreground px-4 py-2 text-sm font-medium hover:opacity-90">
            Sign in to vote
          </Link>
        </div>
      </header>

      <section
        className="relative pt-32 pb-24 px-6 text-white overflow-hidden"
        style={{
          backgroundImage: "url('/campus-bg.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* Dark red overlay for readability */}
        <div className="absolute inset-0 z-0" style={{ background: "linear-gradient(135deg, oklch(0.15 0.1 25 / 0.88), oklch(0.25 0.12 25 / 0.75) 60%, oklch(0.1 0.06 25 / 0.82))" }} />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium backdrop-blur border border-white/20">
            <Sparkles className="size-3.5 text-gold" /> Elections 2026 are live
          </div>
          <h1 className="mt-6 font-display text-5xl md:text-7xl leading-[1.05] drop-shadow-lg">
            ZDSPGC<br />
            <span className="text-gold drop-shadow-lg">Dimataling Campus</span>
          </h1>
          <p className="mt-6 text-lg text-white/80 max-w-2xl mx-auto drop-shadow">
            Student Government
            Leading with Purpose, Serving with Heart
            One Vision, One Voice, One Community.
          </p>
          <div className="mt-10 flex flex-wrap gap-3 justify-center">
            <Link to="/auth" className="rounded-md bg-gold text-gold-foreground px-6 py-3 font-medium hover:opacity-90 shadow-lg">
              Sign in with Student ID
            </Link>
            <Link to="/auth" search={{ mode: 'signup' }} className="rounded-md border border-white/30 px-6 py-3 font-medium hover:bg-white/10 backdrop-blur">
              Create account
            </Link>
          </div>
        </div>
        <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 size-[600px] rounded-full bg-gold/20 blur-3xl pointer-events-none" />
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: ShieldCheck, title: "Anonymous & secure", body: "Votes are stored as one-way hashes — no one, not even admins, can trace a ballot back to you." },
            { icon: BarChart3, title: "Real-time results", body: "Live tallies and participation charts the moment polls close." },
            { icon: Users, title: "Know your candidates", body: "Browse platforms, parties, and bios before you make your choice." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="size-10 rounded-lg bg-accent grid place-items-center text-primary">
                <f.icon className="size-5" />
              </div>
              <h3 className="mt-4 font-display text-xl">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © 2026 Student Government · Secure voting powered by StudentGov
      </footer>
    </div>
  );
}
