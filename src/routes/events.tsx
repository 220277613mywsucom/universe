import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CalendarHeart, Plus, MapPin, Clock, Users } from "lucide-react";
import { timeAgo } from "@/lib/time";

export const Route = createFileRoute("/events")({
  component: () => (
    <RequireAuth>
      <EventsPage />
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Events — UniVerse" }] }),
});

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  created_by: string;
  created_at: string;
  creator: { username: string; display_name: string; avatar_url: string | null } | null;
  going_count: number;
  my_status: "going" | "maybe" | "not_going" | null;
}

function EventsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<EventRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [loc, setLoc] = useState("");
  const [starts, setStarts] = useState("");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("events")
      .select("id, title, description, location, starts_at, ends_at, created_by, created_at")
      .gte("starts_at", new Date(Date.now() - 86_400_000).toISOString())
      .order("starts_at", { ascending: true })
      .limit(100);
    if (!data) return setItems([]);

    const ids = [...new Set(data.map((e) => e.created_by))];
    const eventIds = data.map((e) => e.id);
    const [{ data: profs }, { data: rsvps }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", ids),
      supabase
        .from("event_rsvps")
        .select("event_id, user_id, status")
        .in("event_id", eventIds),
    ]);
    const pm = new Map((profs ?? []).map((p) => [p.id, p]));
    const goingByEvent = new Map<string, number>();
    const myStatusByEvent = new Map<string, EventRow["my_status"]>();
    (rsvps ?? []).forEach((r) => {
      if (r.status === "going")
        goingByEvent.set(r.event_id, (goingByEvent.get(r.event_id) ?? 0) + 1);
      if (r.user_id === user.id)
        myStatusByEvent.set(r.event_id, r.status as EventRow["my_status"]);
    });

    setItems(
      data.map((e) => ({
        ...e,
        creator: (pm.get(e.created_by) as EventRow["creator"]) ?? null,
        going_count: goingByEvent.get(e.id) ?? 0,
        my_status: myStatusByEvent.get(e.id) ?? null,
      })),
    );
  };

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel("events-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_rsvps" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const create = async () => {
    if (!user) return;
    if (!title.trim() || !starts) return toast.error("Title and date required");
    const { error } = await supabase.from("events").insert({
      title: title.trim(),
      description: desc.trim() || null,
      location: loc.trim() || null,
      starts_at: new Date(starts).toISOString(),
      created_by: user.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Event created");
    setTitle("");
    setDesc("");
    setLoc("");
    setStarts("");
    setShowForm(false);
    load();
  };

  const rsvp = async (eventId: string, status: "going" | "maybe" | "not_going") => {
    if (!user) return;
    // upsert
    const { error } = await supabase
      .from("event_rsvps")
      .upsert(
        { event_id: eventId, user_id: user.id, status },
        { onConflict: "event_id,user_id" },
      );
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-32 md:pb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl flex items-center gap-2">
            <CalendarHeart className="w-7 h-7 text-burgundy" /> Events
          </h1>
          <p className="text-sm text-muted-foreground italic">
            Campus happenings & student gatherings.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="px-4 py-2 rounded-md bg-burgundy text-burgundy-foreground text-sm font-medium inline-flex items-center gap-2 shadow-elegant"
        >
          <Plus className="w-4 h-4" /> Create
        </button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-lg shadow-card p-5 mb-6 space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
            className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm"
          />
          <input
            value={loc}
            onChange={(e) => setLoc(e.target.value)}
            placeholder="Location"
            className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm"
          />
          <input
            type="datetime-local"
            value={starts}
            onChange={(e) => setStarts(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm"
          />
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            placeholder="Description"
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
              onClick={create}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm shadow-elegant"
            >
              Publish
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 italic font-serif text-lg">
          No upcoming events. Be the first to host one.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((e) => (
            <article
              key={e.id}
              className="bg-card border border-border rounded-lg shadow-card p-5"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-14 h-14 rounded-md bg-hero text-gold flex flex-col items-center justify-center shrink-0 shadow-elegant">
                  <span className="text-[10px] uppercase tracking-wider">
                    {new Date(e.starts_at).toLocaleString([], { month: "short" })}
                  </span>
                  <span className="font-serif text-xl leading-none">
                    {new Date(e.starts_at).getDate()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-serif text-lg leading-tight">{e.title}</h3>
                  <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(e.starts_at).toLocaleString([], {
                        weekday: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {e.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {e.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> {e.going_count} going
                    </span>
                  </div>
                </div>
              </div>
              {e.description && (
                <p className="text-sm text-muted-foreground mb-3 whitespace-pre-wrap">
                  {e.description}
                </p>
              )}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                  <Avatar profile={e.creator} size="xs" />
                  <span className="truncate">
                    by @{e.creator?.username} · {timeAgo(e.created_at)}
                  </span>
                </div>
                <div className="flex gap-1 shrink-0">
                  {(["going", "maybe", "not_going"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => rsvp(e.id, s)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-smooth ${
                        e.my_status === s
                          ? s === "going"
                            ? "bg-primary text-primary-foreground"
                            : s === "maybe"
                              ? "bg-gold text-gold-foreground"
                              : "bg-burgundy text-burgundy-foreground"
                          : "bg-accent/40 text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {s === "going" ? "Going" : s === "maybe" ? "Maybe" : "Can't"}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
