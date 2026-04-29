import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { AuthProvider } from "@/state/AuthContext";
import { WishlistProvider } from "@/state/WishlistContext";
import { BagProvider } from "@/state/BagContext";
import { AddressProvider } from "@/state/AddressContext";
import { Toaster } from "@/components/ui/sonner";
import { WishlistBanner } from "@/components/WishlistBanner";
import { DesktopHeader } from "@/components/DesktopHeader";
import { MobileBottomNav } from "@/components/mobile/MobileNav";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import { CookieBanner } from "@/components/CookieBanner";
import { useEffect } from "react";
import { startWebVitals } from "@/lib/perf";
import { GlobalErrorBoundary, OfflineBanner } from "@/components/ErrorDisplay";
import { flushErrorBuffer } from "@/lib/errors";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  // Note: i18n context isn't available at the route-not-found boundary,
  // so we render bilingually with Arabic primary (site default) and English fallback.
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="max-w-md text-center" dir="auto">
        <p className="text-[10.5px] tracking-[0.22em] text-gold-deep mb-3">MAISONNÉT</p>
        <h1 className="font-serif text-[88px] leading-none text-foreground">404</h1>
        <h2 className="mt-4 font-serif text-2xl text-foreground">الصفحة غير موجودة · Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground tracking-soft">
          الصفحة التي تبحث عنها غير متوفرة أو تم نقلها.
          <br />
          The page you are looking for is unavailable or has been moved.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-foreground px-8 h-12 text-xs tracking-[0.18em] font-medium text-background hover:opacity-90 transition shadow-soft"
          >
            العودة للرئيسية / Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-[100] focus:rounded-full focus:bg-foreground focus:text-background focus:px-5 focus:h-11 focus:inline-flex focus:items-center focus:tracking-soft focus:text-sm focus:shadow-elegant focus:outline-none focus:ring-2 focus:ring-gold/60"
    >
      تخطّي إلى المحتوى / Skip to content
    </a>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#F8F5EF" },
      { title: "Le Petit Paradis — أزياء الأطفال الفاخرة" },
      { name: "description", content: "بوتيك Le Petit Paradis: أزياء أطفال فاخرة مختارة بعناية — فساتين، أحذية، وهدايا للرضّع والبنات والأولاد. توصيل سريع وإرجاع مجاني." },
      { name: "author", content: "Le Petit Paradis" },
      { property: "og:site_name", content: "Le Petit Paradis" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  // Default to Arabic for SSR. Client-side LanguageProvider rehydrates html lang/dir
  // from localStorage on mount, so language switches persist without a flash.
  return (
    <html lang="ar" dir="rtl">
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
  useEffect(() => {
    startWebVitals();
    flushErrorBuffer().catch(() => { /* noop */ });
  }, []);
  return (
    <GlobalErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <WishlistProvider>
            <BagProvider>
              <AddressProvider>
                <SkipLink />
                <DesktopHeader />
                <AnalyticsTracker />
                <div id="main-content" tabIndex={-1}>
                  <Outlet />
                </div>
                <WishlistBanner />
                <WhatsAppButton />
                <MobileBottomNav />
                <CookieBanner />
                <OfflineBanner />
                <Toaster />
              </AddressProvider>
            </BagProvider>
          </WishlistProvider>
        </AuthProvider>
      </LanguageProvider>
    </GlobalErrorBoundary>
  );
}
