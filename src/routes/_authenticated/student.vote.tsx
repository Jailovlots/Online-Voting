import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useState } from "react";
import { Check, Vote, ShieldCheck, ShieldX, Clock, Lock } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/student/vote")({
  head: () => ({ meta: [{ title: "Cast Ballot — StudentGov" }] }),
  component: VotePage,
});

function VotePage() {
  const navigate = useNavigate();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["ballot"],
    queryFn: async () => {
      const [positions, candidates, election, registration, profile] = await Promise.all([
        api.queries.positions(),
        api.queries.candidatesApproved(),
        api.queries.activeElection(),
        api.queries.registrationStatus(),
        api.queries.profile(),
      ]);
      let voted = false;
      if (election) {
        const r = await api.voting.hasVoted(election.id);
        voted = r.voted;
      }
      return {
        positions: (positions as any) ?? [],
        candidates: (candidates as any) ?? [],
        election: election as any,
        voted,
        isApproved: registration?.isApproved ?? false,
        yearLevel: profile?.year_level ?? null,
        course: (String(profile?.course ?? "")).trim().toUpperCase(),
      };
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });


  const [selections, setSelections] = useState<Record<string, string | string[]>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isLoading) return <div className="text-muted-foreground">Loading ballot…</div>;

  // ── Guard: account not approved ─────────────────────────────────────────────
  if (data && !data.isApproved) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <Card className="p-10 text-center max-w-lg mx-auto border-warning/30 bg-warning/5">
          <div className="size-20 rounded-full bg-warning/20 grid place-items-center mx-auto">
            <ShieldX className="size-10 text-warning" />
          </div>
          <h2 className="mt-6 font-display text-2xl">Account Not Approved</h2>
          <p className="text-muted-foreground mt-3 leading-relaxed">
            Your student account is <strong>pending admin approval</strong>. You will be able to vote once an administrator approves your registration.
          </p>
          <div className="mt-6 p-4 bg-muted rounded-lg flex items-center gap-3 text-sm text-left">
            <Clock className="size-5 text-warning flex-shrink-0" />
            <span>Contact your school administrator or check back later after your account has been reviewed.</span>
          </div>
          <Button variant="outline" className="mt-6" onClick={() => navigate({ to: "/student/dashboard" })}>
            Back to Dashboard
          </Button>
        </Card>
      </motion.div>
    );
  }

  if (!data?.election) {
    return (
      <Card className="p-8 text-center">
        <h2 className="font-display text-2xl">No active election</h2>
        <p className="text-muted-foreground mt-2">Check back later.</p>
      </Card>
    );
  }

  // ── Vote receipt (success screen) ───────────────────────────────────────────
  if (receipt) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <Card className="p-10 text-center max-w-lg mx-auto">
          <div className="size-20 rounded-full bg-success/20 grid place-items-center mx-auto">
            <Check className="size-10 text-success" />
          </div>
          <h2 className="mt-6 font-display text-3xl">Vote recorded</h2>
          <p className="text-muted-foreground mt-2">Thank you for participating in the democratic process.</p>
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Your receipt</div>
            <div className="font-mono text-xl mt-1">{receipt}</div>
            <div className="text-xs text-muted-foreground mt-2">Keep this code as anonymous proof of your participation.</div>
          </div>
          <Button className="mt-6" onClick={() => navigate({ to: "/student/dashboard" })}>Back to dashboard</Button>
        </Card>
      </motion.div>
    );
  }

  // ── Guard: already voted ─────────────────────────────────────────────────────
  if (data.voted) {
    return (
      <Card className="p-10 text-center max-w-lg mx-auto border-gold/30 bg-gold/5">
        <ShieldCheck className="size-12 text-gold mx-auto" />
        <h2 className="mt-4 font-display text-2xl">You've already voted</h2>
        <p className="text-muted-foreground mt-2">
          Each student can vote <strong>only once</strong> per election. Your ballot has been securely recorded.
        </p>
        <Button variant="outline" className="mt-6" onClick={() => navigate({ to: "/student/dashboard" })}>
          Back to Dashboard
        </Button>
      </Card>
    );
  }

  const hasAtLeastOneSelection = Object.values(selections).some((sel) => {
    return sel && (Array.isArray(sel) ? sel.length > 0 : true);
  });

  const election = data.election;

  async function submit() {
    setSubmitting(true);
    try {
      const r = await api.voting.cast(election.id, selections);
      setReceipt(r.receipt);
      setConfirmOpen(false);
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to submit ballot");
      // If the server says already voted (race condition), refresh to show the correct blocked screen
      if (e.message?.toLowerCase().includes("already")) {
        refetch();
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleSelect(posId: string, candId: string, maxWinners: number) {
    setSelections((prev) => {
      const current = prev[posId];
      if (maxWinners === 1) {
        return { ...prev, [posId]: candId };
      }

      const arr = Array.isArray(current) ? current : (current ? [current] : []);

      if (arr.includes(candId)) {
        const next = arr.filter((id) => id !== candId);
        if (next.length === 0) {
          const newSel = { ...prev };
          delete newSel[posId];
          return newSel;
        }
        return { ...prev, [posId]: next };
      } else {
        if (arr.length >= maxWinners) {
          toast.error(`You can only select up to ${maxWinners} candidates for this position.`);
          return prev;
        }
        return { ...prev, [posId]: [...arr, candId] };
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Official ballot</h1>
        <p className="text-muted-foreground">{election.title} — review and select candidates carefully.</p>
      </div>

      {data.positions.map((pos) => {
        const cands = data.candidates.filter((c) => c.position_id === pos.id);
        const maxWinners = pos.max_winners ?? 1;

        // ── Eligibility check ──────────────────────────────────────────────────
        const allowedYears: number[] | null = pos.allowed_year_levels ?? null;
        const allowedCourses: string[] | null = pos.allowed_courses ?? null;

        let isEligible = true;
        let lockReason = "";

        if (allowedYears && allowedYears.length > 0) {
          if (data.yearLevel === null || !allowedYears.includes(data.yearLevel)) {
            isEligible = false;
            lockReason = `Year ${allowedYears.join(" or ")} students only`;
          }
        }
        if (isEligible && allowedCourses && allowedCourses.length > 0) {
          const normalizedVoter = (data.course ?? "").trim().toUpperCase();
          const normalizedAllowed = allowedCourses.map((c: string) => c.trim().toUpperCase());
          if (!normalizedAllowed.includes(normalizedVoter)) {
            isEligible = false;
            lockReason = lockReason
              ? `${lockReason} · ${allowedCourses.join(" or ")} course`
              : `${allowedCourses.join(" or ")} course students only`;
          }
        }

        // ── Locked position card ───────────────────────────────────────────────
        if (!isEligible) {
          return (
            <Card key={pos.id} className="p-6 opacity-50 select-none border-dashed">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <Badge variant="outline">{pos.title}</Badge>
                  <p className="text-sm text-muted-foreground mt-1">{pos.description || pos.title}</p>
                </div>
                <div className="flex-shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground bg-muted rounded-full px-3 py-1.5">
                  <Lock className="size-3" />
                  Not eligible
                </div>
              </div>
              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Lock className="size-4" />
                <span>Restricted to <strong>{lockReason}</strong>. You cannot vote for this position.</span>
              </div>
            </Card>
          );
        }

        // ── Normal votable card ────────────────────────────────────────────────
        return (
          <Card key={pos.id} className="p-6">
            <div className="mb-4">
              <Badge>{pos.title}</Badge>
              <p className="text-sm text-muted-foreground mt-1">
                {pos.description || `Select up to ${maxWinners} candidate${maxWinners > 1 ? "s" : ""}`}
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              {cands.map((c) => {
                const currentSel = selections[pos.id];
                const sel = Array.isArray(currentSel) ? currentSel.includes(c.id) : currentSel === c.id;

                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelect(pos.id, c.id, maxWinners)}
                    className={`text-left rounded-lg border-2 p-4 transition-all ${
                      sel ? "border-gold bg-accent shadow-[var(--shadow-elegant)]" : "border-border hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-12 rounded-full bg-muted overflow-hidden flex-shrink-0">
                        {c.photo_url && <img src={c.photo_url} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{c.full_name}</div>
                        <div className="text-xs text-muted-foreground truncate">{c.party || "Independent"}</div>
                      </div>
                      {sel && <Check className="size-5 text-gold flex-shrink-0" />}
                    </div>
                  </button>
                );
              })}
              {cands.length === 0 && (
                <div className="col-span-full text-muted-foreground py-4 text-center text-sm border-2 border-dashed rounded-lg">
                  No candidates available for this position.
                </div>
              )}
            </div>
          </Card>
        );
      })}

      <div className="sticky bottom-4 z-10">
        <Card className="p-4 flex flex-wrap items-center justify-between gap-4 shadow-[var(--shadow-elegant)]">
          <div className="text-sm">
            <span className="font-medium">{Object.keys(selections).length}</span> of {data.positions.filter((pos: any) => {
              const allowedYears: number[] | null = pos.allowed_year_levels ?? null;
              const allowedCourses: string[] | null = pos.allowed_courses ?? null;
              if (allowedYears && allowedYears.length > 0 && (data.yearLevel === null || !allowedYears.includes(data.yearLevel))) return false;
              if (allowedCourses && allowedCourses.length > 0 && !allowedCourses.map((c: string) => c.toUpperCase()).includes(data.course)) return false;
              return true;
            }).length} eligible positions selected
          </div>
          <Button disabled={!hasAtLeastOneSelection} onClick={() => setConfirmOpen(true)} className="bg-gold text-gold-foreground hover:bg-gold/90">
            <Vote className="size-4 mr-2" /> Review &amp; submit
          </Button>
        </Card>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Confirm your ballot</DialogTitle>
            <DialogDescription>Once submitted, your vote cannot be changed. Your identity is never linked to your choices.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
            {data.positions.map((p) => {
              const currentSel = selections[p.id];
              const selIds = Array.isArray(currentSel) ? currentSel : (currentSel ? [currentSel] : []);
              const selectedCands = selIds.map((id) => data.candidates.find((c) => c.id === id)).filter(Boolean);

              return (
                <div key={p.id} className="text-sm p-4 bg-muted/50 rounded-lg border">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{p.title}</div>
                  {selectedCands.length > 0 ? (
                    <ul className="space-y-1">
                      {selectedCands.map((c) => (
                        <li key={c?.id} className="font-medium flex items-center gap-2">
                          <Check className="size-3 text-gold" /> {c?.full_name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground italic">No selection</span>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter className="mt-4 pt-4 border-t">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={submitting} className="bg-primary hover:bg-primary/90">
              {submitting ? "Submitting…" : "Submit ballot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}