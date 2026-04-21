import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { UserPlus, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function FollowButton({
  targetId,
  className,
  size = "default",
}: {
  targetId: string;
  className?: string;
  size?: "default" | "sm";
}) {
  const { user } = useAuth();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.id === targetId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    supabase
      .from("follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", targetId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setFollowing(!!data);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user, targetId]);

  if (!user || user.id === targetId) return null;

  const toggle = async () => {
    if (loading) return;
    setLoading(true);
    if (following) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", targetId);
      setFollowing(false);
    } else {
      await supabase
        .from("follows")
        .insert({ follower_id: user.id, following_id: targetId });
      setFollowing(true);
    }
    setLoading(false);
  };

  const sizes =
    size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm";

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={cn(
        "rounded-full font-medium transition-smooth inline-flex items-center gap-1.5 disabled:opacity-60",
        sizes,
        following
          ? "bg-card border border-border text-foreground hover:bg-accent"
          : "bg-burgundy text-burgundy-foreground hover:opacity-95 shadow-elegant",
        className,
      )}
    >
      {following ? (
        <>
          <UserCheck className="w-3.5 h-3.5" /> Following
        </>
      ) : (
        <>
          <UserPlus className="w-3.5 h-3.5" /> Follow
        </>
      )}
    </button>
  );
}
