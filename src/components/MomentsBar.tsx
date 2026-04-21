import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Avatar } from "./Avatar";
import { Plus, X, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { toast } from "sonner";

interface Moment {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  expires_at: string;
  created_at: string;
  profile: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
}

interface UserGroup {
  user_id: string;
  profile: Moment["profile"];
  moments: Moment[];
}

interface Viewer {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

export function MomentsBar() {
  const { user, profile } = useAuth();
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [viewer, setViewer] = useState<{ groupIdx: number; momentIdx: number } | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [showViewers, setShowViewers] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase
      .from("moments")
      .select("id, user_id, image_url, caption, expires_at, created_at")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    if (!data) return setGroups([]);

    const userIds = [...new Set(data.map((m) => m.user_id))];
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", userIds);
    const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
    const grouped = new Map<string, UserGroup>();
    data.forEach((m) => {
      const g = grouped.get(m.user_id) ?? {
        user_id: m.user_id,
        profile: (profMap.get(m.user_id) as Moment["profile"]) ?? null,
        moments: [],
      };
      g.moments.push({
        ...m,
        profile: (profMap.get(m.user_id) as Moment["profile"]) ?? null,
      });
      grouped.set(m.user_id, g);
    });
    const list = [...grouped.values()];
    list.sort((a, b) => {
      if (a.user_id === user?.id) return -1;
      if (b.user_id === user?.id) return 1;
      return b.moments[0].created_at.localeCompare(a.moments[0].created_at);
    });
    list.forEach((g) =>
      g.moments.sort((a, b) => a.created_at.localeCompare(b.created_at)),
    );
    setGroups(list);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleUpload = async (file: File) => {
    if (!user) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/moment-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("posts").upload(path, file);
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("posts").getPublicUrl(path);
      const caption = window.prompt("Add a caption (optional)") || null;
      const { error: insErr } = await supabase
        .from("moments")
        .insert({ user_id: user.id, image_url: data.publicUrl, caption });
      if (insErr) throw insErr;
      toast.success("Moment shared — visible for 24 hours");
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const myGroup = groups.find((g) => g.user_id === user?.id);
  const otherGroups = groups.filter((g) => g.user_id !== user?.id);

  const next = () => {
    if (!viewer) return;
    const g = groups[viewer.groupIdx];
    if (viewer.momentIdx + 1 < g.moments.length) {
      setViewer({ ...viewer, momentIdx: viewer.momentIdx + 1 });
    } else if (viewer.groupIdx + 1 < groups.length) {
      setViewer({ groupIdx: viewer.groupIdx + 1, momentIdx: 0 });
    } else {
      setViewer(null);
    }
  };
  const prev = () => {
    if (!viewer) return;
    if (viewer.momentIdx > 0)
      setViewer({ ...viewer, momentIdx: viewer.momentIdx - 1 });
    else if (viewer.groupIdx > 0) {
      const g = groups[viewer.groupIdx - 1];
      setViewer({ groupIdx: viewer.groupIdx - 1, momentIdx: g.moments.length - 1 });
    }
  };

  // auto-advance (paused while showing viewer list)
  useEffect(() => {
    if (!viewer || showViewers) return;
    const t = setTimeout(next, 5000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, showViewers]);

  const current = viewer ? groups[viewer.groupIdx]?.moments[viewer.momentIdx] : null;
  const isMine = current && current.user_id === user?.id;

  // record a view + load viewer list whenever current moment changes
  useEffect(() => {
    if (!current || !user) return;
    setShowViewers(false);
    if (current.user_id !== user.id) {
      // record I viewed it
      supabase
        .from("moment_views")
        .insert({ moment_id: current.id, viewer_id: user.id })
        .then(() => {});
    } else {
      // load viewers for owner
      (async () => {
        const { data } = await supabase
          .from("moment_views")
          .select("viewer_id, created_at")
          .eq("moment_id", current.id)
          .order("created_at", { ascending: false });
        if (!data) return setViewers([]);
        const ids = data.map((v) => v.viewer_id);
        const { data: profs } = ids.length
          ? await supabase
              .from("profiles")
              .select("id, username, display_name, avatar_url")
              .in("id", ids)
          : { data: [] };
        const pm = new Map((profs ?? []).map((p) => [p.id, p]));
        setViewers(
          data.map((v) => {
            const p = pm.get(v.viewer_id);
            return {
              id: v.viewer_id,
              username: p?.username ?? "—",
              display_name: p?.display_name ?? "—",
              avatar_url: p?.avatar_url ?? null,
              created_at: v.created_at,
            };
          }),
        );
      })();
    }
  }, [current?.id, user?.id]);

  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-card mb-6">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f);
        }}
      />

      <div className="flex gap-4 overflow-x-auto pb-1">
        <button
          onClick={() => {
            if (myGroup) setViewer({ groupIdx: groups.indexOf(myGroup), momentIdx: 0 });
            else fileRef.current?.click();
          }}
          disabled={uploading}
          className="flex flex-col items-center gap-1.5 shrink-0 group"
        >
          <div className="relative">
            <Avatar profile={profile} size="lg" ring={!!myGroup} />
            <div
              className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-burgundy text-burgundy-foreground flex items-center justify-center shadow-elegant border-2 border-card"
              onClick={(e) => {
                e.stopPropagation();
                fileRef.current?.click();
              }}
            >
              <Plus className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-xs text-muted-foreground max-w-16 truncate">
            {uploading ? "…" : "Your moment"}
          </span>
        </button>

        {otherGroups.map((g) => (
          <button
            key={g.user_id}
            onClick={() => setViewer({ groupIdx: groups.indexOf(g), momentIdx: 0 })}
            className="flex flex-col items-center gap-1.5 shrink-0"
          >
            <Avatar profile={g.profile} size="lg" ring />
            <span className="text-xs max-w-16 truncate">
              {g.profile?.username ? `@${g.profile.username}` : "—"}
            </span>
          </button>
        ))}

        {groups.length === 0 && (
          <div className="flex items-center text-sm text-muted-foreground italic font-serif px-2">
            Be the first to share a moment today.
          </div>
        )}
      </div>

      {viewer && current && (
        <div
          className="fixed inset-0 z-50 bg-primary/95 backdrop-blur flex items-center justify-center p-4"
          onClick={() => setViewer(null)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setViewer(null);
            }}
            className="absolute top-4 right-4 p-2 text-parchment hover:text-gold z-10"
          >
            <X className="w-6 h-6" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-parchment hover:text-gold z-10"
          >
            <ChevronLeft className="w-7 h-7" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-parchment hover:text-gold z-10"
          >
            <ChevronRight className="w-7 h-7" />
          </button>
          <div
            className="max-w-md w-full bg-card rounded-lg overflow-hidden shadow-elegant"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-1 p-2 bg-card">
              {groups[viewer.groupIdx].moments.map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-0.5 rounded-full ${
                    i < viewer.momentIdx
                      ? "bg-gold"
                      : i === viewer.momentIdx
                        ? "bg-gold/60"
                        : "bg-border"
                  }`}
                />
              ))}
            </div>
            <div className="px-3 pb-3 flex items-center gap-3">
              <Avatar profile={current.profile} size="sm" />
              <div className="flex-1">
                <div className="font-medium text-sm">{current.profile?.display_name}</div>
                <div className="text-xs text-muted-foreground">@{current.profile?.username}</div>
              </div>
            </div>
            <img
              src={current.image_url}
              alt=""
              className="w-full max-h-[60vh] object-contain bg-primary"
            />
            {current.caption && <div className="p-4 text-sm">{current.caption}</div>}

            {/* Owner-only viewer receipt */}
            {isMine && (
              <div className="border-t border-border">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowViewers((s) => !s);
                  }}
                  className="w-full px-4 py-3 flex items-center justify-between text-sm hover:bg-accent transition-smooth"
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Eye className="w-4 h-4" /> {viewers.length} view
                    {viewers.length !== 1 ? "s" : ""}
                  </span>
                  <span className="text-xs text-burgundy">
                    {showViewers ? "Hide" : "See who watched"}
                  </span>
                </button>
                {showViewers && (
                  <div className="max-h-48 overflow-y-auto border-t border-border">
                    {viewers.length === 0 ? (
                      <div className="p-4 text-xs text-muted-foreground italic text-center">
                        No views yet.
                      </div>
                    ) : (
                      viewers.map((v) => (
                        <div
                          key={v.id}
                          className="px-4 py-2 flex items-center gap-3 hover:bg-accent/40"
                        >
                          <Avatar profile={v} size="xs" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {v.display_name}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              @{v.username}
                            </div>
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {new Date(v.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
