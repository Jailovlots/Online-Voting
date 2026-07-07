import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, XCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  head: () => ({ meta: [{ title: "Voting Status — Admin" }] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  // Fetch elections list to find the active election
  const { data: elections } = useQuery({
    queryKey: ["admin-elections-list"],
    queryFn: async () => (await api.queries.elections() as any[]) ?? [],
  });

  const activeElection = (elections?.find((e: any) => e.status === "active") ?? elections?.[0]) as any;

  // Fetch participation report for the active election
  const { data: participation } = useQuery({
    queryKey: ["participation-report", activeElection?.id],
    queryFn: async () => {
      if (!activeElection?.id) return [];
      return (await api.admin.getVoterReport(activeElection.id)) ?? [];
    },
    enabled: !!activeElection?.id,
    refetchInterval: 10000, // Every 10s — more responsive for live events
  });

  // Fetch live voting standings
  const { data, isLoading } = useQuery({
    queryKey: ["live-voting-status"],
    queryFn: async () => {
      const [positions, candidates, votes] = await Promise.all([
        api.queries.positions(),
        api.queries.candidates(),
        api.queries.votes(),
      ]);
      return { positions: (positions as any) ?? [], candidates: (candidates as any) ?? [], votes: (votes as any) ?? [] };
    },
    refetchInterval: 8000, // Refresh every 8s for responsive live updates
  });

  if (isLoading) return <div className="text-muted-foreground p-8">Loading live voting status...</div>;
  if (!data) return null;

  // Turnout Stats
  const totalRegistered = participation?.length ?? 0;
  const votedCount = participation?.filter((p: any) => p.voted).length ?? 0;
  const notVotedCount = totalRegistered - votedCount;
  const turnoutPercent = totalRegistered > 0 ? (votedCount / totalRegistered) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="font-display text-3xl">Live Voting Status</h1>
            <span className="flex items-center gap-1.5 text-xs font-bold text-success bg-success/10 border border-success/20 rounded-full px-2.5 py-1">
              <span className="size-2 rounded-full bg-success animate-pulse inline-block" />
              LIVE
            </span>
          </div>
          <p className="text-muted-foreground">Real-time election progress and current leaders. Updates every 8 seconds.</p>
        </div>
      </div>

      {/* Turnout Overview Widget */}
      {activeElection && (
        <Card className="p-6 bg-gradient-to-br from-card to-muted/30 border-l-4 border-l-gold relative overflow-hidden">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2 flex-1 w-full">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-gold border-gold/30 bg-gold/5 font-mono">
                  {activeElection.status.toUpperCase()} ELECTION
                </Badge>
                <span className="text-xs text-muted-foreground">Real-time Voter Turnout</span>
              </div>
              <h2 className="font-display text-xl font-bold tracking-tight">{activeElection.title}</h2>
              
              <div className="pt-2">
                <div className="flex justify-between text-sm font-medium mb-1">
                  <span>Voter Turnout Rate</span>
                  <span className="font-mono text-gold font-bold">{turnoutPercent.toFixed(1)}%</span>
                </div>
                <Progress value={turnoutPercent} className="h-2.5 [&>div]:bg-gold" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 w-full md:w-auto md:border-l md:pl-6 border-border">
              <div className="text-center md:text-left">
                <div className="text-xs text-muted-foreground font-medium">Registered</div>
                <div className="text-2xl font-bold font-mono mt-0.5">{totalRegistered}</div>
              </div>
              <div className="text-center md:text-left">
                <div className="text-xs text-success font-medium">Votes Cast</div>
                <div className="text-2xl font-bold font-mono text-success mt-0.5">{votedCount}</div>
              </div>
              <div className="text-center md:text-left">
                <div className="text-xs text-warning font-medium">Pending</div>
                <div className="text-2xl font-bold font-mono text-warning mt-0.5">{notVotedCount}</div>
              </div>
            </div>

            <div className="self-stretch flex items-center justify-end md:border-l md:pl-6 border-border w-full md:w-auto">
              <Link 
                to="/admin/results" 
                className="text-sm font-medium text-gold hover:text-gold/80 flex items-center gap-1.5 group transition-colors"
              >
                Full Turnout Report
                <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* Candidates Standings Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.positions.map((p) => {
          const cands = data.candidates.filter((c) => c.position_id === p.id);
          const maxWinners = p.max_winners ?? 1;

          // Compute votes per candidate for this election specifically
          const candsWithVotes = cands.map((c) => {
            const votes = data.votes.filter((v) => v.candidate_id === c.id && v.election_id === activeElection?.id).length;
            return { ...c, votes };
          });

          // Sort by votes descending
          candsWithVotes.sort((a, b) => b.votes - a.votes);

          const totalVotes = candsWithVotes.reduce((acc, c) => acc + c.votes, 0);

          return (
            <Card key={p.id} className="p-5 flex flex-col h-full">
              <div className="flex items-center justify-between mb-4 pb-2 border-b">
                <div>
                  <h3 className="font-display text-lg">{p.title}</h3>
                  <p className="text-xs text-muted-foreground">{maxWinners} Winner{maxWinners > 1 ? "s" : ""}</p>
                </div>
                <Badge variant="secondary" className="bg-muted">
                  {totalVotes} total votes
                </Badge>
              </div>

              <div className="space-y-4 flex-1">
                {candsWithVotes.map((c, index) => {
                  const isWinning = index < maxWinners && c.votes > 0;
                  const isTiedWithWinner = index >= maxWinners && c.votes === candsWithVotes[maxWinners - 1]?.votes && c.votes > 0;
                  const percent = totalVotes > 0 ? (c.votes / totalVotes) * 100 : 0;

                  return (
                    <div key={c.id} className="relative">
                      <div className="flex justify-between text-sm mb-1">
                        <div className="flex items-start gap-2">
                          {isWinning || isTiedWithWinner ? (
                            <CheckCircle2 className="size-4 text-success mt-0.5" />
                          ) : (
                            <XCircle className="size-4 text-muted-foreground/50 mt-0.5" />
                          )}
                          <div className="flex flex-col">
                            <span className={`font-medium leading-none ${isWinning || isTiedWithWinner ? "text-foreground" : "text-muted-foreground"}`}>
                              {c.full_name}
                            </span>
                            <span className="text-[11px] text-muted-foreground mt-1">
                              {c.party || "Independent"}
                            </span>
                          </div>
                        </div>
                        <span className="font-mono text-xs">{c.votes} votes</span>
                      </div>
                      <Progress 
                        value={percent} 
                        className={`h-2 ${isWinning || isTiedWithWinner ? "[&>div]:bg-success" : "[&>div]:bg-muted-foreground/30"}`}
                      />
                    </div>
                  );
                })}
                {candsWithVotes.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">No candidates</div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}