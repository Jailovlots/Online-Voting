import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCandidates, getPositions } from "@/lib/queries.server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import { upsertCandidate, deleteCandidate, uploadImage } from "@/lib/admin.functions";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ImageUpload } from "@/components/image-upload";

export const Route = createFileRoute("/_authenticated/admin/candidates")({
  head: () => ({ meta: [{ title: "Candidates — Admin" }] }),
  component: AdminCandidates,
});

function AdminCandidates() {
  const qc = useQueryClient();
  const upFn = useServerFn(upsertCandidate);
  const delFn = useServerFn(deleteCandidate);
  const getCandidatesFn = useServerFn(getCandidates);
  const getPositionsFn = useServerFn(getPositions);
  const uploadImageFn = useServerFn(uploadImage);

  const { data } = useQuery({
    queryKey: ["admin-candidates"],
    queryFn: async () => {
      const [candidates, positions] = await Promise.all([
        getCandidatesFn(),
        getPositionsFn(),
      ]);
      return { candidates: candidates ?? [], positions: positions ?? [] };
    },
  });


  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [photoUrl, setPhotoUrl] = useState("");

  const upsert = useMutation({
    mutationFn: upFn,
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries(); setOpen(false); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: delFn,
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  function openNew() { setEditing(null); setPhotoUrl(""); setOpen(true); }
  function openEdit(c: any) { setEditing(c); setPhotoUrl(c.photo_url ?? ""); setOpen(true); }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Candidates</h1>
          <p className="text-muted-foreground">Approve, edit, or remove candidates.</p>
        </div>
        <Button onClick={openNew}><Plus className="size-4 mr-1" /> New candidate</Button>
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr className="text-left">
              <th className="p-3">Name</th>
              <th className="p-3">Position</th>
              <th className="p-3">Party</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {data?.candidates.map((c) => {
              const pos = data.positions.find((p) => p.id === c.position_id);
              return (
                <tr key={c.id} className="border-t">
                   <td className="p-3 font-medium">
                     <div className="flex items-center gap-3">
                      {c.photo_url ? (
                        <img src={c.photo_url} alt="" className="size-8 rounded-full object-cover border" />
                      ) : (
                        <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                          {c.full_name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span>{c.full_name}</span>
                     </div>
                   </td>
                  <td className="p-3">{pos?.title}</td>
                  <td className="p-3 text-muted-foreground">{c.party}</td>
                  <td className="p-3">
                    <Badge className={c.approved ? "bg-success" : "bg-warning"}>{c.approved ? "Approved" : "Pending"}</Badge>
                  </td>
                   <td className="p-3">
                     <div className="flex gap-1 justify-end">
                     {!c.approved && (
                       <Button size="sm" onClick={() => upsert.mutate({ data: { ...c, approved: true } })}>Approve</Button>
                     )}
                     <Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Pencil className="size-4" /></Button>
                     <Button size="sm" variant="ghost" onClick={() => confirm("Delete?") && del.mutate({ data: { id: c.id } })}><Trash2 className="size-4 text-destructive" /></Button>
                     </div>
                   </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit candidate" : "New candidate"}</DialogTitle></DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              upsert.mutate({
                data: {
                  id: editing?.id,
                  position_id: String(fd.get("position_id")),
                  full_name: String(fd.get("full_name")),
                  party: String(fd.get("party") || "") || null,
                  bio: String(fd.get("bio") || "") || null,
                  platform: String(fd.get("platform") || "") || null,
                  photo_url: photoUrl || null,
                  approved: true,
                },
              });
            }}
          >
            <div>
              <Label>Position</Label>
              <Select name="position_id" defaultValue={editing?.position_id ?? data?.positions[0]?.id}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {data?.positions.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Full name</Label><Input name="full_name" defaultValue={editing?.full_name ?? ""} required /></div>
            <div><Label>Party</Label><Input name="party" defaultValue={editing?.party ?? ""} /></div>
            <ImageUpload
              value={photoUrl}
              onChange={setPhotoUrl}
              uploadImageFn={uploadImageFn}
              label="Candidate Photo"
            />
            <div><Label>Bio</Label><Textarea name="bio" defaultValue={editing?.bio ?? ""} /></div>
            <div><Label>Platform</Label><Textarea name="platform" defaultValue={editing?.platform ?? ""} /></div>
            <DialogFooter><Button type="submit" disabled={upsert.isPending}>{upsert.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}