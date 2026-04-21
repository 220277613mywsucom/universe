import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Heart, MessageCircle, UserPlus, MessagesSquare, CheckCheck } from "lucide-react";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notifications")({
  component: () => (
    <RequireAuth>
      <NotificationsPage />
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Notifications — UniVerse" }] }),
});

interface Notif {
  id: string;
  user_id: string;
  actor_id: string;
  type: "like" | "comment" | "follow" | "message" | "mention";
  target_type: string | null;
  target_id: string | null;
  preview: string | null;
  read: boolean;
  created_at: string;
  actor: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
}

function NotificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("id, user_id, actor_id, type, target_type, target_id, preview, read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (!data) {
      setItems([]);
      setLoading(false);
      return;
    }
    const ids = [...new Set(data.map((n) => n.actor_id))];
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", ids);
    const map = new Map((profs ?? []).map((p) => [p.id, p]));
    setItems(
      data.map((n) => ({
        ...n,
        actor: (map.get(n.actor_id) as Notif["actor"]) ?? null,
      })) as Notif[],
    );
    setLoading(false);

    // mark all as read
    const unread = data.filter((n) => !n.read).map((n) => n.id);
    if (unread.length) {
      await supabase.from("notifications").update({ read: true }).in("id", unread);
    }
  };

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel("notif-page")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const iconFor = (t: Notif["type"]) => {
    if (t === "like") return <Heart className="w-4 h-4 text-burgundy fill-burgundy" />;
    if (t === "comment") return <MessageCircle className="w-4 h-4 text-primary" />;
    if (t === "follow") return <UserPlus className="w-4 h-4 text-gold" />;
    if (t === "message") return <MessagesSquare className="w-4 h-4 text-burgundy" />;
    return <Bell className="w-4 h-4" />;
  };

  const textFor = (n: Notif) => {
    switch (n.type) {
      case "like":
        return `liked your ${n.target_type ?? "post"}`;
      case "comment":
        return `commented: "${n.preview ?? ""}"`;
      case "follow":
        return "started following you";
      case "message":
        return `sent: "${n.preview ?? ""}"`;
      case "mention":
        return "mentioned you";
    }
  };

  const linkFor = (n: Notif) => {
    if (n.type === "follow" && n.actor?.username)
      return { to: "/u/$username" as const, params: { username: n.actor.username } };
    if (n.type === "message")
      return { to: "/messages" as const };
    return { to: "/feed" as const };
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-3xl flex items-center gap-2">
          <Bell className="w-6 h-6 text-burgundy" /> Notifications
        </h1>
        {items.some((i) => !i.read) && (
          <span className="text-xs text-muted-foreground italic flex items-center gap-1">
            <CheckCheck className="w-3.5 h-3.5" /> All caught up
          </span>
        )}
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 italic font-serif text-lg">
          Nothing yet — your timeline awaits.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg shadow-card divide-y divide-border">
          {items.map((n) => {
            const l = linkFor(n);
            return (
              <Link
                key={n.id}
                {...l}
                className={cn(
                  "flex items-center gap-3 p-4 hover:bg-accent/40 transition-smooth",
                  !n.read && "bg-accent/20",
                )}
              >
                <Avatar profile={n.actor} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm">
                    <span className="font-medium">
                      {n.actor?.display_name ?? "—"}
                    </span>{" "}
                    <span className="text-muted-foreground">{textFor(n)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {timeAgo(n.created_at)}
                  </div>
                </div>
                <div className="shrink-0">{iconFor(n.type)}</div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
