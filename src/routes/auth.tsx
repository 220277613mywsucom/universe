import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { checkUwcEmail, UWC_DOMAINS } from "@/lib/uwc-domains";
import { toast } from "sonner";
import { ShieldCheck, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in — UniVerse" },
      { name: "description", content: "Sign in or create your UniVerse account with your UWC school email." },
    ],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/feed" });
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const check = checkUwcEmail(email);
        if (!check.ok) {
          toast.error("UWC school email required", {
            description: check.domain
              ? `${check.domain} isn't a recognized UWC domain. Use your @uwc school email.`
              : "Please enter a valid UWC school email address.",
          });
          setBusy(false);
          return;
        }
        if (!displayName.trim()) {
          toast.error("Please enter your name");
          setBusy(false);
          return;
        }
        if (password.length < 6) {
          toast.error("Password must be at least 6 characters");
          setBusy(false);
          return;
        }

        const redirectUrl = `${window.location.origin}/feed`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              display_name: displayName.trim(),
              uwc_school: check.school,
            },
          },
        });
        if (error) {
          toast.error(error.message);
        } else {
          toast.success(`Welcome to UniVerse, ${check.school} student!`);
          navigate({ to: "/feed" });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Welcome back");
          navigate({ to: "/feed" });
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left: brand panel */}
      <div className="hidden lg:flex relative bg-hero text-parchment p-12 flex-col justify-between overflow-hidden">
        <Link to="/" className="flex items-center gap-2.5 relative z-10 w-fit">
          <div className="w-10 h-10 rounded-full bg-gold-gradient flex items-center justify-center shadow-gold">
            <span className="font-serif text-primary text-xl">U</span>
          </div>
          <span className="font-serif text-2xl">UniVerse</span>
        </Link>

        <div className="relative z-10">
          <h2 className="font-serif text-5xl leading-tight">
            A social home built for the <em className="text-gold not-italic">UWC</em> community.
          </h2>
          <p className="mt-6 text-parchment/80 text-lg max-w-md">
            Posts, moments, whispers and chat — all in one elegant place. Verified by your
            school email so you always know who you're talking to.
          </p>
          <div className="mt-10 flex items-center gap-3 text-sm text-parchment/70">
            <ShieldCheck className="w-5 h-5 text-gold" />
            {Object.keys(UWC_DOMAINS).length}+ UWC schools supported
          </div>
        </div>

        <div className="text-xs text-parchment/40 relative z-10">
          © UniVerse · For UWC students, by the community
        </div>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-smooth"
          >
            <ArrowLeft className="w-4 h-4" /> Back home
          </Link>

          <h1 className="font-serif text-4xl">
            {mode === "signup" ? "Join UniVerse" : "Welcome back"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {mode === "signup"
              ? "Use your UWC school email to verify your spot."
              : "Sign in to your UniVerse account."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <div>
                <label className="text-sm font-medium block mb-1.5">Your name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={60}
                  className="w-full px-4 py-3 rounded-md bg-card border border-border focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 transition-smooth"
                  placeholder="Amelia Hart"
                  required
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium block mb-1.5">UWC school email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-md bg-card border border-border focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 transition-smooth"
                placeholder="you@uwcad.it"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                className="w-full px-4 py-3 rounded-md bg-card border border-border focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 transition-smooth"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3.5 rounded-md bg-primary text-primary-foreground font-medium shadow-elegant hover:opacity-95 transition-smooth disabled:opacity-60"
            >
              {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>

          <button
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            className="mt-6 text-sm text-muted-foreground hover:text-burgundy transition-smooth"
          >
            {mode === "signup"
              ? "Already on UniVerse? Sign in"
              : "New here? Create your UniVerse account"}
          </button>

          {mode === "signup" && (
            <details className="mt-6 text-xs text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground">
                Which email domains are accepted?
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto p-3 bg-muted rounded-md">
                {Object.entries(UWC_DOMAINS).map(([d, name]) => (
                  <div key={d} className="flex justify-between py-0.5">
                    <span className="font-mono">@{d}</span>
                    <span className="italic">{name}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
