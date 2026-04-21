import { Outlet, Link, createRootRoute, HeadContent, Scripts, useLocation } from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Toaster } from "@/components/ui/sonner";
import { PushToasts } from "@/components/PushToasts";
import { SosButton } from "@/components/SosButton";
import { UnifiedComposer } from "@/components/UnifiedComposer";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-serif text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-serif text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This corner of UniVerse doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-smooth hover:opacity-90 shadow-elegant"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "UniVerse — A social home for UWC students" },
      {
        name: "description",
        content:
          "UniVerse blends photos, moments, whispers and chat into one private social network exclusively for UWC students.",
      },
      { name: "author", content: "UniVerse" },
      { property: "og:title", content: "UniVerse — A social home for UWC students" },
      {
        property: "og:description",
        content: "Photos, moments, whispers and chat — built for the UWC community.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "UniVerse — A social home for UWC students" },
      { name: "description", content: "UniVerse UWC is a social media app for UWC students, blending major platforms into one unified experience." },
      { property: "og:description", content: "UniVerse UWC is a social media app for UWC students, blending major platforms into one unified experience." },
      { name: "twitter:description", content: "UniVerse UWC is a social media app for UWC students, blending major platforms into one unified experience." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f478de39-4b10-408a-a72a-7dbb17a75e2d/id-preview-f214d4bc--c2644f02-d047-482a-bbe8-68003c9f466e.lovable.app-1776780955153.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f478de39-4b10-408a-a72a-7dbb17a75e2d/id-preview-f214d4bc--c2644f02-d047-482a-bbe8-68003c9f466e.lovable.app-1776780955153.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function GlobalOverlays() {
  const { user } = useAuth();
  const location = useLocation();
  // hide on landing & auth pages
  if (!user) return null;
  if (location.pathname === "/" || location.pathname.startsWith("/auth")) return null;
  return (
    <>
      <PushToasts />
      <SosButton />
      <UnifiedComposer />
    </>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <Outlet />
      <GlobalOverlays />
      <Toaster />
    </AuthProvider>
  );
}
