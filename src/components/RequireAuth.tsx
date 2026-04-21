import { Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "./AppShell";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="font-serif text-2xl text-muted-foreground animate-pulse">UniVerse</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" />;

  return <AppShell>{children}</AppShell>;
}
