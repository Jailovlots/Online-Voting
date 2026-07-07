import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { useState } from "react";
import { toast } from "sonner";
import { ImageUpload } from "@/components/image-upload";

export const Route = createFileRoute("/_authenticated/admin/candidates")({
  head: () => ({ meta: [{ title: "Candidates — Admin" }] }),
  component: AdminCandidates,
});

function AdminCandidates() {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["admin-candidates"],
    queryFn: async () => {
      const [candidates, positions] = await Promise.all([
        api.queries.candidates(),
        api.queries.positions(),
      ]);
      return { candidates: (candidates as any) ?? [], positions: (positions as any) ?? [] };
    },
  });


  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [photoUrl, setPhotoUrl] = useState("");

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
    if (editing?.bio) {
      try {
        const parsed = JSON.parse(editing.bio);
        if (parsed && typeof parsed === 'object') {
          initialBio = { ...initialBio, ...parsed };
        }
      } catch (e) {
        initialBio.reasonForRunning = editing.bio;
      }
    }
    return initialBio;
  })();

  const upsert = useMutation({
    mutationFn: (payload: any) => api.admin.upsertCandidate(payload),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries(); setOpen(false); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.admin.deleteCandidate(id),
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
                        <Button size="sm" onClick={() => upsert.mutate({ ...c, approved: true })}>Approve</Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Pencil className="size-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => confirm("Delete?") && del.mutate(c.id)}><Trash2 className="size-4 text-destructive" /></Button>
                      </div>
                   </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto pr-2">
          <DialogHeader><DialogTitle>{editing ? "Edit candidate" : "New candidate"}</DialogTitle></DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const bioObj = {
                age: String(fd.get("bio_age") || ""),
                address: String(fd.get("bio_address") || ""),
                municipality: String(fd.get("bio_municipality") || ""),
                province: String(fd.get("bio_province") || ""),
                sex: String(fd.get("bio_sex") || ""),
                dateOfBirth: String(fd.get("bio_dateOfBirth") || ""),
                birthPlace: String(fd.get("bio_birthPlace") || ""),
                religion: String(fd.get("bio_religion") || ""),
                nationality: String(fd.get("bio_nationality") || ""),
                courseYear: String(fd.get("bio_courseYear") || ""),
                reasonForRunning: String(fd.get("bio_reasonForRunning") || ""),
              };
              upsert.mutate({
                id: editing?.id,
                position_id: String(fd.get("position_id")),
                full_name: String(fd.get("full_name")),
                party: String(fd.get("party") || "") || null,
                bio: JSON.stringify(bioObj),
                platform: String(fd.get("platform") || "") || null,
                photo_url: photoUrl || null,
                approved: true,
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
              uploadImageFn={async ({ data: { base64Data } }) => api.admin.uploadImage(base64Data)}
              label="Candidate Photo"
            />
            <div className="border-t pt-3 space-y-3">
              <h3 className="font-display text-sm font-semibold text-foreground">Biography & Personal Information</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Age</Label>
                  <Input name="bio_age" defaultValue={parsedBio.age} />
                </div>
                <div>
                  <Label>Sex</Label>
                  <Input name="bio_sex" defaultValue={parsedBio.sex} />
                </div>
                <div>
                  <Label>Date of Birth</Label>
                  <Input name="bio_dateOfBirth" type="date" defaultValue={parsedBio.dateOfBirth} />
                </div>
                <div>
                  <Label>Course/Year</Label>
                  <Input name="bio_courseYear" placeholder="e.g. BSIS 3" defaultValue={parsedBio.courseYear} />
                </div>
                <div>
                  <Label>Religion</Label>
                  <Input name="bio_religion" defaultValue={parsedBio.religion} />
                </div>
                <div>
                  <Label>Nationality</Label>
                  <Input name="bio_nationality" defaultValue={parsedBio.nationality} />
                </div>
                <div>
                  <Label>Municipality</Label>
                  <Input name="bio_municipality" defaultValue={parsedBio.municipality} />
                </div>
                <div>
                  <Label>Province</Label>
                  <Input name="bio_province" defaultValue={parsedBio.province} />
                </div>
                <div className="col-span-2">
                  <Label>Birth Place</Label>
                  <Input name="bio_birthPlace" defaultValue={parsedBio.birthPlace} />
                </div>
                <div className="col-span-2">
                  <Label>Address</Label>
                  <Input name="bio_address" defaultValue={parsedBio.address} />
                </div>
                <div className="col-span-2">
                  <Label>Reason for Running</Label>
                  <Textarea name="bio_reasonForRunning" placeholder="Explain your reason for running..." defaultValue={parsedBio.reasonForRunning} />
                </div>
              </div>
            </div>
            <div><Label>Platform</Label><Textarea name="platform" defaultValue={editing?.platform ?? ""} /></div>
            <DialogFooter><Button type="submit" disabled={upsert.isPending}>{upsert.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}