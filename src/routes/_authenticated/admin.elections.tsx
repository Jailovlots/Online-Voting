import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, Pencil, CalendarDays, Clock } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/elections")({
  head: () => ({ meta: [{ title: "Elections — Admin" }] }),
  component: ElectionsAdmin,
});

// Convert a UTC ISO string from the DB to a local datetime-local input value
function toLocalDatetimeInput(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Convert local datetime-local input value to ISO string for server
function fromLocalDatetimeInput(value: string): string {
  return new Date(value).toISOString();
}

const STATUS_OPTIONS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" },
] as const;

type ElectionStatus = "upcoming" | "active" | "closed";

interface ElectionFormState {
  id?: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  status: ElectionStatus;
}

const blankForm = (): ElectionFormState => {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return {
    title: "",
    description: "",
    starts_at: toLocalDatetimeInput(now.toISOString()),
    ends_at: toLocalDatetimeInput(tomorrow.toISOString()),
    status: "upcoming",
  };
};

function ElectionsAdmin() {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["elections"],
    queryFn: async () => (await api.queries.elections() as any[]) ?? [],
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ElectionFormState>(blankForm);

  // Status change (quick buttons on each card)
  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: ElectionStatus }) =>
      api.admin.setElectionStatus(v.id, v.status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["elections"] });
      toast.success("Election status updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Create / Edit election
  const upsertMut = useMutation({
    mutationFn: (payload: ElectionFormState) =>
      api.admin.upsertElection({
        id: payload.id,
        title: payload.title,
        description: payload.description || null,
        starts_at: fromLocalDatetimeInput(payload.starts_at),
        ends_at: fromLocalDatetimeInput(payload.ends_at),
        status: payload.status,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["elections"] });
      toast.success(form.id ? "Election updated" : "Election created");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openNew() {
    setForm(blankForm());
    setOpen(true);
  }

  function openEdit(e: any) {
    setForm({
      id: e.id,
      title: e.title,
      description: e.description ?? "",
      starts_at: toLocalDatetimeInput(e.starts_at),
      ends_at: toLocalDatetimeInput(e.ends_at),
      status: e.status as ElectionStatus,
    });
    setOpen(true);
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (new Date(form.ends_at) <= new Date(form.starts_at)) {
      toast.error("End date must be after start date");
      return;
    }
    upsertMut.mutate(form);
  }

  const statusColors: Record<ElectionStatus, string> = {
    active: "bg-success text-success-foreground",
    upcoming: "bg-warning text-warning-foreground",
    closed: "bg-muted text-foreground",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Elections</h1>
          <p className="text-muted-foreground">
            Create and manage election schedules and statuses.
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="size-4" />
          New Election
        </Button>
      </div>

      {/* Election cards */}
      <div className="space-y-3">
        {data?.length === 0 && (
          <Card className="p-10 text-center text-muted-foreground">
            No elections yet. Click &ldquo;New Election&rdquo; to create one.
          </Card>
        )}
        {data?.map((e) => (
          <Card
            key={e.id}
            className="p-5 flex flex-col md:flex-row md:items-start gap-4 justify-between"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-display text-xl truncate">{e.title}</h3>
                <Badge className={statusColors[e.status as ElectionStatus]}>
                  {e.status}
                </Badge>
              </div>
              {e.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {e.description}
                </p>
              )}
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <CalendarDays className="size-3.5" />
                  {format(new Date(e.starts_at), "PPP p")}
                </span>
                <span>→</span>
                <span className="flex items-center gap-1">
                  <Clock className="size-3.5" />
                  {format(new Date(e.ends_at), "PPP p")}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                className="gap-1"
                onClick={() => openEdit(e)}
              >
                <Pencil className="size-3.5" /> Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={statusMut.isPending || e.status === "upcoming"}
                onClick={() =>
                  statusMut.mutate({ id: e.id, status: "upcoming" })
                }
              >
                Mark Upcoming
              </Button>
              <Button
                size="sm"
                disabled={statusMut.isPending || e.status === "active"}
                onClick={() =>
                  statusMut.mutate({ id: e.id, status: "active" })
                }
                className="bg-success hover:bg-success/90 text-success-foreground"
              >
                Open Polls
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={statusMut.isPending || e.status === "closed"}
                onClick={() =>
                  statusMut.mutate({ id: e.id, status: "closed" })
                }
              >
                Close Polls
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Edit Election" : "New Election"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="el-title">Title</Label>
              <Input
                id="el-title"
                value={form.title}
                onChange={(ev) =>
                  setForm((f) => ({ ...f, title: ev.target.value }))
                }
                required
                maxLength={200}
                placeholder="e.g. Student Government Election 2026"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="el-desc">Description</Label>
              <Textarea
                id="el-desc"
                value={form.description}
                onChange={(ev) =>
                  setForm((f) => ({ ...f, description: ev.target.value }))
                }
                maxLength={1000}
                rows={3}
                placeholder="Optional — brief summary of this election"
              />
            </div>

            {/* Start / End dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="el-start">Start Date & Time</Label>
                <Input
                  id="el-start"
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, starts_at: ev.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="el-end">End Date & Time</Label>
                <Input
                  id="el-end"
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, ends_at: ev.target.value }))
                  }
                  required
                />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, status: v as ElectionStatus }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={upsertMut.isPending}>
                {upsertMut.isPending
                  ? "Saving…"
                  : form.id
                  ? "Save Changes"
                  : "Create Election"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}