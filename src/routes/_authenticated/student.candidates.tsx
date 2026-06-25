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
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <Badge variant="outline" className="w-fit">{selected.position?.title}</Badge>
                <DialogTitle className="font-display text-2xl">{selected.full_name}</DialogTitle>
                <DialogDescription>{selected.party}</DialogDescription>
              </DialogHeader>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                  {selected.photo_url && <img src={selected.photo_url} alt={selected.full_name} className="w-full h-full object-cover" />}
                </div>
                <div className="md:col-span-2 space-y-3 text-sm">
                  <div><div className="font-medium mb-1">Biography</div><p className="text-muted-foreground">{selected.bio}</p></div>
                  <div><div className="font-medium mb-1">Platform & advocacy</div><p className="text-muted-foreground">{selected.platform}</p></div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}