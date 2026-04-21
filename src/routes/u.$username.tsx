import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { FollowButton } from "@/components/FollowButton";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquareText, MessagesSquare, Edit3, Camera } from "lucide-react";
import { timeAgo } from "@/lib/time";

export const Route = createFileRoute("/u/$username")({
  component: () => (
    <RequireAuth>
      <UserProfile />
    </RequireAuth>
  ),
  head: ({ params }) => ({
    meta: [{ title: `@${params.username} — UniVerse` }],
  }),
});

interface ProfileFull {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  uwc_school: string | null;
}

interface PostThumb {
  id: string;
  image_url: string;
  caption: string | null;
}

interface WhisperItem {
  id: string;
  content: string;
  created_at: string;
}

function UserProfile() {
  const { username } = Route.useParams();
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileFull | null>(null);
  const [posts, setPosts] = useState<PostThumb[]>([]);
  const [whispers, setWhispers] = useState<WhisperItem[]>([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [tab, setTab] = useState<"posts" | "whispers">("posts");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio, uwc_school")
        .eq("username", username)
        .maybeSingle();
      if (cancelled) return;
      if (!prof) {
        setProfile(null);
        setLoading(false);
        return;
      }
      setProfile(prof as ProfileFull);
      const [{ data: ps }, { data: ws }, fc, fg] = await Promise.all([
        supabase
          .from("posts")
          .select("id, image_url, caption")
          .eq("user_id", prof.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("whispers")
          .select("id, content, created_at")
          .eq("user_id", prof.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("follows")
          .select("id", { count: "exact", head: true })
          .eq("following_id", prof.id),
        supabase
          .from("follows")
          .select("id", { count: "exact", head: true })
          .eq("follower_id", prof.id),
      ]);
      if (cancelled) return;
      setPosts((ps ?? []) as PostThumb[]);
      setWhispers((ws ?? []) as WhisperItem[]);
      setFollowers(fc.count ?? 0);
      setFollowing(fg.count ?? 0);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [username]);

  if (loading) {
    return <div className="text-center text-muted-foreground py-20">Loading…</div>;
  }
  if (!profile) {
    return (
      <div className="text-center font-serif text-2xl text-muted-foreground py-20">
        No one here by that name.
      </div>
    );
  }

  const isMe = me?.id === profile.id;

  const startDM = () => {
    navigate({ to: "/messages", search: { to: profile.id } as never });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-8">
      <header className="flex flex-col sm:flex-row gap-6 items-start sm:items-end">
        <Avatar profile={profile} size="xl" ring />
        <div className="flex-1">
          <h1 className="font-serif text-3xl">{profile.display_name}</h1>
          <div className="text-muted-foreground">@{profile.username}</div>
          {profile.uwc_school && (
            <div className="mt-1 text-sm text-burgundy italic">{profile.uwc_school}</div>
          )}
          <div className="mt-3 flex gap-5 text-sm">
            <div>
              <span className="font-medium">{posts.length}</span>{" "}
              <span className="text-muted-foreground">posts</span>
            </div>
            <div>
              <span className="font-medium">{followers}</span>{" "}
              <span className="text-muted-foreground">followers</span>
            </div>
            <div>
              <span className="font-medium">{following}</span>{" "}
              <span className="text-muted-foreground">following</span>
            </div>
          </div>
          {profile.bio && (
            <p className="mt-3 text-sm leading-relaxed max-w-md">{profile.bio}</p>
          )}
        </div>
        <div className="flex gap-2">
          {isMe ? (
            <Link
              to="/profile"
              className="px-4 py-2 rounded-md bg-card border border-border text-sm hover:bg-accent transition-smooth inline-flex items-center gap-2"
            >
              <Edit3 className="w-4 h-4" />
              Edit
            </Link>
          ) : (
            <>
              <FollowButton targetId={profile.id} />
              <button
                onClick={startDM}
                className="px-4 py-2 rounded-md bg-burgundy text-burgundy-foreground text-sm shadow-elegant hover:opacity-95 transition-smooth inline-flex items-center gap-2"
              >
                <MessagesSquare className="w-4 h-4" />
                Message
              </button>
            </>
          )}
        </div>
      </header>

      <div className="mt-8 border-b border-border flex gap-6">
        <button
          onClick={() => setTab("posts")}
          className={`pb-3 text-sm font-medium transition-smooth border-b-2 inline-flex items-center gap-2 ${tab === "posts" ? "border-burgundy text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <Camera className="w-4 h-4" /> Posts ({posts.length})
        </button>
        <button
          onClick={() => setTab("whispers")}
          className={`pb-3 text-sm font-medium transition-smooth border-b-2 inline-flex items-center gap-2 ${tab === "whispers" ? "border-burgundy text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <MessageSquareText className="w-4 h-4" /> Whispers ({whispers.length})
        </button>
      </div>

      <div className="mt-6">
        {tab === "posts" ? (
          posts.length === 0 ? (
            <div className="text-center font-serif italic text-muted-foreground py-16">
              No posts yet.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {posts.map((p) => (
                <div
                  key={p.id}
                  className="aspect-square overflow-hidden rounded-md bg-muted shadow-card"
                >
                  <img
                    src={p.image_url}
                    alt={p.caption ?? ""}
                    loading="lazy"
                    className="w-full h-full object-cover hover:scale-105 transition-smooth"
                  />
                </div>
              ))}
            </div>
          )
        ) : whispers.length === 0 ? (
          <div className="text-center font-serif italic text-muted-foreground py-16">
            No whispers yet.
          </div>
        ) : (
          <div className="space-y-3">
            {whispers.map((w) => (
              <div
                key={w.id}
                className="p-4 bg-card border border-border rounded-lg shadow-card"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <MessageSquareText className="w-3.5 h-3.5" />
                  {timeAgo(w.created_at)}
                </div>
                <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{w.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
