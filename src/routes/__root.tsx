import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { AuthProvider } from "@/state/AuthContext";
import { WishlistProvider } from "@/state/WishlistContext";
import { BagProvider } from "@/state/BagContext";
import { AddressProvider } from "@/state/AddressContext";
import { Toaster } from "@/components/ui/sonner";
import { WishlistBanner } from "@/components/WishlistBanner";
import { DesktopHeader } from "@/components/DesktopHeader";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import { CookieBanner } from "@/components/CookieBanner";
import { useEffect } from "react";
import { startWebVitals } from "@/lib/perf";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
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
      { title: "Lovable App" },
      { name: "description", content: "A luxury iOS e-commerce app for children's fashion, offering a premium boutique shopping experience." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Lovable App" },
      { property: "og:description", content: "A luxury iOS e-commerce app for children's fashion, offering a premium boutique shopping experience." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Lovable App" },
      { name: "twitter:description", content: "A luxury iOS e-commerce app for children's fashion, offering a premium boutique shopping experience." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/9708789b-05d2-4e6a-ae5d-1f6e1a2a3b88/id-preview-720de6ee--97838186-6ff6-4c3f-bed8-7b956a581306.lovable.app-1777316677450.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/9708789b-05d2-4e6a-ae5d-1f6e1a2a3b88/id-preview-720de6ee--97838186-6ff6-4c3f-bed8-7b956a581306.lovable.app-1777316677450.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
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

function RootComponent() {
  useEffect(() => { startWebVitals(); }, []);
  return (
    <LanguageProvider>
      <AuthProvider>
        <WishlistProvider>
          <BagProvider>
            <AddressProvider>
              <DesktopHeader />
              <AnalyticsTracker />
              <Outlet />
              <WishlistBanner />
              <WhatsAppButton />
              <CookieBanner />
              <Toaster />
            </AddressProvider>
          </BagProvider>
        </WishlistProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
