import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { Vote, Calendar, CheckCircle2, Users, Megaphone, Clock } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { motion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { hasVoted } from "@/lib/voting.functions";
import { getDashboardStats, getMyRegistrationStatus } from "@/lib/queries.server";

export const Route = createFileRoute("/_authenticated/student/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — StudentGov" }] }),
  component: Dashboard,
});

function useCountdown(target: Date | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!target) return null;
  const diff = Math.max(0, target.getTime() - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s, done: diff === 0 };
}

function Dashboard() {
  const hasVotedFn = useServerFn(hasVoted);
  const statsFn = useServerFn(getDashboardStats);
  const getRegistrationFn = useServerFn(getMyRegistrationStatus);
  const { data } = useQuery({
    queryKey: ["student-dashboard"],
    queryFn: async () => {
      const [stats, registration] = await Promise.all([
        statsFn(),
        getRegistrationFn(),
      ]);
      const active = stats.elections.find((e: any) => e.status === "active") ?? stats.elections[0] ?? null;
      let voted = false;
      if (active) {
        const r = await hasVotedFn({ data: { electionId: active.id } });
        voted = r.voted;
      }
      return { active, announcements: stats.announcements, positionCount: stats.positionsCount, candidateCount: stats.candidatesCount, voteCount: stats.votesCount, voted, isApproved: registration?.isApproved ?? false };
    },
    staleTime: 0,          // Always consider data stale so re-mount forces a fresh fetch
    refetchInterval: 10000, // Poll every 10 s so admin approval reflects within ~10 seconds
    refetchOnWindowFocus: true, // Re-fetch when student returns to the tab
  });

  const end = data?.active ? new Date(data.active.ends_at) : null;
  const cd = useCountdown(end);

  const participationData = [
    { name: "Cast", value: data?.voteCount ?? 0 },
    { name: "Remaining", value: Math.max(1, (data?.positionCount ?? 4) * 200 - (data?.voteCount ?? 0)) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Welcome back</h1>
        <p className="text-muted-foreground">Here's what's happening with the election right now.</p>
      </div>

      {data?.active && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="overflow-hidden border-0 text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
            <div className="p-8 flex flex-col md:flex-row gap-6 md:items-center justify-between">
              <div>
                <Badge className="bg-gold text-gold-foreground hover:bg-gold">{data.active.status.toUpperCase()}</Badge>
                <h2 className="mt-3 font-display text-3xl">{data.active.title}</h2>
                <p className="mt-2 text-primary-foreground/80 max-w-xl">{data.active.description}</p>
              </div>
              <div className="flex gap-3 text-center">
                {cd && [
                  { v: cd.d, l: "days" },
                  { v: cd.h, l: "hrs" },
                  { v: cd.m, l: "min" },
                  { v: cd.s, l: "sec" },
                ].map((b) => (
                  <div key={b.l} className="bg-white/10 backdrop-blur rounded-lg px-4 py-3 min-w-16">
                    <div className="font-display text-3xl text-gold">{String(b.v).padStart(2, "0")}</div>
                    <div className="text-[10px] uppercase tracking-wider text-primary-foreground/70">{b.l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-8 pb-8">
              {data.voted ? (
                <div className="flex items-center gap-2 text-gold">
                  <CheckCircle2 className="size-5" /> You've already voted. Thank you!
                </div>
              ) : data.isApproved ? (
                <Link to="/student/vote" className="inline-flex items-center gap-2 bg-gold text-gold-foreground px-5 py-2.5 rounded-md font-medium hover:opacity-90">
                  <Vote className="size-4" /> Cast your ballot
                </Link>
              ) : (
                <div className="flex items-center gap-2 text-primary-foreground/70 text-sm">
                  <Clock className="size-4 flex-shrink-0" />
                  <span>Your account is <strong>pending admin approval</strong> before you can vote.</span>
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      )}

      <div className="hidden md:grid md:grid-cols-4 gap-4">
        {[
          { label: "Positions", value: data?.positionCount ?? 0, icon: Calendar, color: "text-primary" },
          { label: "Candidates", value: data?.candidateCount ?? 0, icon: Users, color: "text-gold" },
          { label: "Total votes cast", value: data?.voteCount ?? 0, icon: Vote, color: "text-success" },
          { label: "Status", value: data?.voted ? "Voted ✓" : data?.isApproved ? "Registered" : "Pending", icon: Clock, color: data?.voted ? "text-success" : data?.isApproved ? "text-primary" : "text-warning" },
        ].map((s) => (
          <Card key={s.label} className="p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">{s.label}</div>
              <s.icon className={`size-4 ${s.color}`} />
            </div>
            <div className="mt-2 font-display text-3xl">{s.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-5 md:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Megaphone className="size-4 text-primary" />
            <h3 className="font-display text-lg">Latest announcements</h3>
          </div>
          <div className="space-y-3">
            {data?.announcements.length === 0 && <p className="text-sm text-muted-foreground">No announcements yet.</p>}
            {data?.announcements.map((a) => (
              <div key={a.id} className="border-l-2 border-gold pl-4 py-1">
                <div className="flex items-center gap-2">
                  {a.pinned && <Badge variant="outline" className="text-gold border-gold">Pinned</Badge>}
                  <h4 className="font-medium">{a.title}</h4>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{a.body}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-display text-lg mb-3">Participation</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={participationData} dataKey="value" innerRadius={50} outerRadius={75} startAngle={90} endAngle={-270}>
                <Cell fill="var(--gold)" />
                <Cell fill="var(--muted)" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <p className="text-center text-sm text-muted-foreground">{data?.voteCount ?? 0} total ballots cast</p>
        </Card>
      </div>
    </div>
  );
}