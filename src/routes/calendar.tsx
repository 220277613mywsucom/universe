import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CalendarDays, Plus, Check, Trash2, BookOpen } from "lucide-react";

export const Route = createFileRoute("/calendar")({
  component: () => (
    <RequireAuth>
      <CalendarPage />
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Calendar — UniVerse" }] }),
});

interface Assignment {
  id: string;
  title: string;
  course: string | null;
  notes: string | null;
  due_at: string;
  completed: boolean;
}

function CalendarPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Assignment[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [course, setCourse] = useState("");
  const [notes, setNotes] = useState("");
  const [due, setDue] = useState("");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("assignments")
      .select("id, title, course, notes, due_at, completed")
      .eq("user_id", user.id)
      .order("due_at", { ascending: true });
    setItems((data ?? []) as Assignment[]);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const add = async () => {
    if (!user) return;
    if (!title.trim()) return toast.error("Title required");
    if (!due) return toast.error("Pick a due date");
    const { error } = await supabase.from("assignments").insert({
      user_id: user.id,
      title: title.trim(),
      course: course.trim() || null,
      notes: notes.trim() || null,
      due_at: new Date(due).toISOString(),
    });
    if (error) return toast.error(error.message);
    toast.success("Reminder added");
    setTitle("");
    setCourse("");
    setNotes("");
    setDue("");
    setShowForm(false);
    load();
  };

  const toggle = async (a: Assignment) => {
    await supabase
      .from("assignments")
      .update({ completed: !a.completed })
      .eq("id", a.id);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("assignments").delete().eq("id", id);
    load();
  };

  // group by date label
  const groups = new Map<string, Assignment[]>();
  items.forEach((a) => {
    const d = new Date(a.due_at);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);
    const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
    let label: string;
    if (diff < 0) label = "Overdue";
    else if (diff === 0) label = "Today";
    else if (diff === 1) label = "Tomorrow";
    else if (diff <= 7) label = "This week";
    else label = "Later";
    const arr = groups.get(label) ?? [];
    arr.push(a);
    groups.set(label, arr);
  });
  const order = ["Overdue", "Today", "Tomorrow", "This week", "Later"];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-32 md:pb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-gold" /> Calendar
          </h1>
          <p className="text-sm text-muted-foreground italic">
            Assignment reminders, never missed.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="px-4 py-2 rounded-md bg-burgundy text-burgundy-foreground text-sm font-medium inline-flex items-center gap-2 shadow-elegant"
        >
          <Plus className="w-4 h-4" /> New
        </button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-lg shadow-card p-5 mb-6 space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Assignment title"
            className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm"
          />
          <input
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            placeholder="Course (optional)"
            className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm"
          />
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm resize-none"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-md text-sm hover:bg-accent"
            >
              Cancel
            </button>
            <button
              onClick={add}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm shadow-elegant"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 italic font-serif text-lg">
          No assignments yet. Add your first one.
        </div>
      ) : (
        <div className="space-y-6">
          {order
            .filter((label) => groups.has(label))
            .map((label) => (
              <div key={label}>
                <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  {label}
                </h2>
                <div className="bg-card border border-border rounded-lg shadow-card divide-y divide-border">
                  {groups.get(label)!.map((a) => (
                    <div
                      key={a.id}
                      className={`p-4 flex items-start gap-3 ${a.completed ? "opacity-60" : ""}`}
                    >
                      <button
                        onClick={() => toggle(a)}
                        className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                          a.completed
                            ? "bg-burgundy border-burgundy"
                            : "border-border hover:border-burgundy"
                        }`}
                      >
                        {a.completed && (
                          <Check className="w-3 h-3 text-burgundy-foreground" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium text-sm ${a.completed ? "line-through" : ""}`}>
                          {a.title}
                        </div>
                        {a.course && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <BookOpen className="w-3 h-3" /> {a.course}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          Due {new Date(a.due_at).toLocaleString([], {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        {a.notes && (
                          <div className="text-xs text-muted-foreground mt-1 italic">
                            {a.notes}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => remove(a.id)}
                        className="text-muted-foreground hover:text-burgundy p-1"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
