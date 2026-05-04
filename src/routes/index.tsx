import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { CheckCircle2, KanbanSquare, BarChart3, Users } from "lucide-react";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="container mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: "var(--gradient-primary)" }}>
            <KanbanSquare className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">TaskHive</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/auth"><Button variant="ghost">Sign in</Button></Link>
          <Link to="/auth"><Button>Get started</Button></Link>
        </div>
      </header>

      <section className="container mx-auto px-6 pt-16 pb-24 text-center">
        <div className="mx-auto max-w-3xl">
          <span className="inline-flex items-center rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            Built for teams that ship
          </span>
          <h1 className="mt-6 text-5xl font-bold tracking-tight md:text-6xl">
            Plan, track, and deliver work{" "}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-hero)" }}>
              together
            </span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Organize projects, assign tasks, and watch progress unfold on a beautiful Kanban board with real-time analytics.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to="/auth"><Button size="lg" className="px-8">Start free</Button></Link>
            <Link to="/auth"><Button size="lg" variant="outline">Sign in</Button></Link>
          </div>
        </div>

        <div className="mx-auto mt-20 grid max-w-5xl gap-6 md:grid-cols-3">
          {[
            { icon: KanbanSquare, title: "Kanban boards", desc: "Drag tasks across To Do, In Progress, and Done." },
            { icon: Users, title: "Team roles", desc: "Admin and Member access controls per project." },
            { icon: BarChart3, title: "Live analytics", desc: "Track overdue, by-status, and per-user breakdowns." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border bg-card p-6 text-left" style={{ boxShadow: "var(--shadow-card)" }}>
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 text-base font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-16 flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {["Secure auth", "Role-based access", "Real-time updates", "Free to start"].map((f) => (
            <span key={f} className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" />{f}</span>
          ))}
        </div>
      </section>
    </div>
  );
}
