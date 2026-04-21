import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Bookmark, MessageSquareText } from "lucide-react";
import { timeAgo } from "@/lib/time";

export const Route = createFileRoute("/bookmarks")({
  component: () => (
    <RequireAuth>
      <BookmarksPage />
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Bookmarks — UniVerse" }] }),
});

interface SavedPost {
  kind: "post";
  id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
  user_id: string;
  profile: { username: string; display_name: string; avatar_url: string | null } | null;
}
interface SavedWhisper {
  kind: "whisper";
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profile: { username: string; display_name: string; avatar_url: string | null } | null;
}
type Saved = SavedPost | SavedWhisper;

function BookmarksPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Saved[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: bms } = await supabase
        .from("bookmarks")
        .select("target_id, target_type, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (!bms || bms.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }
      const postIds = bms.filter((b) => b.target_type === "post").map((b) => b.target_id);
      const whisperIds = bms
        .filter((b) => b.target_type === "whisper")
        .map((b) => b.target_id);
      const [{ data: ps }, { data: ws }] = await Promise.all([
        postIds.length
          ? supabase
              .from("posts")
              .select("id, user_id, image_url, caption, created_at")
              .in("id", postIds)
          : Promise.resolve({ data: [] }),
        whisperIds.length
          ? supabase
              .from("whispers")
              .select("id, user_id, content, created_at")
              .in("id", whisperIds)
          : Promise.resolve({ data: [] }),
      ]);
      const userIds = [
        ...new Set([
          ...(ps ?? []).map((p) => p.user_id),
          ...(ws ?? []).map((w) => w.user_id),
        ]),
      ];
      const { data: profs } =
        userIds.length > 0
          ? await supabase
              .from("profiles")
              .select("id, username, display_name, avatar_url")
              .in("id", userIds)
          : { data: [] };
      const profMap = new Map((profs ?? []).map((p) => [p.id, p]));

      const merged: Saved[] = [
        ...(ps ?? []).map(
          (p) =>
            ({
              kind: "post",
              ...p,
              profile: (profMap.get(p.user_id) as SavedPost["profile"]) ?? null,
            }) as SavedPost,
        ),
        ...(ws ?? []).map(
          (w) =>
            ({
              kind: "whisper",
              ...w,
              profile: (profMap.get(w.user_id) as SavedWhisper["profile"]) ?? null,
            }) as SavedWhisper,
        ),
      ];
      // sort by bookmark order
      const order = new Map(bms.map((b, i) => [`${b.target_type}:${b.target_id}`, i]));
      merged.sort(
        (a, b) =>
          (order.get(`${a.kind}:${a.id}`) ?? 0) -
          (order.get(`${b.kind}:${b.id}`) ?? 0),
      );
      setItems(merged);
      setLoading(false);
    })();
  }, [user]);

  const remove = async (item: Saved) => {
    if (!user) return;
    await supabase
      .from("bookmarks")
      .delete()
      .eq("user_id", user.id)
      .eq("target_type", item.kind)
      .eq("target_id", item.id);
    setItems((p) => p.filter((x) => !(x.id === item.id && x.kind === item.kind)));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-8">
      <h1 className="font-serif text-3xl mb-1 flex items-center gap-2">
        <Bookmark className="w-6 h-6 text-burgundy" /> Bookmarks
      </h1>
      <p className="text-sm text-muted-foreground italic mb-6">
        Saved posts and whispers, just for you.
      </p>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 italic font-serif text-lg">
          Nothing saved yet. Tap the bookmark icon on any post to save it.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <article
              key={`${item.kind}:${item.id}`}
              className="bg-card border border-border rounded-lg overflow-hidden shadow-card"
            >
              <div className="p-4 flex items-center gap-3">
                <Link
                  to="/u/$username"
                  params={{ username: item.profile?.username ?? "" }}
                >
                  <Avatar profile={item.profile} size="sm" />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link
                    to="/u/$username"
                    params={{ username: item.profile?.username ?? "" }}
                    className="text-sm font-medium hover:text-burgundy"
                  >
                    {item.profile?.display_name ?? "—"}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    @{item.profile?.username} · {timeAgo(item.created_at)}
                  </div>
                </div>
                <button
                  onClick={() => remove(item)}
                  className="text-xs text-muted-foreground hover:text-burgundy"
                >
                  Remove
                </button>
              </div>
              {item.kind === "post" ? (
                <>
                  <img
                    src={item.image_url}
                    alt={item.caption ?? ""}
                    loading="lazy"
                    className="w-full max-h-[500px] object-cover bg-muted"
                  />
                  {item.caption && (
                    <p className="px-4 py-3 text-sm leading-relaxed">
                      {item.caption}
                    </p>
                  )}
                </>
              ) : (
                <p className="px-4 pb-4 text-[15px] font-serif leading-relaxed whitespace-pre-wrap flex gap-2 items-start">
                  <MessageSquareText className="w-4 h-4 text-burgundy mt-1 shrink-0" />
                  <span>{item.content}</span>
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
