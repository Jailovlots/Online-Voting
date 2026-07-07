import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { api } from "@/lib/api-client";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/admin/announcements")({
  head: () => ({ meta: [{ title: "Announcements — Admin" }] }),
  component: AdminAnnouncements,
});

function AdminAnnouncements() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => (await api.queries.announcements() as any[]) ?? [],
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const upsert = useMutation({ mutationFn: (payload: any) => api.admin.upsertAnnouncement(payload), onSuccess: () => { toast.success("Saved"); qc.invalidateQueries(); setOpen(false); }, onError: (e: any) => toast.error(e.message) });
  const del = useMutation({ mutationFn: (id: string) => api.admin.deleteAnnouncement(id), onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries(); }, onError: (e: any) => toast.error(e.message) });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="font-display text-3xl">Announcements</h1>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4 mr-1" /> New</Button>
      </div>
      <div className="space-y-3">
        {data?.map((a) => (
          <Card key={a.id} className="p-5">
            <div className="flex justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg">{a.title}</h3>
                  {a.pinned && <Badge className="bg-gold text-gold-foreground">Pinned</Badge>}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{a.body}</p>
                <p className="text-xs text-muted-foreground mt-2">{format(new Date(a.created_at), "PPP")}</p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => { setEditing(a); setOpen(true); }}><Pencil className="size-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => confirm("Delete?") && del.mutate(a.id)}><Trash2 className="size-4 text-destructive" /></Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} announcement</DialogTitle></DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              upsert.mutate({
                id: editing?.id,
                title: String(fd.get("title")),
                body: String(fd.get("body")),
                pinned: fd.get("pinned") === "on",
              });
            }}
          >
            <div><Label>Title</Label><Input name="title" defaultValue={editing?.title ?? ""} required /></div>
            <div><Label>Body</Label><Textarea name="body" defaultValue={editing?.body ?? ""} required rows={5} /></div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="pinned" defaultChecked={editing?.pinned} /> Pin to top
            </label>
            <DialogFooter><Button type="submit" disabled={upsert.isPending}>Save</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}