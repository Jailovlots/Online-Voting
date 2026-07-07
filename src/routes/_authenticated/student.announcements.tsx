import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Megaphone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/student/announcements")({
  head: () => ({ meta: [{ title: "Announcements — StudentGov" }] }),
  component: AnnouncementsPage,
});

function AnnouncementsPage() {
  const { data } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => (await api.queries.announcements() as any[]) ?? [],
  });


  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Announcements</h1>
        <p className="text-muted-foreground">Official updates from the elections committee.</p>
      </div>
      <div className="space-y-3">
        {data?.map((a) => (
          <Card key={a.id} className="p-5">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-lg bg-accent grid place-items-center text-primary"><Megaphone className="size-5" /></div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display text-lg">{a.title}</h3>
                  {a.pinned && <Badge className="bg-gold text-gold-foreground">Pinned</Badge>}
                  <span className="text-xs text-muted-foreground ml-auto">{format(new Date(a.created_at), "MMM d, yyyy")}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line">{a.body}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}