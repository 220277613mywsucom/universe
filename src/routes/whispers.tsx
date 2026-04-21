import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Heart, MessageSquareText, Trash2 } from "lucide-react";
import { timeAgo } from "@/lib/time";

export const Route = createFileRoute("/whispers")({
  component: () => (
    <RequireAuth>
      <WhispersPage />
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Whispers — UniVerse" }] }),
});

interface WhisperRow {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile: { username: string; display_name: string; avatar_url: string | null } | null;
  likes_count: number;
  liked_by_me: boolean;
}

function WhispersPage() {
  const { user, profile } = useAuth();
  const [whispers, setWhispers] = useState<WhisperRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("whispers")
      .select("id, user_id, content, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (!data) {
      setWhispers([]);
      setLoading(false);
      return;
    }
    const ids = [...new Set(data.map((w) => w.user_id))];
    const wIds = data.map((w) => w.id);
    const [{ data: profs }, { data: likes }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", ids),
      supabase
        .from("likes")
        .select("user_id, target_id")
        .eq("target_type", "whisper")
        .in("target_id", wIds),
    ]);
    const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
    const likeMap = new Map<string, { count: number; liked: boolean }>();
    (likes ?? []).forEach((l) => {
      const c = likeMap.get(l.target_id) ?? { count: 0, liked: false };
      c.count++;
      if (l.user_id === user?.id) c.liked = true;
      likeMap.set(l.target_id, c);
    });
    setWhispers(
      data.map((w) => {
        const lk = likeMap.get(w.id);
        return {
          ...w,
          profile: (profMap.get(w.user_id) as WhisperRow["profile"]) ?? null,
          likes_count: lk?.count ?? 0,
          liked_by_me: lk?.liked ?? false,
        };
      }),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const post = async () => {
    if (!user) return;
    const text = content.trim();
    if (!text) return;
    if (text.length > 280) return toast.error("Whispers max 280 characters");
    setPosting(true);
    const { error } = await supabase
      .from("whispers")
      .insert({ user_id: user.id, content: text });
    setPosting(false);
    if (error) return toast.error(error.message);
    setContent("");
    load();
  };

  const toggleLike = async (w: WhisperRow) => {
    if (!user) return;
    if (w.liked_by_me) {
      await supabase
        .from("likes")
        .delete()
        .eq("user_id", user.id)
        .eq("target_type", "whisper")
        .eq("target_id", w.id);
    } else {
      await supabase
        .from("likes")
        .insert({ user_id: user.id, target_type: "whisper", target_id: w.id });
    }
    setWhispers((prev) =>
      prev.map((x) =>
        x.id === w.id
          ? {
              ...x,
              liked_by_me: !x.liked_by_me,
              likes_count: x.likes_count + (x.liked_by_me ? -1 : 1),
            }
          : x,
      ),
    );
  };

  const deleteWhisper = async (id: string) => {
    if (!confirm("Delete this whisper?")) return;
    await supabase.from("whispers").delete().eq("id", id);
    setWhispers((p) => p.filter((w) => w.id !== id));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-8">
      <h1 className="font-serif text-3xl mb-1 flex items-center gap-2">
        <MessageSquareText className="w-6 h-6 text-burgundy" /> Whispers
      </h1>
      <p className="text-sm text-muted-foreground italic mb-6">
        Short thoughts, witticisms, and observations.
      </p>

      {/* Composer */}
      <div className="bg-card border border-border rounded-lg p-4 shadow-card mb-6">
        <div className="flex gap-3">
          <Avatar profile={profile} size="md" />
          <div className="flex-1">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={280}
              placeholder="What's on your mind?"
              className="w-full bg-transparent resize-none outline-none text-base placeholder:text-muted-foreground min-h-[80px] font-serif"
            />
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span
                className={`text-xs ${content.length > 260 ? "text-burgundy" : "text-muted-foreground"}`}
              >
                {content.length} / 280
              </span>
              <button
                onClick={post}
                disabled={!content.trim() || posting}
                className="px-5 py-2 rounded-md bg-burgundy text-burgundy-foreground text-sm font-medium hover:opacity-95 transition-smooth disabled:opacity-50 shadow-elegant"
              >
                {posting ? "Posting…" : "Whisper"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading…</div>
      ) : whispers.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 italic font-serif text-lg">
          The library is silent. Share the first whisper.
        </div>
      ) : (
        <div className="space-y-3">
          {whispers.map((w) => (
            <article
              key={w.id}
              className="bg-card border border-border rounded-lg p-4 shadow-card hover:shadow-elegant transition-smooth"
            >
              <div className="flex gap-3">
                <Link to="/u/$username" params={{ username: w.profile?.username ?? "" }}>
                  <Avatar profile={w.profile} size="sm" />
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <Link
                      to="/u/$username"
                      params={{ username: w.profile?.username ?? "" }}
                      className="font-medium hover:text-burgundy transition-smooth"
                    >
                      {w.profile?.display_name ?? "—"}
                    </Link>
                    <span className="text-muted-foreground text-xs">
                      @{w.profile?.username} · {timeAgo(w.created_at)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[15px] leading-relaxed whitespace-pre-wrap">
                    {w.content}
                  </p>
                  <div className="mt-3 flex items-center gap-5 text-sm text-muted-foreground">
                    <button
                      onClick={() => toggleLike(w)}
                      className={`flex items-center gap-1.5 hover:text-burgundy transition-smooth ${w.liked_by_me ? "text-burgundy" : ""}`}
                    >
                      <Heart
                        className={`w-4 h-4 ${w.liked_by_me ? "fill-burgundy" : ""}`}
                      />
                      {w.likes_count}
                    </button>
                    {w.user_id === user?.id && (
                      <button
                        onClick={() => deleteWhisper(w.id)}
                        className="hover:text-burgundy transition-smooth ml-auto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
