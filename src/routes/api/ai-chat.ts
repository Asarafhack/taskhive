import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const SYSTEM_PROMPT = `You are TaskHive Assistant, a friendly AI productivity coach inside a team task-management app (projects, tasks, kanban: todo / in_progress / done, priorities low/medium/high, due dates, admin & member roles).

When given the user's task data as JSON context, ground your answers in it: count, summarize, surface overdue work, suggest priorities, draft task descriptions, propose next steps, and help break large goals into tasks. Keep replies short, structured with markdown bullets, and action-oriented. If asked something off-topic, politely steer back to projects/tasks.`;

export const Route = createFileRoute("/api/ai-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        const apiKey = process.env.LOVABLE_API_KEY;

        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !apiKey) {
          return new Response(JSON.stringify({ error: "Server not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        const token = authHeader.slice(7);

        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
        if (claimsErr || !claimsData?.claims?.sub) {
          return new Response(JSON.stringify({ error: "Invalid token" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        const userId = claimsData.claims.sub;

        const { messages } = (await request.json()) as {
          messages: { role: "user" | "assistant"; content: string }[];
        };

        const [{ data: tasks }, { data: projects }] = await Promise.all([
          supabase
            .from("tasks")
            .select("title,status,priority,due_date,assigned_to,project_id")
            .limit(200),
          supabase.from("projects").select("id,name").limit(50),
        ]);

        const today = new Date().toISOString().slice(0, 10);
        const myTasks = (tasks ?? []).filter((t) => t.assigned_to === userId);
        const ctx = {
          today,
          projects: projects ?? [],
          stats: {
            total_tasks_visible: tasks?.length ?? 0,
            my_tasks: myTasks.length,
            my_overdue: myTasks.filter(
              (t) => t.due_date && t.due_date < today && t.status !== "done",
            ).length,
            my_in_progress: myTasks.filter((t) => t.status === "in_progress").length,
            my_done: myTasks.filter((t) => t.status === "done").length,
          },
          my_tasks_sample: myTasks.slice(0, 25),
        };

        const upstream = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              stream: true,
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "system", content: `User context (JSON):\n${JSON.stringify(ctx)}` },
                ...messages,
              ],
            }),
          },
        );

        if (!upstream.ok) {
          if (upstream.status === 429) {
            return new Response(
              JSON.stringify({ error: "Rate limit reached. Try again in a moment." }),
              { status: 429, headers: { "Content-Type": "application/json" } },
            );
          }
          if (upstream.status === 402) {
            return new Response(
              JSON.stringify({ error: "AI credits exhausted. Add credits in Workspace Settings → Usage." }),
              { status: 402, headers: { "Content-Type": "application/json" } },
            );
          }
          const text = await upstream.text();
          return new Response(JSON.stringify({ error: text || "AI gateway error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(upstream.body, {
          headers: { "Content-Type": "text/event-stream" },
        });
      },
    },
  },
});
