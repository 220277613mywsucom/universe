import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MapPin, Search, Play, Square, Clock } from "lucide-react";
import { timeAgo } from "@/lib/time";

export const Route = createFileRoute("/location")({
  component: () => (
    <RequireAuth>
      <LocationPage />
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Location — UniVerse" }] }),
});

interface ProfileLite {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

interface ShareRow {
  id: string;
  sharer_id: string;
  recipient_id: string;
  expires_at: string;
  active: boolean;
  created_at: string;
  profile: ProfileLite | null;
  lastPing?: { latitude: number; longitude: number; created_at: string } | null;
}

const DURATIONS = [
  { label: "30 min", min: 30 },
  { label: "1 hour", min: 60 },
  { label: "2 hours", min: 120 },
  { label: "4 hours", min: 240 },
];

function LocationPage() {
  const { user } = useAuth();
  const [outgoing, setOutgoing] = useState<ShareRow[]>([]);
  const [incoming, setIncoming] = useState<ShareRow[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ProfileLite[]>([]);
  const [duration, setDuration] = useState(60);
  const watchRef = useRef<number | null>(null);

  const load = async () => {
    if (!user) return;
    const now = new Date().toISOString();

    const { data: out } = await supabase
      .from("location_shares")
      .select("id, sharer_id, recipient_id, expires_at, active, created_at")
      .eq("sharer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    const { data: inc } = await supabase
      .from("location_shares")
      .select("id, sharer_id, recipient_id, expires_at, active, created_at")
      .eq("recipient_id", user.id)
      .gt("expires_at", now)
      .eq("active", true)
      .order("created_at", { ascending: false });

    const ids = [
      ...new Set([
        ...(out ?? []).map((s) => s.recipient_id),
        ...(inc ?? []).map((s) => s.sharer_id),
      ]),
    ];
    const { data: profs } = ids.length
      ? await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", ids)
      : { data: [] };
    const pm = new Map((profs ?? []).map((p) => [p.id, p as ProfileLite]));

    // pull latest ping per incoming sharer
    const sharerIds = [...new Set((inc ?? []).map((s) => s.sharer_id))];
    const pingsBySharer = new Map<string, { latitude: number; longitude: number; created_at: string }>();
    if (sharerIds.length) {
      const { data: pings } = await supabase
        .from("location_pings")
        .select("user_id, latitude, longitude, created_at")
        .in("user_id", sharerIds)
        .order("created_at", { ascending: false });
      (pings ?? []).forEach((p) => {
        if (!pingsBySharer.has(p.user_id))
          pingsBySharer.set(p.user_id, {
            latitude: p.latitude,
            longitude: p.longitude,
            created_at: p.created_at,
          });
      });
    }

    setOutgoing(
      (out ?? []).map((s) => ({
        ...s,
        profile: pm.get(s.recipient_id) ?? null,
      })),
    );
    setIncoming(
      (inc ?? []).map((s) => ({
        ...s,
        profile: pm.get(s.sharer_id) ?? null,
        lastPing: pingsBySharer.get(s.sharer_id) ?? null,
      })),
    );
  };

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel("location-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "location_shares" },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "location_pings" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // search
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) return setResults([]);
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .neq("id", user?.id ?? "")
        .limit(8);
      if (!cancel) setResults((data ?? []) as ProfileLite[]);
    })();
    return () => {
      cancel = true;
    };
  }, [search, user?.id]);

  // start/stop GPS watcher when there's any active outgoing share
  useEffect(() => {
    const now = Date.now();
    const hasActive = outgoing.some(
      (s) => s.active && new Date(s.expires_at).getTime() > now,
    );
    if (hasActive && watchRef.current === null && navigator.geolocation) {
      watchRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          if (!user) return;
          await supabase.from("location_pings").insert({
            user_id: user.id,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 30_000 },
      );
    }
    if (!hasActive && watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    return () => {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
    };
  }, [outgoing, user]);

  const startShare = async (p: ProfileLite) => {
    if (!user) return;
    const expiresAt = new Date(Date.now() + duration * 60_000).toISOString();
    const { error } = await supabase.from("location_shares").insert({
      sharer_id: user.id,
      recipient_id: p.id,
      expires_at: expiresAt,
      active: true,
    });
    if (error) return toast.error(error.message);

    // immediate first ping
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          await supabase.from("location_pings").insert({
            user_id: user.id,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        () => toast.error("Could not get your GPS — please enable location."),
        { enableHighAccuracy: true },
      );
    }
    toast.success(`Sharing location with ${p.display_name} for ${duration} min`);
    setSearch("");
    setResults([]);
    load();
  };

  const stopShare = async (id: string) => {
    await supabase.from("location_shares").update({ active: false }).eq("id", id);
    load();
  };

  const activeOutgoing = outgoing.filter(
    (s) => s.active && new Date(s.expires_at).getTime() > Date.now(),
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-32 md:pb-8">
      <div className="mb-6">
        <h1 className="font-serif text-3xl flex items-center gap-2">
          <MapPin className="w-7 h-7 text-burgundy" /> Live Location
        </h1>
        <p className="text-sm text-muted-foreground mt-1 italic">
          Share where you are with friends — auto-stops at expiry.
        </p>
      </div>

      {/* Start share */}
      <section className="bg-card border border-border rounded-lg shadow-card p-5 mb-6">
        <h2 className="font-serif text-xl mb-3">Share my location</h2>

        <div className="flex gap-2 mb-3 flex-wrap">
          {DURATIONS.map((d) => (
            <button
              key={d.min}
              onClick={() => setDuration(d.min)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-smooth ${
                duration === d.min
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent/40 text-muted-foreground hover:bg-accent"
              }`}
            >
              <Clock className="w-3 h-3 inline mr-1" />
              {d.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a friend to share with…"
            className="w-full pl-9 pr-3 py-2 rounded-md bg-background border border-border text-sm"
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-md shadow-elegant max-h-60 overflow-y-auto">
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => startShare(p)}
                  className="w-full px-3 py-2 flex items-center gap-3 hover:bg-accent text-left"
                >
                  <Avatar profile={p} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.display_name}</div>
                    <div className="text-xs text-muted-foreground truncate">@{p.username}</div>
                  </div>
                  <Play className="w-4 h-4 text-burgundy" />
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Active outgoing */}
      {activeOutgoing.length > 0 && (
        <section className="bg-card border border-border rounded-lg shadow-card p-5 mb-6">
          <h2 className="font-serif text-xl mb-3">You're sharing with…</h2>
          <div className="space-y-2">
            {activeOutgoing.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 p-3 bg-accent/20 rounded-md"
              >
                <Avatar profile={s.profile} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {s.profile?.display_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Until {new Date(s.expires_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <button
                  onClick={() => stopShare(s.id)}
                  className="text-xs px-3 py-1.5 rounded-md bg-burgundy text-burgundy-foreground inline-flex items-center gap-1"
                >
                  <Square className="w-3 h-3" /> Stop
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Incoming */}
      <section className="bg-card border border-border rounded-lg shadow-card p-5">
        <h2 className="font-serif text-xl mb-3">Friends sharing with you</h2>
        {incoming.length === 0 ? (
          <div className="text-sm text-muted-foreground italic text-center py-6">
            No active shares right now.
          </div>
        ) : (
          <div className="space-y-2">
            {incoming.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 p-3 bg-accent/20 rounded-md"
              >
                <Avatar profile={s.profile} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {s.profile?.display_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {s.lastPing
                      ? `Updated ${timeAgo(s.lastPing.created_at)}`
                      : "Waiting for first ping…"}
                  </div>
                </div>
                {s.lastPing && (
                  <a
                    href={`https://maps.google.com/?q=${s.lastPing.latitude},${s.lastPing.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground inline-flex items-center gap-1"
                  >
                    <MapPin className="w-3 h-3" /> Map
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
