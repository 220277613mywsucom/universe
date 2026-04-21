import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, Save, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/profile")({
  component: () => (
    <RequireAuth>
      <ProfilePage />
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Your profile — UniVerse" }] }),
});

function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({
    posts: 0,
    whispers: 0,
    moments: 0,
    followers: 0,
    following: 0,
  });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name);
      setBio(profile.bio ?? "");
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [p, w, m, fer, fing] = await Promise.all([
        supabase
          .from("posts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("whispers")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("moments")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gt("expires_at", new Date().toISOString()),
        supabase
          .from("follows")
          .select("id", { count: "exact", head: true })
          .eq("following_id", user.id),
        supabase
          .from("follows")
          .select("id", { count: "exact", head: true })
          .eq("follower_id", user.id),
      ]);
      setStats({
        posts: p.count ?? 0,
        whispers: w.count ?? 0,
        moments: m.count ?? 0,
        followers: fer.count ?? 0,
        following: fing.count ?? 0,
      });
    })();
  }, [user]);

  if (!profile || !user) return null;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim(), bio: bio.trim() || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
    refreshProfile();
  };

  const uploadAvatar = async (file: File) => {
    if (file.size > 3 * 1024 * 1024) return toast.error("Max 3MB");
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (upErr) return toast.error(upErr.message);
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: data.publicUrl })
      .eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Avatar updated");
    refreshProfile();
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-8">
      <h1 className="font-serif text-3xl mb-6">Your profile</h1>

      <div className="bg-card border border-border rounded-lg p-6 shadow-card">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar profile={profile} size="xl" ring />
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-burgundy text-burgundy-foreground flex items-center justify-center shadow-elegant hover:opacity-95"
              aria-label="Upload avatar"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadAvatar(f);
              }}
            />
          </div>
          <div className="flex-1">
            <div className="font-serif text-2xl">@{profile.username}</div>
            {profile.uwc_school && (
              <div className="text-sm text-muted-foreground italic">
                {profile.uwc_school}
              </div>
            )}
          </div>
          <Link
            to="/u/$username"
            params={{ username: profile.username }}
            className="text-xs text-muted-foreground hover:text-burgundy inline-flex items-center gap-1"
          >
            View public <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-5 gap-2 text-center">
          {[
            { l: "Posts", v: stats.posts },
            { l: "Whispers", v: stats.whispers },
            { l: "Moments", v: stats.moments },
            { l: "Followers", v: stats.followers },
            { l: "Following", v: stats.following },
          ].map((s) => (
            <div
              key={s.l}
              className="rounded-md bg-background border border-border p-3"
            >
              <div className="font-serif text-xl">{s.v}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {s.l}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Display name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={60}
              className="w-full px-4 py-2.5 rounded-md bg-background border border-border focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={200}
              rows={3}
              placeholder="Tell the community a little about yourself…"
              className="w-full px-4 py-2.5 rounded-md bg-background border border-border focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none"
            />
            <div className="text-xs text-muted-foreground mt-1">
              {bio.length}/200
            </div>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium shadow-elegant hover:opacity-95 transition-smooth disabled:opacity-50 inline-flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
