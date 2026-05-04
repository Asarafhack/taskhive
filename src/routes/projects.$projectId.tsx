import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, ArrowLeft, Trash2, UserPlus, Crown, X, Calendar } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/projects/$projectId")({
  component: () => <AppShell><ProjectDetail /></AppShell>,
});

type Status = "todo" | "in_progress" | "done";
type Priority = "low" | "medium" | "high";

const taskSchema = z.object({
  title: z.string().trim().min(1, "Title required").max(150),
  description: z.string().trim().max(1000).optional(),
  due_date: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]),
  assigned_to: z.string().optional(),
});

function ProjectDetail() {
  const { projectId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", projectId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: members } = useQuery({
    queryKey: ["members", projectId],
    queryFn: async () => {
      const { data: pm, error } = await supabase
        .from("project_members")
        .select("id,user_id,role")
        .eq("project_id", projectId);
      if (error) throw error;
      const ids = pm.map((m) => m.user_id);
      const { data: profs } = await supabase.from("profiles").select("id,name,email").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      return pm.map((m) => ({ ...m, profile: profs?.find((p) => p.id === m.user_id) }));
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const isAdmin = !!members?.find((m) => m.user_id === user?.id && m.role === "admin") || project?.owner_id === user?.id;
  const isOwner = project?.owner_id === user?.id;

  const updateTask = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", projectId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Task deleted"); qc.invalidateQueries({ queryKey: ["tasks", projectId] }); },
  });

  const deleteProject = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("projects").delete().eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Project deleted"); window.location.href = "/projects"; },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: { key: Status; label: string }[] = [
    { key: "todo", label: "To Do" },
    { key: "in_progress", label: "In Progress" },
    { key: "done", label: "Done" },
  ];

  if (!project) return <div className="p-8 text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <div>
        <Link to="/projects" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Projects
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            {project.description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{project.description}</p>}
          </div>
          <div className="flex gap-2">
            {isAdmin && <NewTaskDialog projectId={projectId} members={members ?? []} />}
            {isAdmin && <ManageMembersDialog projectId={projectId} members={members ?? []} ownerId={project.owner_id} />}
            {isOwner && (
              <Button variant="outline" size="icon" onClick={() => confirm("Delete this project and all its tasks?") && deleteProject.mutate()}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {columns.map((col) => {
          const colTasks = (tasks ?? []).filter((t) => t.status === col.key);
          return (
            <div key={col.key} className="rounded-xl border bg-card/50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">{col.label}</h3>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{colTasks.length}</span>
              </div>
              <div className="space-y-3">
                {colTasks.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">No tasks</p>}
                {colTasks.map((t) => {
                  const assignee = members?.find((m) => m.user_id === t.assigned_to)?.profile;
                  const canEdit = isAdmin || t.assigned_to === user?.id;
                  const overdue = t.due_date && t.due_date < new Date().toISOString().slice(0, 10) && t.status !== "done";
                  return (
                    <div key={t.id} className="rounded-lg border bg-card p-3" style={{ boxShadow: "var(--shadow-card)" }}>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-medium leading-snug">{t.title}</h4>
                        {isAdmin && (
                          <button onClick={() => deleteTask.mutate(t.id)} className="text-muted-foreground hover:text-destructive">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {t.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>}
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <PriorityBadge p={t.priority as Priority} />
                        {t.due_date && (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${overdue ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                            <Calendar className="h-3 w-3" /> {t.due_date}
                          </span>
                        )}
                        {assignee && (
                          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                            {assignee.name}
                          </span>
                        )}
                      </div>
                      {canEdit && (
                        <Select value={t.status} onValueChange={(v) => updateTask.mutate({ id: t.id, patch: { status: v } })}>
                          <SelectTrigger className="mt-3 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todo">To Do</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PriorityBadge({ p }: { p: Priority }) {
  const map = {
    low: { bg: "bg-muted", fg: "text-muted-foreground", label: "Low" },
    medium: { bg: "bg-accent", fg: "text-accent-foreground", label: "Medium" },
    high: { bg: "bg-destructive/10", fg: "text-destructive", label: "High" },
  }[p];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map.bg} ${map.fg}`}>{map.label}</span>;
}

function NewTaskDialog({ projectId, members }: { projectId: string; members: any[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ title: "", description: "", due_date: "", priority: "medium", assigned_to: "" });

  const create = useMutation({
    mutationFn: async () => {
      const r = taskSchema.safeParse(form);
      if (!r.success) throw new Error(r.error.issues[0].message);
      const { error } = await supabase.from("tasks").insert({
        project_id: projectId,
        title: r.data.title,
        description: r.data.description || null,
        due_date: r.data.due_date || null,
        priority: r.data.priority,
        assigned_to: r.data.assigned_to || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task created");
      setOpen(false);
      setForm({ title: "", description: "", due_date: "", priority: "medium", assigned_to: "" });
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> New task</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create task</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Due date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Assign to</Label>
            <Select value={form.assigned_to || "unassigned"} onValueChange={(v) => setForm({ ...form, assigned_to: v === "unassigned" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>{m.profile?.name || m.profile?.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>{create.isPending ? "Creating..." : "Create task"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageMembersDialog({ projectId, members, ownerId }: { projectId: string; members: any[]; ownerId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");

  const add = useMutation({
    mutationFn: async () => {
      const e = z.string().trim().email().parse(email);
      const { data: prof, error: pe } = await supabase.from("profiles").select("id").eq("email", e).maybeSingle();
      if (pe) throw pe;
      if (!prof) throw new Error("No user found with that email. They must sign up first.");
      const { error } = await supabase.from("project_members").insert({ project_id: projectId, user_id: prof.id, role });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member added");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["members", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from("project_members").delete().eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", projectId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><UserPlus className="mr-2 h-4 w-4" /> Members</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Manage members</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="user@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Select value={role} onValueChange={(v: any) => setRole(v)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => add.mutate()} disabled={add.isPending}>Add</Button>
          </div>
          <div className="divide-y rounded-lg border">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3">
                <div>
                  <div className="text-sm font-medium">{m.profile?.name || m.profile?.email}</div>
                  <div className="text-xs text-muted-foreground">{m.profile?.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                    {m.role === "admin" && <Crown className="h-3 w-3" />} {m.role}
                  </span>
                  {m.user_id !== ownerId && (
                    <button onClick={() => remove.mutate(m.id)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
