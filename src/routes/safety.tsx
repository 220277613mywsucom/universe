import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldAlert, UserPlus, Trash2, Search, Phone, MapPin } from "lucide-react";
import { timeAgo } from "@/lib/time";

export const Route = createFileRoute("/safety")({
  component: () => (
    <RequireAuth>
      <SafetyPage />
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Safety — UniVerse" }] }),
});

interface ProfileLite {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

interface ContactRow {
  id: string;
  contact_id: string;
  profile: ProfileLite | null;
}

interface SosRow {
  id: string;
  user_id: string;
  latitude: number | null;
  longitude: number | null;
  message: string | null;
  resolved: boolean;
  created_at: string;
  profile: ProfileLite | null;
}

function SafetyPage() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ProfileLite[]>([]);
  const [incoming, setIncoming] = useState<SosRow[]>([]);
  const [outgoing, setOutgoing] = useState<SosRow[]>([]);

  const loadContacts = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("emergency_contacts")
      .select("id, contact_id")
      .eq("user_id", user.id);
    if (!data) return setContacts([]);
    const ids = data.map((c) => c.contact_id);
    const { data: profs } = ids.length
      ? await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", ids)
      : { data: [] };
    const map = new Map((profs ?? []).map((p) => [p.id, p as ProfileLite]));
    setContacts(
      data.map((c) => ({
        id: c.id,
        contact_id: c.contact_id,
        profile: map.get(c.contact_id) ?? null,
      })),
    );
  };

  const loadAlerts = async () => {
    if (!user) return;
    // alerts where I'm a contact (incoming)
    const { data: inAlerts } = await supabase
      .from("sos_alerts")
      .select("id, user_id, latitude, longitude, message, resolved, created_at")
      .neq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    // alerts I sent
    const { data: outAlerts } = await supabase
      .from("sos_alerts")
      .select("id, user_id, latitude, longitude, message, resolved, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    const allIds = [
      ...new Set([...(inAlerts ?? []).map((a) => a.user_id), ...(outAlerts ?? []).map((a) => a.user_id)]),
    ];
    const { data: profs } = allIds.length
      ? await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", allIds)
      : { data: [] };
    const pm = new Map((profs ?? []).map((p) => [p.id, p as ProfileLite]));
    setIncoming((inAlerts ?? []).map((a) => ({ ...a, profile: pm.get(a.user_id) ?? null })));
    setOutgoing((outAlerts ?? []).map((a) => ({ ...a, profile: pm.get(a.user_id) ?? null })));
  };

  useEffect(() => {
    loadContacts();
    loadAlerts();
    if (!user) return;
    const ch = supabase
      .channel("safety-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sos_alerts" },
        () => loadAlerts(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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

  const addContact = async (p: ProfileLite) => {
    if (!user) return;
    const { error } = await supabase
      .from("emergency_contacts")
      .insert({ user_id: user.id, contact_id: p.id });
    if (error && !error.message.includes("duplicate"))
      return toast.error(error.message);
    toast.success(`${p.display_name} added as emergency contact.`);
    setSearch("");
    setResults([]);
    loadContacts();
  };

  const removeContact = async (id: string) => {
    await supabase.from("emergency_contacts").delete().eq("id", id);
    loadContacts();
  };

  const resolveAlert = async (id: string) => {
    await supabase
      .from("sos_alerts")
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq("id", id);
    loadAlerts();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-32 md:pb-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl flex items-center gap-2">
          <ShieldAlert className="w-7 h-7 text-burgundy" /> Safety Center
        </h1>
        <p className="text-sm text-muted-foreground mt-1 italic">
          Set up trusted contacts, manage alerts, and stay safe on campus.
        </p>
      </div>

      {/* Active SOS — incoming */}
      {incoming.filter((a) => !a.resolved).length > 0 && (
        <div className="mb-6 bg-burgundy/10 border border-burgundy/40 rounded-lg p-4">
          <div className="font-medium text-burgundy mb-3 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" /> Active emergency alerts
          </div>
          <div className="space-y-2">
            {incoming
              .filter((a) => !a.resolved)
              .map((a) => (
                <div key={a.id} className="bg-card rounded-md p-3 flex items-center gap-3">
                  <Avatar profile={a.profile} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {a.profile?.display_name ?? "Someone"} needs help
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {timeAgo(a.created_at)} · {a.message ?? "Emergency"}
                    </div>
                  </div>
                  {a.latitude && a.longitude && (
                    <a
                      href={`https://maps.google.com/?q=${a.latitude},${a.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-md bg-burgundy text-burgundy-foreground text-xs font-medium inline-flex items-center gap-1"
                    >
                      <MapPin className="w-3 h-3" /> View on map
                    </a>
                  )}
                  {a.profile?.username && (
                    <Link
                      to="/messages"
                      search={{ to: a.user_id }}
                      className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium"
                    >
                      Message
                    </Link>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Emergency contacts */}
      <section className="bg-card border border-border rounded-lg shadow-card p-5 mb-6">
        <h2 className="font-serif text-xl mb-3">Emergency Contacts</h2>
        <p className="text-xs text-muted-foreground mb-4">
          These trusted students will get an instant alert with your GPS
          location when you press SOS.
        </p>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or @username…"
            className="w-full pl-9 pr-3 py-2 rounded-md bg-background border border-border text-sm"
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-md shadow-elegant max-h-60 overflow-y-auto">
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addContact(p)}
                  className="w-full px-3 py-2 flex items-center gap-3 hover:bg-accent text-left"
                >
                  <Avatar profile={p} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.display_name}</div>
                    <div className="text-xs text-muted-foreground truncate">@{p.username}</div>
                  </div>
                  <UserPlus className="w-4 h-4 text-burgundy" />
                </button>
              ))}
            </div>
          )}
        </div>

        {contacts.length === 0 ? (
          <div className="text-sm text-muted-foreground italic text-center py-6">
            No emergency contacts yet. Add at least one trusted friend.
          </div>
        ) : (
          <div className="space-y-2">
            {contacts.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 p-3 bg-accent/20 rounded-md"
              >
                <Avatar profile={c.profile} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {c.profile?.display_name ?? "Unknown"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    @{c.profile?.username}
                  </div>
                </div>
                <button
                  onClick={() => removeContact(c.id)}
                  className="text-muted-foreground hover:text-burgundy p-2"
                  aria-label="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quick-dial */}
      <section className="bg-card border border-border rounded-lg shadow-card p-5 mb-6">
        <h2 className="font-serif text-xl mb-3 flex items-center gap-2">
          <Phone className="w-5 h-5 text-burgundy" /> Emergency Numbers
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <a
            href="tel:10111"
            className="flex justify-between items-center p-3 bg-accent/30 rounded-md hover:bg-accent transition-smooth"
          >
            <span>SAPS Emergency</span>
            <span className="font-mono font-semibold">10111</span>
          </a>
          <a
            href="tel:10177"
            className="flex justify-between items-center p-3 bg-accent/30 rounded-md hover:bg-accent transition-smooth"
          >
            <span>Ambulance</span>
            <span className="font-mono font-semibold">10177</span>
          </a>
          <a
            href="tel:0219592301"
            className="flex justify-between items-center p-3 bg-accent/30 rounded-md hover:bg-accent transition-smooth"
          >
            <span>UWC Campus Protection</span>
            <span className="font-mono font-semibold">021 959 2301</span>
          </a>
          <a
            href="tel:0800428428"
            className="flex justify-between items-center p-3 bg-accent/30 rounded-md hover:bg-accent transition-smooth"
          >
            <span>GBV Command Centre</span>
            <span className="font-mono font-semibold">0800 428 428</span>
          </a>
        </div>
      </section>

      {/* My alerts history */}
      {outgoing.length > 0 && (
        <section className="bg-card border border-border rounded-lg shadow-card p-5">
          <h2 className="font-serif text-xl mb-3">Your alerts</h2>
          <div className="space-y-2">
            {outgoing.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between p-3 bg-accent/20 rounded-md"
              >
                <div>
                  <div className="text-sm">{a.message ?? "Emergency"}</div>
                  <div className="text-xs text-muted-foreground">
                    {timeAgo(a.created_at)} · {a.resolved ? "Resolved" : "Active"}
                  </div>
                </div>
                {!a.resolved && (
                  <button
                    onClick={() => resolveAlert(a.id)}
                    className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground"
                  >
                    Mark safe
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
