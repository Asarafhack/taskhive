import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { CheckCircle2, Clock, AlertTriangle, ListTodo, Users } from "lucide-react";

export const Route = createFileRoute("/dashboard")({ component: DashboardPage });

function DashboardPage() {
  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  );
}

function Dashboard() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", user?.id],
    queryFn: async () => {
      const [tasksRes, profilesRes] = await Promise.all([
        supabase.from("tasks").select("id,status,priority,due_date,assigned_to,project_id,title"),
        supabase.from("profiles").select("id,name,email"),
      ]);
      if (tasksRes.error) throw tasksRes.error;
      if (profilesRes.error) throw profilesRes.error;
      return { tasks: tasksRes.data ?? [], profiles: profilesRes.data ?? [] };
    },
  });

  const tasks = data?.tasks ?? [];
  const profiles = data?.profiles ?? [];
  const total = tasks.length;
  const todo = tasks.filter((t) => t.status === "todo").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const done = tasks.filter((t) => t.status === "done").length;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = tasks.filter((t) => t.due_date && t.due_date < today && t.status !== "done");

  const perUser = profiles
    .map((p) => ({ ...p, count: tasks.filter((t) => t.assigned_to === p.id).length }))
    .filter((p) => p.count > 0)
    .sort((a, b) => b.count - a.count);

  const max = Math.max(1, ...perUser.map((u) => u.count));

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 md:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">A quick look at everything happening across your projects.</p>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={ListTodo} label="Total tasks" value={total} tone="primary" />
            <Stat icon={Clock} label="In progress" value={inProgress} tone="warning" />
            <Stat icon={CheckCircle2} label="Completed" value={done} tone="success" />
            <Stat icon={AlertTriangle} label="Overdue" value={overdue.length} tone="destructive" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Status breakdown">
              <div className="space-y-4">
                {[
                  { label: "To Do", value: todo, color: "var(--muted-foreground)" },
                  { label: "In Progress", value: inProgress, color: "var(--warning)" },
                  { label: "Done", value: done, color: "var(--success)" },
                ].map((row) => {
                  const pct = total ? (row.value / total) * 100 : 0;
                  return (
                    <div key={row.label}>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{row.label}</span>
                        <span className="text-muted-foreground">{row.value}</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: row.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card title="Tasks per user" icon={Users}>
              {perUser.length === 0 ? (
                <p className="text-sm text-muted-foreground">No assigned tasks yet.</p>
              ) : (
                <div className="space-y-3">
                  {perUser.slice(0, 6).map((u) => (
                    <div key={u.id}>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium truncate">{u.name}</span>
                        <span className="text-muted-foreground">{u.count}</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full" style={{ width: `${(u.count / max) * 100}%`, background: "var(--gradient-primary)" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card title="Overdue tasks" icon={AlertTriangle}>
            {overdue.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing overdue. Nice work.</p>
            ) : (
              <ul className="divide-y">
                {overdue.slice(0, 8).map((t) => (
                  <li key={t.id} className="flex items-center justify-between py-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{t.title}</div>
                      <div className="text-xs text-muted-foreground">Due {t.due_date}</div>
                    </div>
                    <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">Overdue</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: "primary" | "warning" | "success" | "destructive" }) {
  const map = {
    primary: { bg: "var(--primary)", fg: "var(--primary-foreground)" },
    warning: { bg: "var(--warning)", fg: "var(--warning-foreground)" },
    success: { bg: "var(--success)", fg: "var(--success-foreground)" },
    destructive: { bg: "var(--destructive)", fg: "var(--destructive-foreground)" },
  }[tone];
  return (
    <div className="rounded-xl border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg" style={{ background: map.bg, color: map.fg }}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold">{value}</div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon?: any; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-6" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="mb-4 flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}
