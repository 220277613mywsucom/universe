import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

interface NotifPayload {
  id: string;
  user_id: string;
  actor_id: string;
  type: string;
  preview: string | null;
}

/**
 * Subscribes to the user's notifications table and shows toast + browser
 * notification (if permission granted) for each new event. Acts as our
 * lightweight "push" channel until full Web Push is wired up.
 */
export function PushToasts() {
  const { user } = useAuth();
  const askedRef = useRef(false);

  useEffect(() => {
    if (!user) return;

    // Politely request browser notification permission once
    if (
      !askedRef.current &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      askedRef.current = true;
      // Defer slightly so it doesn't fire on first paint
      setTimeout(() => {
        Notification.requestPermission().catch(() => {});
      }, 4000);
    }

    const channel = supabase
      .channel(`push-toasts-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const n = payload.new as NotifPayload;
          // fetch actor name
          const { data: actor } = await supabase
            .from("profiles")
            .select("display_name, username")
            .eq("id", n.actor_id)
            .maybeSingle();

          const name = actor?.display_name || actor?.username || "Someone";
          const text = textFor(n.type, name, n.preview);

          // SOS gets a destructive toast + sound (best effort)
          if (n.type === "sos") {
            toast.error(text, { duration: 15000 });
          } else if (n.type === "location_share") {
            toast.message(text, { duration: 8000 });
          } else {
            toast(text);
          }

          if (
            "Notification" in window &&
            Notification.permission === "granted" &&
            document.visibilityState !== "visible"
          ) {
            try {
              new Notification("UniVerse", {
                body: text,
                icon: "/favicon.ico",
                tag: n.id,
              });
            } catch {
              /* ignore */
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return null;
}

function textFor(type: string, name: string, preview: string | null) {
  switch (type) {
    case "like":
      return `${name} liked your post`;
    case "comment":
      return `${name} commented: ${preview ?? ""}`;
    case "follow":
      return `${name} started following you`;
    case "message":
      return `${name}: ${preview ?? ""}`;
    case "sos":
      return `🚨 ${name} sent an EMERGENCY ALERT`;
    case "location_share":
      return `📍 ${name} is sharing their location with you`;
    case "group_message":
      return `${name} (group): ${preview ?? ""}`;
    default:
      return `${name} sent you a notification`;
  }
}
