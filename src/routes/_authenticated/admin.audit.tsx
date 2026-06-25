import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getAuditLogs } from "@/lib/queries.server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({ meta: [{ title: "Audit logs — Admin" }] }),
  component: Audit,
});

function Audit() {
  const getAuditLogsFn = useServerFn(getAuditLogs);
  const { data } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => (await getAuditLogsFn()) ?? [],
  });


  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Audit logs</h1>
      <Card>
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-3">When</th>
              <th className="p-3">Action</th>
              <th className="p-3">Target</th>
              <th className="p-3">Actor</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="p-3 text-muted-foreground">{format(new Date(l.created_at), "PPp")}</td>
                <td className="p-3"><Badge variant="outline">{l.action}</Badge></td>
                <td className="p-3 font-mono text-xs">{l.target?.slice(0, 8)}</td>
                <td className="p-3 font-mono text-xs">{l.actor_id?.slice(0, 8) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}