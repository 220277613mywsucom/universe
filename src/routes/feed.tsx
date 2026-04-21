import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { MomentsBar } from "@/components/MomentsBar";
import { CommentsThread } from "@/components/CommentsThread";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Heart,
  MessageCircle,
  ImagePlus,
  Loader2,
  MessageSquareText,
  Bookmark,
  Camera,
  Send,
  Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/time";
import { PostMenu } from "@/components/PostMenu";

export const Route = createFileRoute("/feed")({
  component: () => (
    <RequireAuth>
      <FeedPage />
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Feed — UniVerse" }] }),
});

type FeedKind = "post" | "whisper";

interface FeedItem {
  kind: FeedKind;
  id: string;
  user_id: string;
  created_at: string;
  image_url?: string | null;
  caption?: string | null;
  content?: string | null;
  profile: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  likes_count: number;
  liked_by_me: boolean;
  comments_count: number;
  bookmarked_by_me: boolean;
}

const PAGE = 10;

function FeedPage() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const beforeRef = useRef<string>(new Date().toISOString());

  const enrich = useCallback(
    async (rawPosts: any[], rawWhispers: any[]): Promise<FeedItem[]> => {
      const userIds = [
        ...new Set([
          ...rawPosts.map((p) => p.user_id),
          ...rawWhispers.map((w) => w.user_id),
        ]),
      ];
      const postIds = rawPosts.map((p) => p.id);
      const whisperIds = rawWhispers.map((w) => w.id);
      const allTargetIds = [...postIds, ...whisperIds];

      const [{ data: profs }, { data: likes }, { data: comments }, { data: bms }] =
        await Promise.all([
          userIds.length
            ? supabase
                .from("profiles")
                .select("id, username, display_name, avatar_url")
                .in("id", userIds)
            : Promise.resolve({ data: [] }),
          allTargetIds.length
            ? supabase
                .from("likes")
                .select("user_id, target_id, target_type")
                .in("target_id", allTargetIds)
            : Promise.resolve({ data: [] }),
          allTargetIds.length
            ? supabase
                .from("comments")
                .select("target_id, target_type")
                .in("target_id", allTargetIds)
            : Promise.resolve({ data: [] }),
          user && allTargetIds.length
            ? supabase
                .from("bookmarks")
                .select("target_id, target_type")
                .eq("user_id", user.id)
                .in("target_id", allTargetIds)
            : Promise.resolve({ data: [] }),
        ]);

      const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
      const likeMap = new Map<string, { count: number; liked: boolean }>();
      (likes ?? []).forEach((l: any) => {
        const key = `${l.target_type}:${l.target_id}`;
        const cur = likeMap.get(key) ?? { count: 0, liked: false };
        cur.count++;
        if (l.user_id === user?.id) cur.liked = true;
        likeMap.set(key, cur);
      });
      const commentMap = new Map<string, number>();
      (comments ?? []).forEach((c: any) => {
        const key = `${c.target_type}:${c.target_id}`;
        commentMap.set(key, (commentMap.get(key) ?? 0) + 1);
      });
      const bmSet = new Set(
        (bms ?? []).map((b: any) => `${b.target_type}:${b.target_id}`),
      );

      const make = (kind: FeedKind, r: any): FeedItem => {
        const key = `${kind}:${r.id}`;
        const lk = likeMap.get(key);
        return {
          kind,
          id: r.id,
          user_id: r.user_id,
          created_at: r.created_at,
          image_url: r.image_url ?? null,
          caption: r.caption ?? null,
          content: r.content ?? null,
          profile: (profMap.get(r.user_id) as FeedItem["profile"]) ?? null,
          likes_count: lk?.count ?? 0,
          liked_by_me: lk?.liked ?? false,
          comments_count: commentMap.get(key) ?? 0,
          bookmarked_by_me: bmSet.has(key),
        };
      };

      const merged: FeedItem[] = [
        ...rawPosts.map((p) => make("post", p)),
        ...rawWhispers.map((w) => make("whisper", w)),
      ];
      merged.sort((a, b) => b.created_at.localeCompare(a.created_at));
      return merged;
    },
    [user],
  );

  const loadPage = useCallback(
    async (initial: boolean) => {
      if (initial) {
        setLoading(true);
        beforeRef.current = new Date().toISOString();
      } else {
        setLoadingMore(true);
      }
      const before = beforeRef.current;
      const [{ data: rawPosts }, { data: rawWhispers }] = await Promise.all([
        supabase
          .from("posts")
          .select("id, user_id, image_url, caption, created_at")
          .lt("created_at", before)
          .order("created_at", { ascending: false })
          .limit(PAGE),
        supabase
          .from("whispers")
          .select("id, user_id, content, created_at")
          .lt("created_at", before)
          .order("created_at", { ascending: false })
          .limit(PAGE),
      ]);
      const merged = await enrich(rawPosts ?? [], rawWhispers ?? []);
      // Take top PAGE items; advance cursor to oldest of those
      const page = merged.slice(0, PAGE);
      if (page.length === 0) {
        setHasMore(false);
      } else {
        beforeRef.current = page[page.length - 1].created_at;
        // If both sources returned <PAGE rows, no more pages possible
        if ((rawPosts?.length ?? 0) < PAGE && (rawWhispers?.length ?? 0) < PAGE) {
          setHasMore(false);
        }
      }
      setItems((prev) => {
        if (initial) return page;
        const existing = new Set(prev.map((x) => `${x.kind}:${x.id}`));
        return [...prev, ...page.filter((x) => !existing.has(`${x.kind}:${x.id}`))];
      });
      if (initial) setLoading(false);
      else setLoadingMore(false);
    },
    [enrich],
  );

  useEffect(() => {
    setHasMore(true);
    loadPage(true);
  }, [user?.id, loadPage]);

  // Infinite scroll observer
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && !loading && hasMore) {
          loadPage(false);
        }
      },
      { rootMargin: "400px" },
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [loadPage, hasMore, loadingMore, loading]);

  const toggleLike = async (item: FeedItem) => {
    if (!user) return;
    setItems((prev) =>
      prev.map((x) =>
        x.id === item.id && x.kind === item.kind
          ? {
              ...x,
              liked_by_me: !x.liked_by_me,
              likes_count: x.likes_count + (x.liked_by_me ? -1 : 1),
            }
          : x,
      ),
    );
    if (item.liked_by_me) {
      await supabase
        .from("likes")
        .delete()
        .eq("user_id", user.id)
        .eq("target_type", item.kind)
        .eq("target_id", item.id);
    } else {
      await supabase
        .from("likes")
        .insert({ user_id: user.id, target_type: item.kind, target_id: item.id });
    }
  };

  const toggleBookmark = async (item: FeedItem) => {
    if (!user) return;
    setItems((prev) =>
      prev.map((x) =>
        x.id === item.id && x.kind === item.kind
          ? { ...x, bookmarked_by_me: !x.bookmarked_by_me }
          : x,
      ),
    );
    if (item.bookmarked_by_me) {
      await supabase
        .from("bookmarks")
        .delete()
        .eq("user_id", user.id)
        .eq("target_type", item.kind)
        .eq("target_id", item.id);
    } else {
      await supabase
        .from("bookmarks")
        .insert({ user_id: user.id, target_type: item.kind, target_id: item.id });
    }
  };

  const refreshAfterPost = () => {
    setHasMore(true);
    loadPage(true);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-8">
      <h1 className="font-serif text-3xl mb-4">Feed</h1>

      <MomentsBar />

      <FeedComposer profile={profile} onCreated={refreshAfterPost} />

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 italic font-serif text-lg">
          The library is quiet — be the first to share something.
        </div>
      ) : (
        <div className="space-y-6">
          {items.map((item) => (
            <FeedCard
              key={`${item.kind}:${item.id}`}
              item={item}
              onLike={() => toggleLike(item)}
              onBookmark={() => toggleBookmark(item)}
              commentsOpen={openComments === `${item.kind}:${item.id}`}
              onToggleComments={() =>
                setOpenComments((cur) =>
                  cur === `${item.kind}:${item.id}` ? null : `${item.kind}:${item.id}`,
                )
              }
              onDelete={
                item.user_id === user?.id
                  ? async () => {
                      if (!confirm("Delete this?")) return;
                      await supabase
                        .from(item.kind === "post" ? "posts" : "whispers")
                        .delete()
                        .eq("id", item.id);
                      setItems((p) =>
                        p.filter((x) => !(x.id === item.id && x.kind === item.kind)),
                      );
                    }
                  : undefined
              }
              onCommentCount={(n) =>
                setItems((p) =>
                  p.map((x) =>
                    x.id === item.id && x.kind === item.kind
                      ? { ...x, comments_count: n }
                      : x,
                  ),
                )
              }
            />
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="h-10" />
      {loadingMore && (
        <div className="text-center text-muted-foreground py-4 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading more…
        </div>
      )}
      {!hasMore && items.length > 0 && (
        <div className="text-center text-xs text-muted-foreground italic py-6">
          You've reached the end.
        </div>
      )}
    </div>
  );
}

function FeedComposer({
  profile,
  onCreated,
}: {
  profile: ReturnType<typeof useAuth>["profile"];
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const [tab, setTab] = useState<"post" | "whisper">("post");
  const [text, setText] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFileChosen = (f: File | null) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
    setPendingFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const reset = () => {
    setText("");
    setPendingFile(null);
    setPreviewUrl(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    try {
      if (tab === "post") {
        if (!pendingFile) return toast.error("Pick a photo");
        const ext = pendingFile.name.split(".").pop() || "jpg";
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("posts")
          .upload(path, pendingFile);
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("posts").getPublicUrl(path);
        const { error } = await supabase.from("posts").insert({
          user_id: user.id,
          image_url: data.publicUrl,
          caption: text.trim() || null,
        });
        if (error) throw error;
        toast.success("Post shared");
      } else {
        const t = text.trim();
        if (!t) return toast.error("Say something");
        if (t.length > 280) return toast.error("Whispers max 280 characters");
        const { error } = await supabase
          .from("whispers")
          .insert({ user_id: user.id, content: t });
        if (error) throw error;
        toast.success("Whisper shared");
      }
      reset();
      onCreated();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-card mb-6">
      <div className="flex gap-3">
        <Avatar profile={profile} size="md" />
        <div className="flex-1">
          <div className="flex gap-1 mb-2">
            <button
              onClick={() => setTab("post")}
              className={cn(
                "px-3 py-1 text-xs rounded-full font-medium transition-smooth flex items-center gap-1.5",
                tab === "post"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              <Camera className="w-3.5 h-3.5" /> Post
            </button>
            <button
              onClick={() => setTab("whisper")}
              className={cn(
                "px-3 py-1 text-xs rounded-full font-medium transition-smooth flex items-center gap-1.5",
                tab === "whisper"
                  ? "bg-burgundy text-burgundy-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              <MessageSquareText className="w-3.5 h-3.5" /> Whisper
            </button>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={tab === "whisper" ? 280 : 500}
            placeholder={
              tab === "post" ? "Caption your photo…" : "What's on your mind?"
            }
            className="w-full bg-transparent resize-none outline-none text-sm placeholder:text-muted-foreground min-h-[60px]"
          />
          {previewUrl && tab === "post" && (
            <div className="mt-2 relative">
              <img
                src={previewUrl}
                alt=""
                className="rounded-md max-h-80 object-cover w-full"
              />
              <button
                onClick={reset}
                className="absolute top-2 right-2 px-2 py-1 text-xs rounded bg-burgundy text-burgundy-foreground"
              >
                Remove
              </button>
            </div>
          )}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => onFileChosen(e.target.files?.[0] ?? null)}
            />
            {tab === "post" ? (
              <button
                onClick={() => fileRef.current?.click()}
                className="text-sm flex items-center gap-2 text-muted-foreground hover:text-burgundy transition-smooth"
              >
                <ImagePlus className="w-4 h-4" />
                {pendingFile ? "Change image" : "Add image"}
              </button>
            ) : (
              <span
                className={cn(
                  "text-xs",
                  text.length > 260 ? "text-burgundy" : "text-muted-foreground",
                )}
              >
                {text.length} / 280
              </span>
            )}
            <button
              onClick={submit}
              disabled={busy || (tab === "post" && !pendingFile) || (tab === "whisper" && !text.trim())}
              className={cn(
                "px-5 py-2 rounded-md text-sm font-medium shadow-elegant hover:opacity-95 transition-smooth disabled:opacity-50 inline-flex items-center gap-2",
                tab === "post"
                  ? "bg-primary text-primary-foreground"
                  : "bg-burgundy text-burgundy-foreground",
              )}
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Share
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeedCard({
  item,
  onLike,
  onBookmark,
  commentsOpen,
  onToggleComments,
  onDelete,
  onCommentCount,
}: {
  item: FeedItem;
  onLike: () => void;
  onBookmark: () => void;
  commentsOpen: boolean;
  onToggleComments: () => void;
  onDelete?: () => void;
  onCommentCount: (n: number) => void;
}) {
  const share = async () => {
    const url = `${window.location.origin}/u/${item.profile?.username ?? ""}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Profile link copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <article className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
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
            className="font-medium text-sm hover:text-burgundy transition-smooth"
          >
            {item.profile?.display_name ?? "Unknown"}
          </Link>
          <div className="text-xs text-muted-foreground">
            @{item.profile?.username} · {timeAgo(item.created_at)} ·{" "}
            <span
              className={cn(
                "uppercase tracking-wider",
                item.kind === "post" ? "text-primary" : "text-burgundy",
              )}
            >
              {item.kind === "post" ? "post" : "whisper"}
            </span>
          </div>
        </div>
        <PostMenu
          authorId={item.user_id}
          targetType={item.kind}
          targetId={item.id}
          shareUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/u/${item.profile?.username ?? ""}`}
          onDelete={onDelete}
        />
      </div>

      {item.kind === "post" && item.image_url && (
        <img
          src={item.image_url}
          alt={item.caption ?? ""}
          loading="lazy"
          className="w-full max-h-[600px] object-cover bg-muted"
        />
      )}
      {item.kind === "post" && item.caption && (
        <p className="px-4 pt-4 text-sm leading-relaxed">{item.caption}</p>
      )}
      {item.kind === "whisper" && item.content && (
        <p className="px-4 pt-2 pb-1 text-[15px] font-serif leading-relaxed whitespace-pre-wrap">
          {item.content}
        </p>
      )}

      <div className="px-4 py-3 flex items-center gap-5 text-sm text-muted-foreground">
        <button
          onClick={onLike}
          className={cn(
            "flex items-center gap-1.5 transition-smooth hover:text-burgundy",
            item.liked_by_me && "text-burgundy",
          )}
        >
          <Heart
            className={cn("w-4 h-4", item.liked_by_me && "fill-burgundy")}
          />
          {item.likes_count}
        </button>
        <button
          onClick={onToggleComments}
          className="flex items-center gap-1.5 hover:text-burgundy transition-smooth"
        >
          <MessageCircle className="w-4 h-4" />
          {item.comments_count}
        </button>
        <button
          onClick={share}
          className="flex items-center gap-1.5 hover:text-burgundy transition-smooth"
          aria-label="Share"
        >
          <Share2 className="w-4 h-4" />
        </button>
        <button
          onClick={onBookmark}
          className={cn(
            "ml-auto flex items-center transition-smooth hover:text-burgundy",
            item.bookmarked_by_me && "text-burgundy",
          )}
          aria-label="Bookmark"
        >
          <Bookmark
            className={cn("w-4 h-4", item.bookmarked_by_me && "fill-burgundy")}
          />
        </button>
      </div>

      {commentsOpen && (
        <CommentsThread
          targetId={item.id}
          targetType={item.kind}
          onCountChange={onCommentCount}
        />
      )}
    </article>
  );
}
