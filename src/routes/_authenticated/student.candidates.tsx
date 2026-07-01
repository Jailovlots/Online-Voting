import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getPositions, getApprovedCandidates } from "@/lib/queries.server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { motion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/student/candidates")({
  head: () => ({ meta: [{ title: "Candidates — StudentGov" }] }),
  component: Candidates,
});

function Candidates() {
  const getPositionsFn = useServerFn(getPositions);
  const getApprovedCandidatesFn = useServerFn(getApprovedCandidates);

  const { data } = useQuery({
    queryKey: ["candidates-with-positions"],
    queryFn: async () => {
      const [positions, candidates] = await Promise.all([
        getPositionsFn(),
        getApprovedCandidatesFn(),
      ]);
      return { positions: positions ?? [], candidates: candidates ?? [] };
    },
  });

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<any>(null);

  const filtered = useMemo(() => {
    return (data?.candidates ?? []).filter((c) => {
      if (filter !== "all" && c.position_id !== filter) return false;
      if (q && !`${c.full_name} ${c.party ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [data, q, filter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Meet the candidates</h1>
        <p className="text-muted-foreground">Browse platforms before you cast your vote.</p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-64">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search candidates or parties…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilter("all")} className={`px-3 py-1.5 rounded-md text-sm ${filter === "all" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>All</button>
          {data?.positions.map((p) => (
            <button key={p.id} onClick={() => setFilter(p.id)} className={`px-3 py-1.5 rounded-md text-sm ${filter === p.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{p.title}</button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((c, i) => {
          const pos = data?.positions.find((p) => p.id === c.position_id);
          return (
            <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Card className="overflow-hidden hover:shadow-[var(--shadow-elegant)] transition-shadow cursor-pointer" onClick={() => setSelected({ ...c, position: pos })}>
                <div className="aspect-[4/3] bg-muted overflow-hidden">
                  {c.photo_url ? <img src={c.photo_url} alt={c.full_name} className="w-full h-full object-cover" /> : null}
                </div>
                <div className="p-4">
                  <Badge variant="outline" className="text-xs">{pos?.title}</Badge>
                  <h3 className="font-display text-lg mt-2">{c.full_name}</h3>
                  <p className="text-sm text-muted-foreground">{c.party}</p>
                  <p className="mt-2 text-sm line-clamp-2">{c.platform}</p>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto pr-2">
          {selected && (() => {
            const parsedBio = (() => {
              let initialBio = {
                age: "",
                address: "",
                municipality: "",
                province: "",
                sex: "",
                dateOfBirth: "",
                birthPlace: "",
                religion: "",
                nationality: "",
                courseYear: "",
                reasonForRunning: ""
              };
              if (selected.bio) {
                try {
                  const parsed = JSON.parse(selected.bio);
                  if (parsed && typeof parsed === 'object') {
                    initialBio = { ...initialBio, ...parsed };
                  }
                } catch (e) {
                  initialBio.reasonForRunning = selected.bio;
                }
              }
              return initialBio;
            })();

            return (
              <>
                <DialogHeader className="border-b pb-4 mb-4">
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <div className="size-16 sm:size-20 rounded-full overflow-hidden bg-muted flex-shrink-0 border border-border">
                      {selected.photo_url ? (
                        <img src={selected.photo_url} alt={selected.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground font-bold text-xl uppercase">
                          {selected.full_name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap gap-2 items-center">
                        <DialogTitle className="font-display text-2xl font-bold">{selected.full_name}</DialogTitle>
                        <Badge variant="outline">{selected.position?.title}</Badge>
                      </div>
                      <DialogDescription className="text-base text-muted-foreground">
                        {selected.party || "Independent Candidate"}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="grid md:grid-cols-2 gap-6 text-sm">
                  {/* Biography & Personal Information Column */}
                  <div className="space-y-5">
                    <div>
                      <h4 className="font-display text-lg font-bold text-foreground mb-3">Biography</h4>
                      
                      <div className="space-y-4">
                        <h5 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Personal Information</h5>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 border rounded-xl p-4 bg-muted/20">
                          <div className="space-y-0.5">
                            <span className="text-xs text-muted-foreground block font-medium">Full Name</span>
                            <span className="font-semibold text-foreground">{selected.full_name || "—"}</span>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-xs text-muted-foreground block font-medium">Age</span>
                            <span className="font-semibold text-foreground">{parsedBio.age || "—"}</span>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-xs text-muted-foreground block font-medium">Sex</span>
                            <span className="font-semibold text-foreground">{parsedBio.sex || "—"}</span>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-xs text-muted-foreground block font-medium">Date of Birth</span>
                            <span className="font-semibold text-foreground">{parsedBio.dateOfBirth || "—"}</span>
                          </div>
                          <div className="space-y-0.5 col-span-2">
                            <span className="text-xs text-muted-foreground block font-medium">Course/Year</span>
                            <span className="font-semibold text-foreground">{parsedBio.courseYear || "—"}</span>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-xs text-muted-foreground block font-medium">Religion</span>
                            <span className="font-semibold text-foreground">{parsedBio.religion || "—"}</span>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-xs text-muted-foreground block font-medium">Nationality</span>
                            <span className="font-semibold text-foreground">{parsedBio.nationality || "—"}</span>
                          </div>
                          <div className="space-y-0.5 col-span-2">
                            <span className="text-xs text-muted-foreground block font-medium">Birth Place</span>
                            <span className="font-semibold text-foreground">{parsedBio.birthPlace || "—"}</span>
                          </div>
                          <div className="space-y-0.5 col-span-2">
                            <span className="text-xs text-muted-foreground block font-medium">Address</span>
                            <span className="font-semibold text-foreground">{parsedBio.address || "—"}</span>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-xs text-muted-foreground block font-medium">Municipality</span>
                            <span className="font-semibold text-foreground">{parsedBio.municipality || "—"}</span>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-xs text-muted-foreground block font-medium">Province</span>
                            <span className="font-semibold text-foreground">{parsedBio.province || "—"}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h5 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Reason for Running</h5>
                      <p className="text-sm text-foreground bg-accent/20 p-4 rounded-xl border leading-relaxed">
                        {parsedBio.reasonForRunning || "No reason provided."}
                      </p>
                    </div>
                  </div>

                  {/* Platform & Advocacy Column */}
                  <div className="space-y-3">
                    <h4 className="font-display text-lg font-bold text-foreground mb-3">Platform & Advocacy</h4>
                    <div className="bg-primary/5 border border-primary/10 rounded-xl p-5 min-h-[250px]">
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {selected.platform || "No platform details provided."}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}