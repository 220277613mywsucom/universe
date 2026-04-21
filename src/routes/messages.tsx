import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Search, MessagesSquare, Paperclip, X, ImageIcon } from "lucide-react";

export const Route = createFileRoute("/messages")({
  component: () => (
    <RequireAuth>
      <MessagesPage />
    </RequireAuth>
  ),
  validateSearch: (s: Record<string, unknown>) => ({
    to: typeof s.to === "string" ? s.to : undefined,
  }),
  head: () => ({ meta: [{ title: "Messages — UniVerse" }] }),
});

interface MsgRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  created_at: string;
  read: boolean;
}

interface ProfileLite {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

interface ConvoSummary {
  partner: ProfileLite;
  lastBody: string;
  lastAt: string;
  unread: number;
}

function MessagesPage() {
  const { user } = useAuth();
  const { to: deepLinkTo } = Route.useSearch();
  const [allMsgs, setAllMsgs] = useState<MsgRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileLite>>(new Map());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileLite[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!deepLinkTo || !user || deepLinkTo === user.id) return;
    setActiveId(deepLinkTo);
    if (!profiles.has(deepLinkTo)) {
      supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .eq("id", deepLinkTo)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setProfiles((prev) => new Map(prev).set(data.id, data as ProfileLite));
          }
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkTo, user?.id]);

  const loadMessages = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("messages")
      .select("id, sender_id, recipient_id, body, attachment_url, attachment_type, created_at, read")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: true });
    const msgs = (data ?? []) as MsgRow[];
    setAllMsgs(msgs);

    const partnerIds = new Set<string>();
    msgs.forEach((m) => {
      partnerIds.add(m.sender_id === user.id ? m.recipient_id : m.sender_id);
    });
    if (partnerIds.size > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", [...partnerIds]);
      setProfiles(new Map((profs ?? []).map((p) => [p.id, p as ProfileLite])));
    }
  };

  useEffect(() => {
    loadMessages();
    if (!user) return;
    const channel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as MsgRow;
          if (m.sender_id === user.id || m.recipient_id === user.id) {
            setAllMsgs((prev) =>
              prev.some((x) => x.id === m.id) ? prev : [...prev, m],
            );
            const partnerId = m.sender_id === user.id ? m.recipient_id : m.sender_id;
            if (!profiles.has(partnerId)) {
              supabase
                .from("profiles")
                .select("id, username, display_name, avatar_url")
                .eq("id", partnerId)
                .maybeSingle()
                .then(({ data }) => {
                  if (data) {
                    setProfiles((prev) => new Map(prev).set(data.id, data as ProfileLite));
                  }
                });
            }
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) return setSearchResults([]);
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .neq("id", user?.id ?? "")
        .limit(8);
      if (!cancelled) setSearchResults((data ?? []) as ProfileLite[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [search, user?.id]);

  const conversations = useMemo<ConvoSummary[]>(() => {
    if (!user) return [];
    const byPartner = new Map<string, MsgRow[]>();
    allMsgs.forEach((m) => {
      const pid = m.sender_id === user.id ? m.recipient_id : m.sender_id;
      const arr = byPartner.get(pid) ?? [];
      arr.push(m);
      byPartner.set(pid, arr);
    });
    const list: ConvoSummary[] = [];
    byPartner.forEach((msgs, pid) => {
      const profile = profiles.get(pid);
      if (!profile) return;
      const last = msgs[msgs.length - 1];
      const unread = msgs.filter((m) => m.recipient_id === user.id && !m.read).length;
      list.push({
        partner: profile,
        lastBody: last.body ?? (last.attachment_url ? "📎 attachment" : ""),
        lastAt: last.created_at,
        unread,
      });
    });
    return list.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  }, [allMsgs, profiles, user]);

  const activeMessages = useMemo(() => {
    if (!user || !activeId) return [];
    return allMsgs
      .filter(
        (m) =>
          (m.sender_id === user.id && m.recipient_id === activeId) ||
          (m.sender_id === activeId && m.recipient_id === user.id),
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [allMsgs, activeId, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    if (!user || !activeId) return;
    const unreadIds = allMsgs
      .filter((m) => m.sender_id === activeId && m.recipient_id === user.id && !m.read)
      .map((m) => m.id);
    if (unreadIds.length > 0) {
      supabase
        .from("messages")
        .update({ read: true })
        .in("id", unreadIds)
        .then(() => {
          setAllMsgs((p) =>
            p.map((m) => (unreadIds.includes(m.id) ? { ...m, read: true } : m)),
          );
        });
    }
  }, [activeId, activeMessages.length, user, allMsgs]);

  const choosePic = (f: File | null) => {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) return toast.error("Image must be under 8MB");
    setPendingFile(f);
    setPendingPreview(URL.createObjectURL(f));
  };

  const send = async () => {
    if (!user || !activeId) return;
    const text = body.trim();
    if (!text && !pendingFile) return;
    if (text.length > 2000) return toast.error("Too long");
    setSending(true);
    try {
      let attachmentUrl: string | null = null;
      let attachmentType: string | null = null;
      if (pendingFile) {
        const ext = pendingFile.name.split(".").pop() || "jpg";
        const path = `${user.id}/dm-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("messages")
          .upload(path, pendingFile);
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("messages").getPublicUrl(path);
        attachmentUrl = data.publicUrl;
        attachmentType = pendingFile.type || "image";
      }
      const { data, error } = await supabase
        .from("messages")
        .insert({
          sender_id: user.id,
          recipient_id: activeId,
          body: text || null,
          attachment_url: attachmentUrl,
          attachment_type: attachmentType,
        })
        .select()
        .single();
      if (error) throw error;
      if (data)
        setAllMsgs((p) => (p.some((x) => x.id === data.id) ? p : [...p, data as MsgRow]));
      setBody("");
      setPendingFile(null);
      setPendingPreview(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  const startConvo = (p: ProfileLite) => {
    if (!profiles.has(p.id)) {
      setProfiles((prev) => new Map(prev).set(p.id, p));
    }
    setActiveId(p.id);
    setSearch("");
    setSearchResults([]);
  };

  const activePartner = activeId ? profiles.get(activeId) : null;

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-4rem)] flex">
      <aside
        className={`${activeId ? "hidden md:flex" : "flex"} w-full md:w-80 border-r border-border bg-card/50 flex-col`}
      >
        <div className="p-4 border-b border-border">
          <h1 className="font-serif text-2xl flex items-center gap-2">
            <MessagesSquare className="w-5 h-5 text-burgundy" /> Messages
          </h1>
          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find someone…"
              className="w-full pl-9 pr-3 py-2 rounded-md bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {searchResults.length > 0 && (
            <div className="border-b border-border">
              <div className="px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">
                Start a conversation
              </div>
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => startConvo(p)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-accent transition-smooth text-left"
                >
                  <Avatar profile={p} size="sm" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.display_name}</div>
                    <div className="text-xs text-muted-foreground truncate">@{p.username}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {conversations.length === 0 && searchResults.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground italic font-serif">
              No conversations yet. Search for a friend to start chatting.
            </div>
          )}

          {conversations.map((c) => (
            <button
              key={c.partner.id}
              onClick={() => setActiveId(c.partner.id)}
              className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-smooth border-b border-border ${
                activeId === c.partner.id ? "bg-accent" : "hover:bg-accent/50"
              }`}
            >
              <Avatar profile={c.partner} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-sm truncate">{c.partner.display_name}</span>
                  {c.unread > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-burgundy text-burgundy-foreground">
                      {c.unread}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">{c.lastBody}</div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section
        className={`${activeId ? "flex" : "hidden md:flex"} flex-1 flex-col bg-background`}
      >
        {!activePartner ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground italic font-serif text-lg">
            Select a conversation
          </div>
        ) : (
          <>
            <header className="p-4 border-b border-border bg-card/50 flex items-center gap-3">
              <button
                onClick={() => setActiveId(null)}
                className="md:hidden text-muted-foreground hover:text-burgundy text-sm"
                aria-label="Back"
              >
                ←
              </button>
              <Avatar profile={activePartner} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{activePartner.display_name}</div>
                <div className="text-xs text-muted-foreground">@{activePartner.username}</div>
              </div>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-2">
              {activeMessages.map((m) => {
                const mine = m.sender_id === user?.id;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed shadow-card ${
                        mine
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-card text-card-foreground rounded-bl-sm"
                      }`}
                    >
                      {m.attachment_url && (
                        <a
                          href={m.attachment_url}
                          target="_blank"
                          rel="noreferrer"
                          className="block mb-1"
                        >
                          <img
                            src={m.attachment_url}
                            alt=""
                            className="rounded-lg max-h-72 object-cover"
                          />
                        </a>
                      )}
                      {m.body && (
                        <div className="whitespace-pre-wrap px-1">{m.body}</div>
                      )}
                      <div
                        className={`text-[10px] mt-1 px-1 ${mine ? "text-primary-foreground/60" : "text-muted-foreground"}`}
                      >
                        {new Date(m.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
              {activeMessages.length === 0 && (
                <div className="text-center text-sm text-muted-foreground italic mt-8">
                  Say hello 👋
                </div>
              )}
            </div>

            {pendingPreview && (
              <div className="px-3 pt-2 bg-card/30">
                <div className="relative inline-block">
                  <img
                    src={pendingPreview}
                    alt=""
                    className="h-24 rounded-md border border-border"
                  />
                  <button
                    onClick={() => {
                      setPendingFile(null);
                      setPendingPreview(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-burgundy text-burgundy-foreground flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            <div className="p-3 border-t border-border bg-card/50 flex gap-2 items-center">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => choosePic(e.target.files?.[0] ?? null)}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="p-2 text-muted-foreground hover:text-burgundy"
                aria-label="Attach"
                title="Attach image"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={pendingFile ? "Add a caption…" : "Write a message…"}
                className="flex-1 px-4 py-2.5 rounded-full bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
              <button
                onClick={send}
                disabled={sending || (!body.trim() && !pendingFile)}
                className="w-10 h-10 rounded-full bg-burgundy text-burgundy-foreground flex items-center justify-center disabled:opacity-50 hover:opacity-90 transition-smooth shadow-elegant"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
