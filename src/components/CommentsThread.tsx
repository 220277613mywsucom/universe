import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Avatar } from "./Avatar";
import { timeAgo } from "@/lib/time";
import { Trash2, Send } from "lucide-react";

interface CommentRow {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  profile: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
}

export function CommentsThread({
  targetId,
  targetType,
  onCountChange,
}: {
  targetId: string;
  targetType: "post" | "whisper";
  onCountChange?: (n: number) => void;
}) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("comments")
      .select("id, user_id, body, created_at")
      .eq("target_type", targetType)
      .eq("target_id", targetId)
      .order("created_at", { ascending: true });
    if (!data) {
      setComments([]);
      setLoading(false);
      return;
    }
    const ids = [...new Set(data.map((c) => c.user_id))];
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", ids);
    const map = new Map((profs ?? []).map((p) => [p.id, p]));
    const merged = data.map((c) => ({
      ...c,
      profile: (map.get(c.user_id) as CommentRow["profile"]) ?? null,
    }));
    setComments(merged);
    setLoading(false);
    onCountChange?.(merged.length);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, targetType]);

  const send = async () => {
    if (!user) return;
    const text = body.trim();
    if (!text) return;
    setPosting(true);
    const { data, error } = await supabase
      .from("comments")
      .insert({
        user_id: user.id,
        target_id: targetId,
        target_type: targetType,
        body: text,
      })
      .select()
      .single();
    setPosting(false);
    if (error || !data) return;
    setBody("");
    const newRow: CommentRow = {
      ...data,
      profile: profile
        ? {
            username: profile.username,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
          }
        : null,
    };
    setComments((p) => {
      const next = [...p, newRow];
      onCountChange?.(next.length);
      return next;
    });
  };

  const del = async (id: string) => {
    await supabase.from("comments").delete().eq("id", id);
    setComments((p) => {
      const next = p.filter((c) => c.id !== id);
      onCountChange?.(next.length);
      return next;
    });
  };

  return (
    <div className="border-t border-border bg-background/40">
      <div className="max-h-72 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="text-xs text-muted-foreground">Loading…</div>
        ) : comments.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">
            No comments yet.
          </div>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="flex gap-2.5 items-start">
              <Link
                to="/u/$username"
                params={{ username: c.profile?.username ?? "" }}
              >
                <Avatar profile={c.profile} size="xs" />
              </Link>
              <div className="flex-1 min-w-0">
                <div className="text-xs">
                  <Link
                    to="/u/$username"
                    params={{ username: c.profile?.username ?? "" }}
                    className="font-medium hover:text-burgundy"
                  >
                    {c.profile?.display_name ?? "—"}
                  </Link>{" "}
                  <span className="text-muted-foreground">
                    · {timeAgo(c.created_at)}
                  </span>
                </div>
                <p className="text-sm leading-relaxed mt-0.5 whitespace-pre-wrap break-words">
                  {c.body}
                </p>
              </div>
              {c.user_id === user?.id && (
                <button
                  onClick={() => del(c.id)}
                  className="text-muted-foreground hover:text-burgundy p-1"
                  aria-label="Delete comment"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
      <div className="p-3 border-t border-border flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          maxLength={500}
          placeholder="Add a comment…"
          className="flex-1 px-3 py-2 rounded-full bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
        <button
          onClick={send}
          disabled={posting || !body.trim()}
          className="w-9 h-9 rounded-full bg-burgundy text-burgundy-foreground flex items-center justify-center disabled:opacity-50 hover:opacity-90 transition-smooth"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
