import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Camera, Sparkles, MessageSquareText, MessagesSquare, ShieldCheck, GraduationCap } from "lucide-react";
import heroCampus from "@/assets/hero-campus.jpg";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "UniVerse — A social home for UWC students" },
      {
        name: "description",
        content:
          "UniVerse blends photos, moments, whispers and chat into one private social network exclusively for UWC students.",
      },
      { property: "og:title", content: "UniVerse — A social home for UWC students" },
      {
        property: "og:description",
        content: "Photos, moments, whispers and chat — built for the UWC community.",
      },
    ],
  }),
});

function Landing() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/feed" />;

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-gold-gradient flex items-center justify-center shadow-gold">
              <span className="font-serif text-primary text-xl">U</span>
            </div>
            <span className="font-serif text-2xl tracking-tight text-parchment">UniVerse</span>
          </div>
          <Link
            to="/auth"
            className="px-5 py-2 rounded-md bg-parchment/10 backdrop-blur border border-parchment/20 text-parchment text-sm font-medium hover:bg-parchment/20 transition-smooth"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroCampus}
            alt=""
            className="w-full h-full object-cover"
            width={1920}
            height={1080}
          />
          <div className="absolute inset-0 bg-hero opacity-85" />
          <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/40 to-transparent" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-6 py-32 grid lg:grid-cols-12 gap-12 items-center w-full">
          <div className="lg:col-span-7 text-parchment">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-parchment/10 backdrop-blur border border-gold/30 text-gold text-xs font-medium mb-6">
              <ShieldCheck className="w-3.5 h-3.5" />
              UWC students only · Verified by school email
            </div>
            <h1 className="font-serif text-5xl md:text-7xl leading-[1.05] text-balance">
              Your <em className="text-gold not-italic">universe</em>,
              <br />
              all in one place.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-parchment/80 max-w-xl leading-relaxed">
              UniVerse blends photos, fleeting moments, short whispers and private chat
              into one elegant social home — built exclusively for the UWC community.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                to="/auth"
                className="px-7 py-3.5 rounded-md bg-gold-gradient text-gold-foreground font-medium shadow-gold hover:opacity-95 transition-smooth"
              >
                Join UniVerse
              </Link>
              <a
                href="#features"
                className="px-7 py-3.5 rounded-md border border-parchment/30 text-parchment font-medium hover:bg-parchment/10 transition-smooth"
              >
                Explore features
              </a>
            </div>
          </div>

          <div className="lg:col-span-5 hidden lg:block">
            <div className="relative">
              <div className="absolute -top-8 -left-8 w-72 p-5 rounded-lg bg-card text-card-foreground shadow-elegant rotate-[-4deg]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-burgundy" />
                  <div>
                    <div className="font-medium text-sm">amelia.uwc</div>
                    <div className="text-xs text-muted-foreground italic">UWC Atlantic</div>
                  </div>
                </div>
                <div className="text-sm leading-relaxed">
                  Sunset over the cliffs again 🌅 still doesn't get old.
                </div>
              </div>
              <div className="absolute top-32 right-0 w-72 p-5 rounded-lg bg-burgundy text-burgundy-foreground shadow-elegant rotate-[3deg]">
                <div className="text-xs text-gold font-medium mb-2">MOMENT · 4h left</div>
                <div className="font-serif text-lg">Coffee study session at the library ☕📚</div>
              </div>
              <div className="absolute top-72 left-12 w-72 p-5 rounded-lg bg-parchment text-foreground shadow-elegant rotate-[-2deg]">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <MessagesSquare className="w-3.5 h-3.5" />
                  Direct message
                </div>
                <div className="text-sm">Are you free for the IB study group tonight?</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-parchment">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 text-gold text-xs font-medium uppercase tracking-widest mb-3">
              <GraduationCap className="w-4 h-4" /> Four worlds, one home
            </div>
            <h2 className="font-serif text-4xl md:text-5xl text-foreground">
              Everything you love about social,{" "}
              <em className="text-burgundy not-italic">refined</em>.
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              We took the best of four platforms and rebuilt them for the way UWC students
              actually share.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Camera,
                title: "Posts",
                desc: "Curated photo feed with likes and comments.",
                inspired: "Instagram",
              },
              {
                icon: Sparkles,
                title: "Moments",
                desc: "Disappearing 24-hour glimpses of your day.",
                inspired: "Snapchat",
              },
              {
                icon: MessageSquareText,
                title: "Whispers",
                desc: "Short, witty thoughts in 280 characters.",
                inspired: "Twitter / X",
              },
              {
                icon: MessagesSquare,
                title: "Messages",
                desc: "Private 1-to-1 chat with classmates.",
                inspired: "WhatsApp",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="p-6 rounded-lg bg-card border border-border shadow-card hover:shadow-elegant hover:-translate-y-1 transition-smooth"
              >
                <div className="w-12 h-12 rounded-md bg-hero flex items-center justify-center mb-4 shadow-elegant">
                  <f.icon className="w-5 h-5 text-gold" />
                </div>
                <h3 className="font-serif text-2xl">{f.title}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{f.desc}</p>
                <div className="mt-4 text-xs text-gold uppercase tracking-wider">
                  Inspired by {f.inspired}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-hero text-parchment">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-serif text-4xl md:text-5xl">
            Ready to join your <em className="text-gold not-italic">universe</em>?
          </h2>
          <p className="mt-5 text-lg text-parchment/80">
            Sign up with your UWC school email — that's the only key you need.
          </p>
          <Link
            to="/auth"
            className="inline-block mt-10 px-8 py-4 rounded-md bg-gold-gradient text-gold-foreground font-medium shadow-gold hover:opacity-95 transition-smooth"
          >
            Get started
          </Link>
        </div>
      </section>

      <footer className="py-8 bg-primary text-parchment/60 text-center text-sm">
        <p>UniVerse · Built for UWC students, by the community.</p>
      </footer>
    </div>
  );
}
