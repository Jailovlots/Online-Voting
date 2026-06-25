import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile } from "@/lib/queries.server";
import { updateMyProfile } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/student/profile")({
  head: () => ({ meta: [{ title: "My Profile — StudentGov" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const qc = useQueryClient();
  const profileFn = useServerFn(getMyProfile);
  const updateFn = useServerFn(updateMyProfile);

  const { data } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => profileFn(),
  });

  const update = useMutation({
    mutationFn: async (patch: any) => updateFn({ data: patch }),
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!data) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-3xl">My profile</h1>
      <Card className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="size-20 rounded-full bg-gradient-to-br from-primary to-primary-glow grid place-items-center text-primary-foreground font-display text-2xl">
            {data.full_name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="font-display text-xl">{data.full_name}</h2>
            <p className="text-sm text-muted-foreground">{data.email}</p>
            <p className="text-xs text-muted-foreground">Student ID: {data.student_id}</p>
          </div>
        </div>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            update.mutate({
              full_name: String(fd.get("full_name")),
              course: String(fd.get("course")),
              year_level: Number(fd.get("year_level")) || null,
              photo_url: String(fd.get("photo_url")) || null,
            });
          }}
        >
          <div><Label>Full name</Label><Input name="full_name" defaultValue={data.full_name} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Course</Label><Input name="course" defaultValue={data.course ?? ""} /></div>
            <div><Label>Year level</Label><Input type="number" min={1} max={6} name="year_level" defaultValue={data.year_level ?? 1} /></div>
          </div>
          <div><Label>Photo URL</Label><Input type="url" name="photo_url" defaultValue={data.photo_url ?? ""} placeholder="https://…" /></div>
          <Button type="submit" disabled={update.isPending}>{update.isPending ? "Saving…" : "Save changes"}</Button>
        </form>
      </Card>
    </div>
  );
}