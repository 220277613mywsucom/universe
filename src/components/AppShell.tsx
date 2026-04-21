import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import {
  Home,
  Sparkles,
  MessageSquareText,
  MessagesSquare,
  User,
  LogOut,
  Search,
  Bookmark,
  ShieldAlert,
  MapPin,
  CalendarDays,
  CalendarHeart,
  Users,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/NotificationBell";
import { useState } from "react";

const primaryNav = [
  { to: "/feed" as const, label: "Feed", icon: Home },
  { to: "/moments" as const, label: "Moments", icon: Sparkles },
  { to: "/whispers" as const, label: "Whispers", icon: MessageSquareText },
  { to: "/messages" as const, label: "Messages", icon: MessagesSquare },
  { to: "/groups" as const, label: "Groups", icon: Users },
  { to: "/events" as const, label: "Events", icon: CalendarHeart },
];

const moreNav = [
  { to: "/search" as const, label: "Search", icon: Search },
  { to: "/calendar" as const, label: "Calendar", icon: CalendarDays },
  { to: "/bookmarks" as const, label: "Bookmarks", icon: Bookmark },
  { to: "/location" as const, label: "Location", icon: MapPin },
  { to: "/safety" as const, label: "Safety", icon: ShieldAlert },
];

const mobileNavItems = [
  { to: "/feed" as const, label: "Feed", icon: Home },
  { to: "/messages" as const, label: "Chat", icon: MessagesSquare },
  { to: "/groups" as const, label: "Groups", icon: Users },
  { to: "/events" as const, label: "Events", icon: CalendarHeart },
  { to: "/profile" as const, label: "Me", icon: User },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link to="/feed" className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 rounded-full bg-hero flex items-center justify-center shadow-elegant">
              <span className="font-serif text-gold text-lg">U</span>
            </div>
            <span className="font-serif text-xl tracking-tight hidden sm:inline">
              UniVerse
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {primaryNav.map((item) => {
              const active = location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-smooth flex items-center gap-2",
                    active
                      ? "bg-primary text-primary-foreground shadow-elegant"
                      : "hover:bg-accent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
            <div className="relative">
              <button
                onClick={() => setMoreOpen((m) => !m)}
                className="px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent flex items-center gap-2"
              >
                <Menu className="w-4 h-4" /> More
              </button>
              {moreOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-md shadow-elegant py-1 z-50">
                  {moreNav.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMoreOpen(false)}
                      className="px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden p-2 rounded-md hover:bg-accent text-muted-foreground"
              aria-label="Menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <NotificationBell />
            <Link
              to="/profile"
              className={cn(
                "hidden md:flex p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-burgundy transition-smooth",
                location.pathname.startsWith("/profile") && "text-burgundy",
              )}
              aria-label="Profile"
              title={profile ? `@${profile.username}` : "Profile"}
            >
              <User className="w-4 h-4" />
            </Link>
            <button
              onClick={handleSignOut}
              className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-burgundy transition-smooth"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 border-t border-border bg-card/95 backdrop-blur z-40">
        <div className="grid grid-cols-5">
          {mobileNavItems.map((item) => {
            const active = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center justify-center py-2.5 text-xs gap-1 transition-smooth",
                  active ? "text-burgundy" : "text-muted-foreground",
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Slide-in drawer (mobile / tablet) */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-primary/60 backdrop-blur lg:hidden"
          onClick={() => setDrawerOpen(false)}
        >
          <aside
            className="absolute right-0 top-0 bottom-0 w-72 bg-card shadow-elegant p-5 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <span className="font-serif text-lg">Menu</span>
              <button onClick={() => setDrawerOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="space-y-1">
              {[...primaryNav, ...moreNav].map((item) => {
                const active = location.pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setDrawerOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent text-foreground",
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}
