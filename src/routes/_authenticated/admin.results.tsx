import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Trophy, Printer, Search, Users, CheckCircle2, AlertCircle, Calendar, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { useState, useMemo, useEffect } from "react";
import { format, formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/admin/results")({
  head: () => ({ meta: [{ title: "Reports & Results — Admin" }] }),
  component: FinalResults,
});

function FinalResults() {
  const qc = useQueryClient();
  const [selectedElectionId, setSelectedElectionId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"results" | "participation">("results");
  const [isPrintingWinnersOnly, setIsPrintingWinnersOnly] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Search & Filter States for Participation
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "voted" | "not_voted">("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "student_id" | "course" | "year_level" | "section">("name");

  // Fetch elections list
  const { data: elections, isLoading: isElectionsLoading } = useQuery({
    queryKey: ["admin-elections-list"],
    queryFn: async () => (await api.queries.elections()) ?? [],
  });

  // Automatically select the active or first election
  useEffect(() => {
    if (elections && elections.length > 0 && !selectedElectionId) {
      const active = elections.find((e: any) => e.status === "active");
      setSelectedElectionId(active?.id ?? elections[0].id);
    }
  }, [elections, selectedElectionId]);

  // Fetch positions, candidates, and votes — include selectedElectionId in key so
  // switching elections immediately invalidates the cache and triggers a fresh fetch.
  const { data, isLoading: isDataLoading } = useQuery({
    queryKey: ["final-results", selectedElectionId],
    queryFn: async () => {
      const [positions, candidates, votes] = await Promise.all([
        api.queries.positions(),
        api.queries.candidates(),
        api.queries.votes(),
      ]);
      setLastUpdated(new Date());
      return { positions: (positions as any) ?? [], candidates: (candidates as any) ?? [], votes: (votes as any) ?? [] };
    },
    enabled: !!selectedElectionId,
    refetchInterval: 5000, // Poll every 5s for live results
  });

  // Fetch participation report
  const { data: participation, isLoading: isPartLoading } = useQuery({
    queryKey: ["participation-report", selectedElectionId],
    queryFn: async () => {
      if (!selectedElectionId) return [];
      const result = (await api.admin.getVoterReport(selectedElectionId)) ?? [];
      setLastUpdated(new Date());
      return result as any;
    },
    enabled: !!selectedElectionId,
    refetchInterval: 5000, // Poll every 5s for live participation
  });

  async function handleManualRefresh() {
    setIsRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["final-results", selectedElectionId] });
    await qc.invalidateQueries({ queryKey: ["participation-report", selectedElectionId] });
    setIsRefreshing(false);
    setLastUpdated(new Date());
  }

  const selectedElection = elections?.find((e: any) => e.id === selectedElectionId);

  // Filter votes by the selected election
  const filteredVotes = useMemo(() => {
    if (!data?.votes || !selectedElectionId) return [];
    return data.votes.filter((v: any) => v.election_id === selectedElectionId);
  }, [data?.votes, selectedElectionId]);

  // Dynamic filter lists
  const courses = useMemo(() => {
    if (!participation) return [];
    const set = new Set(participation.map((p: any) => p.course).filter(Boolean));
    return Array.from(set).sort() as string[];
  }, [participation]);

  const yearLevels = useMemo(() => {
    if (!participation) return [];
    const set = new Set(participation.map((p: any) => p.year_level).filter(Boolean));
    return Array.from(set).sort((a: any, b: any) => Number(a) - Number(b)) as number[];
  }, [participation]);

  const sections = useMemo(() => {
    if (!participation) return [];
    const set = new Set(participation.map((p: any) => p.section).filter(Boolean));
    return Array.from(set).sort() as string[];
  }, [participation]);

  // Filtered participation list
  const filteredParticipation = useMemo(() => {
    if (!participation) return [];
    return participation.filter((p: any) => {
      const matchesSearch = 
        p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.student_id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = 
        statusFilter === "all" ||
        (statusFilter === "voted" && p.voted) ||
        (statusFilter === "not_voted" && !p.voted);
      const matchesCourse = courseFilter === "all" || p.course === courseFilter;
      const matchesYear = yearFilter === "all" || String(p.year_level) === yearFilter;
      const matchesSection = sectionFilter === "all" || p.section === sectionFilter;
      return matchesSearch && matchesStatus && matchesCourse && matchesYear && matchesSection;
    });
  }, [participation, searchTerm, statusFilter, courseFilter, yearFilter, sectionFilter]);

  // Sorted participation list
  const sortedParticipation = useMemo(() => {
    const list = [...filteredParticipation];
    return list.sort((a, b) => {
      if (sortBy === "name") {
        return a.full_name.localeCompare(b.full_name);
      }
      if (sortBy === "student_id") {
        return a.student_id.localeCompare(b.student_id);
      }
      if (sortBy === "course") {
        return (a.course || "").localeCompare(b.course || "");
      }
      if (sortBy === "year_level") {
        return (a.year_level || 0) - (b.year_level || 0);
      }
      if (sortBy === "section") {
        return (a.section || "").localeCompare(b.section || "");
      }
      return 0;
    });
  }, [filteredParticipation, sortBy]);

  // Stats calculations
  const totalRegistered = participation?.length ?? 0;
  const votedCount = participation?.filter((p: any) => p.voted).length ?? 0;
  const notVotedCount = totalRegistered - votedCount;
  const turnoutPercent = totalRegistered > 0 ? ((votedCount / totalRegistered) * 100).toFixed(1) : "0.0";

  function exportResultsCsv() {
    if (!data || !selectedElection) return;
    const rows = [["Position", "Candidate", "Party", "Votes", "Status"]];
    data.positions.forEach((p) => {
      const cands = data.candidates.filter((c) => c.position_id === p.id);
      const candsWithVotes = cands.map(c => ({
        ...c,
        votes: filteredVotes.filter((v: any) => v.candidate_id === c.id).length
      })).sort((a, b) => b.votes - a.votes);

      const maxWinners = p.max_winners ?? 1;

      candsWithVotes.forEach((c, index) => {
        const isWinner = index < maxWinners && c.votes > 0;
        const isTied = index >= maxWinners && c.votes === candsWithVotes[maxWinners - 1]?.votes && c.votes > 0;
        const status = isWinner || isTied ? "WINNER" : "LOSER";
        rows.push([p.title, c.full_name, c.party ?? "", String(c.votes), status]);
      });
    });
    const csv = rows.map((r) => r.map((x) => `"${x.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `results_${selectedElection.title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportParticipationCsv() {
    if (!participation || !selectedElection) return;
    const rows = [["Student ID", "Name", "Email", "Course", "Year Level", "Section", "Status", "Voted At"]];
    sortedParticipation.forEach((p: any) => {
      rows.push([
        p.student_id,
        p.full_name,
        p.email,
        p.course ?? "",
        p.year_level ? `Year ${p.year_level}` : "",
        p.section ?? "",
        p.voted ? "VOTED" : "DID NOT VOTE",
        p.voted_at ? format(new Date(p.voted_at), "yyyy-MM-dd HH:mm:ss") : ""
      ]);
    });
    const csv = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `participation_${selectedElection.title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    window.print();
  }

  function printWinnersSheet() {
    setIsPrintingWinnersOnly(true);
    setTimeout(() => {
      window.print();
      setIsPrintingWinnersOnly(false);
    }, 150);
  }

  const isLoading = isElectionsLoading || (isDataLoading && !data) || (isPartLoading && !participation);

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading reports...</div>;
  if (!elections || elections.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Calendar className="size-12 text-muted-foreground mx-auto" />
        <h2 className="font-display text-2xl mt-4">No elections available</h2>
        <p className="text-muted-foreground mt-2">Create an election to view results and turnout reports.</p>
      </Card>
    );
  }

  // printable winners proclamation view
  if (isPrintingWinnersOnly && data) {
    return (
      <div className="w-full max-w-4xl mx-auto p-12 bg-white text-black min-h-[11in] flex flex-col justify-between border-8 border-double border-black/20 font-serif">
        <div className="text-center space-y-4">
          <div className="text-sm font-semibold tracking-widest uppercase text-black/60">Commission on Elections</div>
          <h1 className="text-3xl font-bold tracking-tight uppercase">Official Proclamation of Winners</h1>
          <div className="text-lg font-medium italic border-b pb-4 border-black/30">{selectedElection?.title}</div>
          <p className="text-sm leading-relaxed max-w-2xl mx-auto pt-2">
            We, the Commission on Elections, hereby certify and proclaim that the following candidates have received the highest number of votes in their respective positions and are hereby declared the official winners.
          </p>
        </div>

        <div className="my-10 flex-1">
          <table className="w-full border-collapse border border-black/30 text-sm">
            <thead>
              <tr className="bg-black/5 text-left">
                <th className="border border-black/30 px-4 py-3 font-semibold w-1/3">Position</th>
                <th className="border border-black/30 px-4 py-3 font-semibold w-1/3">Winner(s)</th>
                <th className="border border-black/30 px-4 py-3 font-semibold">Party</th>
                <th className="border border-black/30 px-4 py-3 font-semibold text-right w-24">Votes</th>
              </tr>
            </thead>
            <tbody>
              {data.positions.map((p) => {
                const cands = data.candidates.filter((c) => c.position_id === p.id);
                const maxWinners = p.max_winners ?? 1;
                const candsWithVotes = cands.map((c) => {
                  const votes = filteredVotes.filter((v: any) => v.candidate_id === c.id).length;
                  return { ...c, votes };
                }).sort((a, b) => b.votes - a.votes);

                const winners = candsWithVotes.filter((c, index) => {
                  const isWinner = index < maxWinners && c.votes > 0;
                  const isTied = index >= maxWinners && c.votes === candsWithVotes[maxWinners - 1]?.votes && c.votes > 0;
                  return isWinner || isTied;
                });

                if (winners.length === 0) return null;

                return (
                  <tr key={p.id} className="align-top">
                    <td className="border border-black/30 px-4 py-3 font-bold">{p.title}</td>
                    <td className="border border-black/30 px-4 py-3">
                      <div className="space-y-1">
                        {winners.map(w => (
                          <div key={w.id} className="font-medium">{w.full_name}</div>
                        ))}
                      </div>
                    </td>
                    <td className="border border-black/30 px-4 py-3">
                      <div className="space-y-1">
                        {winners.map(w => (
                          <div key={w.id} className="text-black/80">{w.party || "Independent"}</div>
                        ))}
                      </div>
                    </td>
                    <td className="border border-black/30 px-4 py-3 text-right font-mono font-bold">
                      <div className="space-y-1">
                        {winners.map(w => (
                          <div key={w.id}>{w.votes}</div>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-12">
          <div className="text-right text-xs italic text-black/60">
            Proclaimed this {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} at {new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}.
          </div>
          
          <div className="flex justify-between text-center pt-8 border-t border-black/20 text-sm">
            <div className="w-64 space-y-1">
              <div className="font-bold border-b border-black pb-1">COMEL Electoral Board Chair</div>
              <div className="text-xs text-black/60">Commission on Elections</div>
            </div>
            <div className="w-64 space-y-1">
              <div className="font-bold border-b border-black pb-1">Student Affairs Director</div>
              <div className="text-xs text-black/60">University Administration</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 print:space-y-4 print:bg-white print:text-black">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6 print:border-black print:pb-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="font-display text-4xl print:text-3xl">
              {activeTab === "results" ? "Election Results" : "Voter Turnout & Participation"}
            </h1>
            {/* LIVE indicator */}
            <span className="print:hidden flex items-center gap-1.5 text-xs font-bold text-success bg-success/10 border border-success/20 rounded-full px-2.5 py-1">
              <span className="size-2 rounded-full bg-success animate-pulse inline-block" />
              LIVE
            </span>
          </div>
          <p className="text-muted-foreground print:text-sm">
            {selectedElection?.title} — {selectedElection?.status.toUpperCase()}
          </p>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground/60 mt-0.5 print:hidden">
              Last updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
            </p>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Election:</span>
            <Select value={selectedElectionId} onValueChange={setSelectedElectionId}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Select election" />
              </SelectTrigger>
              <SelectContent>
                {elections.map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.title} {e.status === "active" ? "(Active)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Manual refresh button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          {activeTab === "results" ? (
            <>
              <Button variant="outline" onClick={exportResultsCsv}>
                <Download className="size-4 mr-2" /> Export CSV
              </Button>
              <Button variant="outline" onClick={printWinnersSheet} className="border-gold/30 hover:bg-gold/5 text-gold">
                <Trophy className="size-4 mr-2" /> Print Winners Sheet
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={exportParticipationCsv}>
              <Download className="size-4 mr-2" /> Export CSV
            </Button>
          )}

          <Button onClick={printReport} className="bg-primary">
            <Printer className="size-4 mr-2" /> Print Report
          </Button>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-border print:hidden">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "results"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("results")}
        >
          Election Results
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "participation"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("participation")}
        >
          Voter Turnout & Participation
        </button>
      </div>

      {/* TAB CONTENT: RESULTS */}
      {activeTab === "results" && (
        <div className="space-y-8 print:space-y-6">
          {data?.positions.map((p) => {
            const cands = data.candidates.filter((c) => c.position_id === p.id);
            const maxWinners = p.max_winners ?? 1;

            const candsWithVotes = cands.map((c) => {
              const votes = filteredVotes.filter((v: any) => v.candidate_id === c.id).length;
              return { ...c, votes };
            });

            candsWithVotes.sort((a, b) => b.votes - a.votes);
            const totalVotes = candsWithVotes.reduce((acc, c) => acc + c.votes, 0);

            return (
              <Card key={p.id} className="overflow-hidden print:shadow-none print:border-none print:bg-transparent">
                <div className="bg-muted/50 p-4 border-b flex justify-between items-center print:bg-transparent print:border-b-2 print:border-black print:px-0">
                  <div>
                    <h3 className="font-display text-xl font-bold">{p.title}</h3>
                    <p className="text-sm text-muted-foreground print:text-black/70">
                      {maxWinners} Winner{maxWinners > 1 ? "s" : ""} • {totalVotes} Total Votes
                    </p>
                  </div>
                </div>
                <div className="p-0">
                  <table className="w-full text-left text-sm print:text-base">
                    <thead className="bg-muted/30 text-muted-foreground print:hidden">
                      <tr>
                        <th className="px-6 py-3 font-medium w-16 text-center">Rank</th>
                        <th className="px-6 py-3 font-medium">Candidate</th>
                        <th className="px-6 py-3 font-medium">Party</th>
                        <th className="px-6 py-3 font-medium text-right w-32">Votes</th>
                        <th className="px-6 py-3 font-medium text-right w-32">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border print:divide-black/20">
                      {candsWithVotes.map((c, index) => {
                        const isWinner = index < maxWinners && c.votes > 0;
                        const isTied = index >= maxWinners && c.votes === candsWithVotes[maxWinners - 1]?.votes && c.votes > 0;
                        const won = isWinner || isTied;

                        return (
                          <tr key={c.id} className={`${won ? "bg-success/5 print:bg-transparent print:font-bold" : ""}`}>
                            <td className="px-6 py-4 text-center font-mono text-muted-foreground print:text-black">
                              {index + 1}
                            </td>
                            <td className="px-6 py-4 font-medium">
                              <div className="flex items-center gap-2">
                                {won && <Trophy className="size-4 text-success print:text-black" />}
                                {c.full_name}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-muted-foreground print:text-black">{c.party || "Independent"}</td>
                            <td className="px-6 py-4 text-right font-mono font-bold">{c.votes}</td>
                            <td className="px-6 py-4 text-right">
                              {won ? (
                                <Badge className="bg-success text-success-foreground print:border print:border-black print:text-black print:bg-transparent">
                                  WINNER
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="print:border print:border-gray-400 print:text-gray-600 print:bg-transparent">
                                  LOSER
                                </Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {candsWithVotes.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No candidates for this position.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* TAB CONTENT: PARTICIPATION */}
      {activeTab === "participation" && (
        <div className="space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
            <Card className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Users className="size-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-medium">Registered Voters</div>
                <div className="text-xl font-bold font-mono">{totalRegistered}</div>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-full bg-success/10 flex items-center justify-center text-success">
                <CheckCircle2 className="size-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-medium">Votes Casted</div>
                <div className="text-xl font-bold font-mono">{votedCount}</div>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-full bg-gold/10 flex items-center justify-center text-gold">
                <Trophy className="size-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-medium">Voter Turnout</div>
                <div className="text-xl font-bold font-mono">{turnoutPercent}%</div>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-full bg-warning/10 flex items-center justify-center text-warning">
                <AlertCircle className="size-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-medium">Pending Ballots</div>
                <div className="text-xl font-bold font-mono">{notVotedCount}</div>
              </div>
            </Card>
          </div>

          {/* Search & filters controls */}
          <Card className="p-4 flex flex-wrap gap-4 items-center justify-between print:hidden">
            <div className="flex-1 min-w-[240px] relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search student name or ID..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">Status:</span>
                <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
                  <SelectTrigger className="w-[130px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Students</SelectItem>
                    <SelectItem value="voted">Voted Only</SelectItem>
                    <SelectItem value="not_voted">Not Voted Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">Course:</span>
                <Select value={courseFilter} onValueChange={setCourseFilter}>
                  <SelectTrigger className="w-[130px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Courses</SelectItem>
                    {courses.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">Year:</span>
                <Select value={yearFilter} onValueChange={setYearFilter}>
                  <SelectTrigger className="w-[110px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {yearLevels.map((y) => <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">Section:</span>
                <Select value={sectionFilter} onValueChange={setSectionFilter}>
                  <SelectTrigger className="w-[110px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sections</SelectItem>
                    {sections.map((s) => <SelectItem key={s} value={s}>Section {s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">Sort by:</span>
                <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
                  <SelectTrigger className="w-[120px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="student_id">Student ID</SelectItem>
                    <SelectItem value="course">Course</SelectItem>
                    <SelectItem value="year_level">Year Level</SelectItem>
                    <SelectItem value="section">Section</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* Student participation table */}
          <Card className="overflow-hidden print:shadow-none print:border-none print:bg-transparent">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm print:text-base">
                <thead className="bg-muted text-muted-foreground print:bg-transparent print:border-b-2 print:border-black print:text-black">
                  <tr>
                    <th className="px-6 py-3 font-medium">Student ID</th>
                    <th className="px-6 py-3 font-medium">Name</th>
                    <th className="px-6 py-3 font-medium">Course, Year & Section</th>
                    <th className="px-6 py-3 font-medium">Voting Status</th>
                    <th className="px-6 py-3 font-medium">Voted Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border print:divide-black/20">
                  {sortedParticipation.map((student: any) => (
                    <tr key={student.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-medium">{student.student_id}</td>
                      <td className="px-6 py-4 font-medium">{student.full_name}</td>
                      <td className="px-6 py-4 text-muted-foreground print:text-black">
                        {student.course} {student.year_level ? `- Year ${student.year_level}` : ""} {student.section ? `- Sec ${student.section}` : ""}
                      </td>
                      <td className="px-6 py-4">
                        {student.voted ? (
                          <Badge className="bg-success text-success-foreground hover:bg-success/90 print:border print:border-black print:text-black print:bg-transparent">
                            Voted
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-muted-foreground print:border print:border-gray-400 print:text-gray-600 print:bg-transparent">
                            Not Voted
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-muted-foreground print:text-black">
                        {student.voted_at ? format(new Date(student.voted_at), "PPP p") : "—"}
                      </td>
                    </tr>
                  ))}
                  {sortedParticipation.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                        No voter records match the filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Print footer */}
      <div className="hidden print:block mt-16 pt-8 border-t-2 border-black text-center text-sm">
        <p>Certified Official {activeTab === "results" ? "Election Results" : "Voter Turnout & Participation Report"}</p>
        <p>Generated by StudentGov on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
        <div className="mt-16 flex justify-around">
          <div className="w-48 border-t border-black pt-2">Electoral Board Chair</div>
          <div className="w-48 border-t border-black pt-2">Student Affairs Director</div>
        </div>
      </div>
    </div>
  );
}