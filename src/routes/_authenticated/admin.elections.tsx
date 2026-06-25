import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getElections } from "@/lib/queries.server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { setElectionStatus } from "@/lib/admin.functions";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/admin/elections")({
  head: () => ({ meta: [{ title: "Elections — Admin" }] }),
  component: ElectionsAdmin,
});

function ElectionsAdmin() {
  const qc = useQueryClient();
  const fn = useServerFn(setElectionStatus);
  const getElectionsFn = useServerFn(getElections);
  const { data } = useQuery({
    queryKey: ["elections"],
    queryFn: async () => (await getElectionsFn()) ?? [],
  });


  const mut = useMutation({
    mutationFn: (v: { id: string; status: "active" | "closed" | "upcoming" }) => fn({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["elections"] }); toast.success("Election updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Elections</h1>
      <div className="space-y-3">
        {data?.map((e) => (
          <Card key={e.id} className="p-5 flex flex-col md:flex-row md:items-center gap-4 justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-xl">{e.title}</h3>
                <Badge className={e.status === "active" ? "bg-success" : e.status === "upcoming" ? "bg-warning" : "bg-muted text-foreground"}>
                  {e.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{e.description}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {format(new Date(e.starts_at), "PPP")} → {format(new Date(e.ends_at), "PPP")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={mut.isPending || e.status === "upcoming"} onClick={() => mut.mutate({ id: e.id, status: "upcoming" })}>Mark upcoming</Button>
              <Button size="sm" disabled={mut.isPending || e.status === "active"} onClick={() => mut.mutate({ id: e.id, status: "active" })} className="bg-success">Open polls</Button>
              <Button size="sm" variant="destructive" disabled={mut.isPending || e.status === "closed"} onClick={() => mut.mutate({ id: e.id, status: "closed" })}>Close polls</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}