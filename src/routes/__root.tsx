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
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4" dir="rtl">
      <div className="max-w-md text-center">
        <p className="text-[10.5px] tracking-[0.22em] text-gold-deep mb-3">MAISONNÉT</p>
        <h1 className="font-serif text-[88px] leading-none text-foreground">404</h1>
        <h2 className="mt-4 font-serif text-2xl text-foreground">الصفحة غير موجودة</h2>
        <p className="mt-2 text-sm text-muted-foreground tracking-soft">
          الصفحة التي تبحث عنها غير متوفرة أو تم نقلها.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-foreground px-8 h-12 text-xs tracking-[0.18em] font-medium text-background hover:opacity-90 transition shadow-soft"
          >
            العودة للرئيسية
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
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#F8F5EF" },
      { title: "Maisonnét — أزياء الأطفال الفاخرة" },
      { name: "description", content: "بوتيك Maisonnét: أزياء أطفال فاخرة مختارة بعناية — فساتين، أحذية، وهدايا للرضّع والبنات والأولاد. توصيل سريع وإرجاع مجاني." },
      { name: "author", content: "Maisonnét" },
      { property: "og:site_name", content: "Maisonnét" },
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
                <DesktopHeader />
                <AnalyticsTracker />
                <Outlet />
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
