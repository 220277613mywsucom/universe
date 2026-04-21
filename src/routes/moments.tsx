import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, X, Sparkles } from "lucide-react";

export const Route = createFileRoute("/moments")({
  component: () => (
    <RequireAuth>
      <MomentsPage />
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Moments — UniVerse" }] }),
});

interface MomentRow {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  expires_at: string;
  profile: { username: string; display_name: string; avatar_url: string | null } | null;
}

function MomentsPage() {
  const { user, profile } = useAuth();
  const [moments, setMoments] = useState<MomentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("moments")
      .select("id, user_id, image_url, caption, expires_at")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    if (!data) {
      setMoments([]);
      setLoading(false);
      return;
    }
    const ids = [...new Set(data.map((m) => m.user_id))];
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", ids);
    const map = new Map((profs ?? []).map((p) => [p.id, p]));
    setMoments(
      data.map((m) => ({
        ...m,
        profile: (map.get(m.user_id) as MomentRow["profile"]) ?? null,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

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
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-gold" /> Moments
          </h1>
          <p className="text-sm text-muted-foreground italic mt-1">
            Fleeting glimpses — gone in 24 hours.
          </p>
        </div>
      </div>

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

      {/* Stories row */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex flex-col items-center gap-2 shrink-0"
        >
          <div className="w-20 h-20 rounded-full border-2 border-dashed border-gold flex items-center justify-center bg-card hover:bg-accent transition-smooth">
            <Plus className="w-7 h-7 text-gold" />
          </div>
          <span className="text-xs text-muted-foreground">
            {uploading ? "Uploading…" : "Your moment"}
          </span>
        </button>

        {loading ? (
          <div className="text-muted-foreground self-center px-4">Loading…</div>
        ) : (
          moments.map((m, idx) => (
            <button
              key={m.id}
              onClick={() => setViewerIdx(idx)}
              className="flex flex-col items-center gap-2 shrink-0"
            >
              <Avatar profile={m.profile} size="lg" ring />
              <span className="text-xs max-w-20 truncate">
                {m.profile?.display_name ?? "—"}
              </span>
            </button>
          ))
        )}
      </div>

      {!loading && moments.length === 0 && (
        <div className="mt-16 text-center font-serif text-lg italic text-muted-foreground">
          Quiet here. Share a moment to start the day.
        </div>
      )}

      {/* Viewer */}
      {viewerIdx !== null && moments[viewerIdx] && (
        <div
          className="fixed inset-0 z-50 bg-primary/95 backdrop-blur flex items-center justify-center p-4"
          onClick={() => setViewerIdx(null)}
        >
          <button
            onClick={() => setViewerIdx(null)}
            className="absolute top-4 right-4 p-2 text-parchment hover:text-gold"
          >
            <X className="w-6 h-6" />
          </button>
          <div
            className="max-w-md w-full bg-card rounded-lg overflow-hidden shadow-elegant"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 flex items-center gap-3 bg-card">
              <Avatar profile={moments[viewerIdx].profile} size="sm" />
              <div>
                <div className="font-medium text-sm">
                  {moments[viewerIdx].profile?.display_name}
                </div>
                <div className="text-xs text-muted-foreground">
                  expires {new Date(moments[viewerIdx].expires_at).toLocaleString()}
                </div>
              </div>
            </div>
            <img
              src={moments[viewerIdx].image_url}
              alt=""
              className="w-full max-h-[70vh] object-contain bg-primary"
            />
            {moments[viewerIdx].caption && (
              <div className="p-4 text-sm">{moments[viewerIdx].caption}</div>
            )}
            <div className="p-3 flex justify-between text-sm text-muted-foreground border-t border-border">
              <button
                onClick={() => setViewerIdx(viewerIdx > 0 ? viewerIdx - 1 : moments.length - 1)}
                className="hover:text-burgundy"
              >
                ← Prev
              </button>
              <button
                onClick={() => setViewerIdx((viewerIdx + 1) % moments.length)}
                className="hover:text-burgundy"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile reminder */}
      {profile && (
        <p className="mt-12 text-xs text-center text-muted-foreground">
          Posting as <span className="font-medium">@{profile.username}</span>
        </p>
      )}
    </div>
  );
}
