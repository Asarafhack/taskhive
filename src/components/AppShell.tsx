import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ReactNode, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { KanbanSquare, LayoutDashboard, FolderKanban, LogOut } from "lucide-react";
import { AIChatWidget } from "@/components/AIChatWidget";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  }

  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/projects", label: "Projects", icon: FolderKanban },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
        <Link to="/dashboard" className="flex items-center gap-2 px-6 py-5">
          <div className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: "var(--gradient-primary)" }}>
            <KanbanSquare className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold">TaskHive</span>
        </Link>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = path === to || (to === "/projects" && path.startsWith("/projects"));
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3">
          <div className="mb-3 px-3 text-xs">
            <div className="font-medium text-foreground truncate">{user.user_metadata?.name || user.email}</div>
            <div className="truncate text-muted-foreground">{user.email}</div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => signOut().then(() => navigate({ to: "/" }))}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-card/50 px-6 py-3 md:hidden">
          <Link to="/dashboard" className="flex items-center gap-2">
            <KanbanSquare className="h-5 w-5 text-primary" />
            <span className="font-semibold">TaskHive</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => signOut().then(() => navigate({ to: "/" }))}><LogOut className="h-4 w-4" /></Button>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
      <AIChatWidget />
    </div>
  );
}
