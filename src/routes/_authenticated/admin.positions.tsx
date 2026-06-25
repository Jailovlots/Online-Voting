import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPositions } from "@/lib/queries.server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useServerFn } from "@tanstack/react-start";
import { upsertPosition, deletePosition } from "@/lib/admin.functions";
import { Plus, Pencil, Trash2, Award } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/positions")({
  head: () => ({ meta: [{ title: "Positions — Admin" }] }),
  component: Positions,
});

function Positions() {
  const qc = useQueryClient();
  const getPositionsFn = useServerFn(getPositions);
  const upsertFn = useServerFn(upsertPosition);
  const deleteFn = useServerFn(deletePosition);

  const { data } = useQuery({
    queryKey: ["positions"],
    queryFn: async () => (await getPositionsFn()) ?? [],
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const upsert = useMutation({
    mutationFn: upsertFn,
    onSuccess: () => {
      toast.success("Position saved successfully");
      qc.invalidateQueries({ queryKey: ["positions"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message || "Failed to save position"),
  });

  const del = useMutation({
    mutationFn: deleteFn,
    onSuccess: () => {
      toast.success("Position deleted successfully");
      qc.invalidateQueries({ queryKey: ["positions"] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete position"),
  });

  function openNew() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(p: any) {
    setEditing(p);
    setOpen(true);
  }

  function handleDelete(id: string, title: string) {
    if (confirm(`Are you sure you want to delete "${title}"? This will also delete all candidates and votes associated with this position.`)) {
      del.mutate({ data: { id } });
    }
  }

  // Calculate default order index for a new position
  const nextOrderIndex = data && data.length > 0 
    ? Math.max(...data.map((p: any) => p.order_index)) + 1 
    : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Positions</h1>
          <p className="text-muted-foreground">Add new positions, edit winner limits, or remove positions.</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="size-4 mr-1" /> New position
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {data?.map((p) => (
          <Card key={p.id} className="p-5 flex flex-col justify-between hover:shadow-md transition-shadow relative group">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-mono">Order Index: {p.order_index}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="icon" variant="ghost" className="size-8" onClick={() => openEdit(p)}>
                    <Pencil className="size-4 text-muted-foreground hover:text-foreground" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-8" onClick={() => handleDelete(p.id, p.title)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <h3 className="font-display text-xl mt-1">{p.title}</h3>
              <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{p.description || "No description provided."}</p>
            </div>
            
            <div className="mt-4 pt-4 border-t flex items-center justify-between">
              <Badge className="bg-primary/10 text-primary border-none flex items-center gap-1.5 py-1 px-2.5">
                <Award className="size-3.5" />
                {p.max_winners} Winner{p.max_winners > 1 ? "s" : ""} Allowed
              </Badge>
            </div>
          </Card>
        ))}

        {data?.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
            No positions created yet. Click "New position" to get started.
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit position" : "New position"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              upsert.mutate({
                data: {
                  id: editing?.id,
                  title: String(fd.get("title")),
                  description: String(fd.get("description") || "") || null,
                  max_winners: Number(fd.get("max_winners")),
                  order_index: Number(fd.get("order_index")),
                },
              });
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" defaultValue={editing?.title ?? ""} required placeholder="e.g. President, Senator" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="max_winners">Max Winners</Label>
                <Input 
                  id="max_winners" 
                  name="max_winners" 
                  type="number" 
                  min="1" 
                  max="100" 
                  defaultValue={editing?.max_winners ?? 1} 
                  required 
                />
                <span className="text-xs text-muted-foreground">Number of candidates allowed to win this seat.</span>
              </div>
              <div className="space-y-1">
                <Label htmlFor="order_index">Order Index</Label>
                <Input 
                  id="order_index" 
                  name="order_index" 
                  type="number" 
                  min="0" 
                  defaultValue={editing?.order_index ?? nextOrderIndex} 
                  required 
                />
                <span className="text-xs text-muted-foreground">Controls sorting order in the ballot list.</span>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" defaultValue={editing?.description ?? ""} placeholder="Optional description of the position duties..." />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={upsert.isPending}>
                {upsert.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}