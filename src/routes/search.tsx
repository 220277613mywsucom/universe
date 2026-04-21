import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { FollowButton } from "@/components/FollowButton";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Search as SearchIcon, Sparkles, Camera, MessageSquareText } from "lucide-react";
import { timeAgo } from "@/lib/time";

export const Route = createFileRoute("/search")({
  component: () => (
    <RequireAuth>
      <SearchPage />
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Search & Discover — UniVerse" }] }),
});

interface PersonResult {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  uwc_school: string | null;
  bio: string | null;
}

interface PostResult {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
  profile: { username: string; display_name: string; avatar_url: string | null } | null;
}

interface WhisperResult {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile: { username: string; display_name: string; avatar_url: string | null } | null;
}

function SearchPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<PersonResult[]>([]);
  const [posts, setPosts] = useState<PostResult[]>([]);
  const [whispers, setWhispers] = useState<WhisperResult[]>([]);
  const [tab, setTab] = useState<"top" | "people" | "posts" | "whispers">("top");
  const [exploreLoaded, setExploreLoaded] = useState(false);

  // Discover feed when no query
  useEffect(() => {
    if (q.trim().length > 0) return;
    if (exploreLoaded) return;
    (async () => {
      const [{ data: peeps }, { data: ps }, { data: ws }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, uwc_school, bio")
          .neq("id", user?.id ?? "")
          .limit(12),
        supabase
          .from("posts")
          .select("id, user_id, image_url, caption, created_at")
          .order("created_at", { ascending: false })
          .limit(12),
        supabase
          .from("whispers")
          .select("id, user_id, content, created_at")
          .order("created_at", { ascending: false })
          .limit(8),
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
      setPeople((peeps ?? []) as PersonResult[]);
      setPosts(
        (ps ?? []).map((p) => ({
          ...p,
          profile: (profMap.get(p.user_id) as PostResult["profile"]) ?? null,
        })),
      );
      setWhispers(
        (ws ?? []).map((w) => ({
          ...w,
          profile: (profMap.get(w.user_id) as WhisperResult["profile"]) ?? null,
        })),
      );
      setExploreLoaded(true);
    })();
  }, [q, exploreLoaded, user?.id]);

  // Search
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    let cancelled = false;
    (async () => {
      const like = `%${term}%`;
      const [{ data: peeps }, { data: ps }, { data: ws }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, uwc_school, bio")
          .or(
            `username.ilike.${like},display_name.ilike.${like},bio.ilike.${like},uwc_school.ilike.${like}`,
          )
          .limit(20),
        supabase
          .from("posts")
          .select("id, user_id, image_url, caption, created_at")
          .ilike("caption", like)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("whispers")
          .select("id, user_id, content, created_at")
          .ilike("content", like)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      if (cancelled) return;
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
      setPeople((peeps ?? []) as PersonResult[]);
      setPosts(
        (ps ?? []).map((p) => ({
          ...p,
          profile: (profMap.get(p.user_id) as PostResult["profile"]) ?? null,
        })),
      );
      setWhispers(
        (ws ?? []).map((w) => ({
          ...w,
          profile: (profMap.get(w.user_id) as WhisperResult["profile"]) ?? null,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [q]);

  const showing = q.trim().length >= 2;

  const TopSection = useMemo(
    () => (
      <div className="space-y-8">
        {people.length > 0 && (
          <section>
            <h2 className="font-serif text-xl mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-gold" /> People
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {people.slice(0, 6).map((p) => (
                <PersonCard key={p.id} person={p} />
              ))}
            </div>
          </section>
        )}
        {posts.length > 0 && (
          <section>
            <h2 className="font-serif text-xl mb-3 flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" /> Posts
            </h2>
            <div className="grid grid-cols-3 gap-1.5">
              {posts.slice(0, 9).map((p) => (
                <Link
                  key={p.id}
                  to="/u/$username"
                  params={{ username: p.profile?.username ?? "" }}
                  className="aspect-square overflow-hidden rounded-md bg-muted shadow-card"
                >
                  <img
                    src={p.image_url}
                    alt={p.caption ?? ""}
                    loading="lazy"
                    className="w-full h-full object-cover hover:scale-105 transition-smooth"
                  />
                </Link>
              ))}
            </div>
          </section>
        )}
        {whispers.length > 0 && (
          <section>
            <h2 className="font-serif text-xl mb-3 flex items-center gap-2">
              <MessageSquareText className="w-4 h-4 text-burgundy" /> Whispers
            </h2>
            <div className="space-y-2">
              {whispers.slice(0, 5).map((w) => (
                <WhisperCard key={w.id} w={w} />
              ))}
            </div>
          </section>
        )}
      </div>
    ),
    [people, posts, whispers],
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-8">
      <h1 className="font-serif text-3xl mb-1 flex items-center gap-2">
        <SearchIcon className="w-6 h-6 text-burgundy" /> Search & Discover
      </h1>
      <p className="text-sm text-muted-foreground italic mb-5">
        Find classmates, posts, and whispers across UniVerse.
      </p>

      <div className="relative mb-6">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search people, posts, whispers, schools…"
          className="w-full pl-10 pr-4 py-3 rounded-md bg-card border border-border focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
      </div>

      {showing && (
        <div className="flex gap-1 border-b border-border mb-4 overflow-x-auto">
          {(["top", "people", "posts", "whispers"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 capitalize transition-smooth ${
                tab === t
                  ? "border-burgundy text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {!showing ? (
        TopSection
      ) : (
        <>
          {tab === "top" && TopSection}
          {tab === "people" && (
            <div className="grid sm:grid-cols-2 gap-3">
              {people.length === 0 ? (
                <div className="text-muted-foreground italic">No people found.</div>
              ) : (
                people.map((p) => <PersonCard key={p.id} person={p} />)
              )}
            </div>
          )}
          {tab === "posts" && (
            <div className="grid grid-cols-3 gap-1.5">
              {posts.length === 0 ? (
                <div className="col-span-3 text-muted-foreground italic">
                  No posts found.
                </div>
              ) : (
                posts.map((p) => (
                  <Link
                    key={p.id}
                    to="/u/$username"
                    params={{ username: p.profile?.username ?? "" }}
                    className="aspect-square overflow-hidden rounded-md bg-muted shadow-card"
                  >
                    <img
                      src={p.image_url}
                      alt={p.caption ?? ""}
                      loading="lazy"
                      className="w-full h-full object-cover hover:scale-105 transition-smooth"
                    />
                  </Link>
                ))
              )}
            </div>
          )}
          {tab === "whispers" && (
            <div className="space-y-2">
              {whispers.length === 0 ? (
                <div className="text-muted-foreground italic">
                  No whispers found.
                </div>
              ) : (
                whispers.map((w) => <WhisperCard key={w.id} w={w} />)
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PersonCard({ person }: { person: PersonResult }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-card flex items-center gap-3">
      <Link to="/u/$username" params={{ username: person.username }}>
        <Avatar profile={person} size="md" />
      </Link>
      <div className="flex-1 min-w-0">
        <Link
          to="/u/$username"
          params={{ username: person.username }}
          className="font-medium text-sm hover:text-burgundy block truncate"
        >
          {person.display_name}
        </Link>
        <div className="text-xs text-muted-foreground truncate">
          @{person.username}
          {person.uwc_school && ` · ${person.uwc_school}`}
        </div>
      </div>
      <FollowButton targetId={person.id} size="sm" />
    </div>
  );
}

function WhisperCard({ w }: { w: WhisperResult }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-card">
      <div className="flex items-center gap-2 text-xs">
        <Link to="/u/$username" params={{ username: w.profile?.username ?? "" }}>
          <Avatar profile={w.profile} size="xs" />
        </Link>
        <Link
          to="/u/$username"
          params={{ username: w.profile?.username ?? "" }}
          className="font-medium hover:text-burgundy"
        >
          {w.profile?.display_name ?? "—"}
        </Link>
        <span className="text-muted-foreground">· {timeAgo(w.created_at)}</span>
      </div>
      <p className="mt-1.5 text-[15px] leading-relaxed whitespace-pre-wrap">
        {w.content}
      </p>
    </div>
  );
}
