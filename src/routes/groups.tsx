import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, Plus, Send, Search, X } from "lucide-react";
import { timeAgo } from "@/lib/time";

export const Route = createFileRoute("/groups")({
  component: () => (
    <RequireAuth>
      <GroupsPage />
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Groups — UniVerse" }] }),
});

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  member_count: number;
}

interface GroupMsg {
  id: string;
  group_id: string;
  sender_id: string;
  body: string | null;
  created_at: string;
}

interface ProfileLite {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

function GroupsPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [msgs, setMsgs] = useState<GroupMsg[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileLite>>(new Map());
  const [body, setBody] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ProfileLite[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadGroups = async () => {
    if (!user) return;
    // memberships
    const { data: mem } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user.id);
    const ids = (mem ?? []).map((m) => m.group_id);
    if (ids.length === 0) return setGroups([]);
    const { data: gs } = await supabase
      .from("groups")
      .select("id, name, description, created_by, created_at")
      .in("id", ids)
      .order("created_at", { ascending: false });
    const { data: counts } = await supabase
      .from("group_members")
      .select("group_id")
      .in("group_id", ids);
    const cm = new Map<string, number>();
    (counts ?? []).forEach((r) => cm.set(r.group_id, (cm.get(r.group_id) ?? 0) + 1));
    setGroups(
      (gs ?? []).map((g) => ({ ...g, member_count: cm.get(g.id) ?? 1 })),
    );
  };

  const loadMsgs = async (gid: string) => {
    const { data } = await supabase
      .from("group_messages")
      .select("id, group_id, sender_id, body, created_at")
      .eq("group_id", gid)
      .order("created_at", { ascending: true })
      .limit(200);
    setMsgs((data ?? []) as GroupMsg[]);
    const senderIds = [...new Set((data ?? []).map((m) => m.sender_id))];
    const missing = senderIds.filter((id) => !profiles.has(id));
    if (missing.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", missing);
      setProfiles((prev) => {
        const next = new Map(prev);
        (profs ?? []).forEach((p) => next.set(p.id, p as ProfileLite));
        return next;
      });
    }
  };

  useEffect(() => {
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!activeId) return;
    loadMsgs(activeId);
    const ch = supabase
      .channel(`grp-${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "group_messages",
          filter: `group_id=eq.${activeId}`,
        },
        (payload) => {
          const m = payload.new as GroupMsg;
          setMsgs((p) => (p.some((x) => x.id === m.id) ? p : [...p, m]));
          if (!profiles.has(m.sender_id)) {
            supabase
              .from("profiles")
              .select("id, username, display_name, avatar_url")
              .eq("id", m.sender_id)
              .maybeSingle()
              .then(({ data }) => {
                if (data)
                  setProfiles((prev) =>
                    new Map(prev).set(data.id, data as ProfileLite),
                  );
              });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgs.length]);

  // people search for adding members
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

  const createGroup = async () => {
    if (!user) return;
    if (!name.trim()) return toast.error("Name required");
    const { data, error } = await supabase
      .from("groups")
      .insert({
        name: name.trim(),
        description: desc.trim() || null,
        created_by: user.id,
      })
      .select()
      .single();
    if (error || !data) return toast.error(error?.message ?? "Failed");
    // creator joins
    await supabase
      .from("group_members")
      .insert({ group_id: data.id, user_id: user.id, role: "admin" });
    toast.success("Group created");
    setName("");
    setDesc("");
    setShowCreate(false);
    setActiveId(data.id);
    loadGroups();
  };

  const addMember = async (p: ProfileLite) => {
    if (!activeId) return;
    const { error } = await supabase
      .from("group_members")
      .insert({ group_id: activeId, user_id: p.id });
    if (error && !error.message.includes("duplicate"))
      return toast.error(error.message);
    toast.success(`Added ${p.display_name}`);
    setSearch("");
    setResults([]);
    loadGroups();
  };

  const send = async () => {
    if (!user || !activeId) return;
    const t = body.trim();
    if (!t) return;
    const { data, error } = await supabase
      .from("group_messages")
      .insert({ group_id: activeId, sender_id: user.id, body: t })
      .select()
      .single();
    if (error) return toast.error(error.message);
    if (data) setMsgs((p) => (p.some((x) => x.id === data.id) ? p : [...p, data as GroupMsg]));
    setBody("");
  };

  const leaveGroup = async () => {
    if (!user || !activeId) return;
    if (!confirm("Leave this group?")) return;
    await supabase
      .from("group_members")
      .delete()
      .eq("group_id", activeId)
      .eq("user_id", user.id);
    setActiveId(null);
    loadGroups();
  };

  const activeGroup = useMemo(
    () => groups.find((g) => g.id === activeId) ?? null,
    [groups, activeId],
  );

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-4rem)] flex">
      {/* Sidebar */}
      <aside
        className={`${activeId ? "hidden md:flex" : "flex"} w-full md:w-80 border-r border-border bg-card/50 flex-col`}
      >
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h1 className="font-serif text-2xl flex items-center gap-2">
              <Users className="w-5 h-5 text-burgundy" /> Groups
            </h1>
            <button
              onClick={() => setShowCreate(true)}
              className="p-2 rounded-md bg-burgundy text-burgundy-foreground hover:opacity-90"
              aria-label="New group"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {groups.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground italic font-serif">
              No groups yet. Create one to start chatting.
            </div>
          ) : (
            groups.map((g) => (
              <button
                key={g.id}
                onClick={() => setActiveId(g.id)}
                className={`w-full px-4 py-3 flex items-center gap-3 text-left border-b border-border transition-smooth ${
                  activeId === g.id ? "bg-accent" : "hover:bg-accent/50"
                }`}
              >
                <div className="w-11 h-11 rounded-full bg-hero text-gold flex items-center justify-center font-serif">
                  {g.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{g.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {g.member_count} member{g.member_count !== 1 ? "s" : ""}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Chat */}
      <section
        className={`${activeId ? "flex" : "hidden md:flex"} flex-1 flex-col bg-background`}
      >
        {!activeGroup ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground italic font-serif text-lg">
            Select a group
          </div>
        ) : (
          <>
            <header className="p-4 border-b border-border bg-card/50 flex items-center gap-3">
              <button
                onClick={() => setActiveId(null)}
                className="md:hidden text-muted-foreground hover:text-burgundy text-sm"
              >
                ←
              </button>
              <div className="w-10 h-10 rounded-full bg-hero text-gold flex items-center justify-center font-serif">
                {activeGroup.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{activeGroup.name}</div>
                <div className="text-xs text-muted-foreground">
                  {activeGroup.member_count} members
                </div>
              </div>
              <button
                onClick={() => setShowAdd(true)}
                className="text-xs px-3 py-1.5 rounded-md bg-accent hover:bg-accent/70"
              >
                + Add
              </button>
              <button
                onClick={leaveGroup}
                className="text-xs px-3 py-1.5 rounded-md text-burgundy hover:bg-accent"
              >
                Leave
              </button>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-2">
              {msgs.map((m) => {
                const mine = m.sender_id === user?.id;
                const p = profiles.get(m.sender_id);
                return (
                  <div key={m.id} className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                    {!mine && <Avatar profile={p} size="xs" />}
                    <div
                      className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm leading-relaxed shadow-card ${
                        mine
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-card text-card-foreground rounded-bl-sm"
                      }`}
                    >
                      {!mine && (
                        <div className="text-xs text-burgundy font-medium mb-0.5">
                          {p?.display_name ?? "—"}
                        </div>
                      )}
                      <div className="whitespace-pre-wrap">{m.body}</div>
                      <div
                        className={`text-[10px] mt-1 ${mine ? "text-primary-foreground/60" : "text-muted-foreground"}`}
                      >
                        {timeAgo(m.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
              {msgs.length === 0 && (
                <div className="text-center text-sm text-muted-foreground italic mt-8">
                  Say hello to your group 👋
                </div>
              )}
            </div>

            <div className="p-3 border-t border-border bg-card/50 flex gap-2">
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Message the group…"
                className="flex-1 px-4 py-2.5 rounded-full bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
              <button
                onClick={send}
                disabled={!body.trim()}
                className="w-10 h-10 rounded-full bg-burgundy text-burgundy-foreground flex items-center justify-center disabled:opacity-50 hover:opacity-90 shadow-elegant"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </section>

      {/* Create group modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 bg-primary/70 backdrop-blur flex items-center justify-center p-4"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="bg-card border border-border rounded-lg shadow-elegant max-w-sm w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-serif text-xl">New group</h2>
              <button onClick={() => setShowCreate(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Group name"
              className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm mb-2"
            />
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              placeholder="Description (optional)"
              className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm resize-none mb-3"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-md text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={createGroup}
                className="px-4 py-2 rounded-md bg-burgundy text-burgundy-foreground text-sm shadow-elegant"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add member modal */}
      {showAdd && activeId && (
        <div
          className="fixed inset-0 z-50 bg-primary/70 backdrop-blur flex items-center justify-center p-4"
          onClick={() => setShowAdd(false)}
        >
          <div
            className="bg-card border border-border rounded-lg shadow-elegant max-w-sm w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-serif text-xl">Add member</h2>
              <button onClick={() => setShowAdd(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or @username…"
                className="w-full pl-9 pr-3 py-2 rounded-md bg-background border border-border text-sm"
              />
            </div>
            <div className="max-h-64 overflow-y-auto">
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addMember(p)}
                  className="w-full px-3 py-2 flex items-center gap-3 hover:bg-accent text-left rounded-md"
                >
                  <Avatar profile={p} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.display_name}</div>
                    <div className="text-xs text-muted-foreground truncate">@{p.username}</div>
                  </div>
                  <Plus className="w-4 h-4 text-burgundy" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
