import type { Profile } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface Props {
  profile: Pick<Profile, "username" | "display_name" | "avatar_url"> | null | undefined;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  ring?: boolean;
}

const sizeMap = {
  xs: "w-7 h-7 text-xs",
  sm: "w-9 h-9 text-sm",
  md: "w-11 h-11 text-base",
  lg: "w-14 h-14 text-lg",
  xl: "w-20 h-20 text-2xl",
};

export function Avatar({ profile, size = "md", className, ring }: Props) {
  const initials = (profile?.display_name || profile?.username || "?")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className={cn(
        "rounded-full overflow-hidden bg-hero text-gold font-serif flex items-center justify-center shrink-0",
        sizeMap[size],
        ring && "ring-2 ring-gold ring-offset-2 ring-offset-background",
        className,
      )}
    >
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
