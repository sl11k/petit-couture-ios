import { Outlet, Link, createRootRoute, HeadContent, Scripts, useRouterState } from "@tanstack/react-router";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { AuthProvider } from "@/state/AuthContext";
import { WishlistProvider } from "@/state/WishlistContext";
import { BagProvider } from "@/state/BagContext";
import { AddressProvider } from "@/state/AddressContext";
import { CurrencyProvider } from "@/state/CurrencyContext";
import { Toaster } from "@/components/ui/sonner";
import { WishlistBanner } from "@/components/WishlistBanner";
import { DesktopHeader } from "@/components/DesktopHeader";
import { MobileBottomNav } from "@/components/mobile/MobileNav";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import { CookieBanner } from "@/components/CookieBanner";
import { Footer } from "@/components/Footer";
import { TranslateScope } from "@/i18n/TranslateScope";
import { useLanguage } from "@/i18n/LanguageContext";
import { useEffect } from "react";
import { startWebVitals } from "@/lib/perf";
import { GlobalErrorBoundary, OfflineBanner } from "@/components/ErrorDisplay";
import { flushErrorBuffer } from "@/lib/errors";
import { checkAdminOutlets } from "@/dev/checkAdminOutlets";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LiveEditProvider } from "@/live-edit/LiveEditContext";
import { InlineQuickEditProvider } from "@/live-edit/InlineQuickEdit";
import { useCustomCss } from "@/hooks/useCustomCss";

import appCss from "../styles.css?url";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

// Dev-only: warn about /admin parent routes missing <Outlet />.
if (import.meta.env.DEV) checkAdminOutlets();


function NotFoundComponent() {
  // Note: i18n context isn't available at the route-not-found boundary,
  // so we render bilingually with Arabic primary (site default) and English fallback.
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="max-w-md text-center" dir="auto">
        <p className="text-[10.5px] tracking-[0.22em] text-gold-deep mb-3">LE PETIT PARADIS</p>
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
            className="inline-flex items-center justify-center rounded-xl bg-foreground px-8 h-12 text-xs tracking-[0.18em] font-medium text-background hover:opacity-90 transition shadow-soft"
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
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-[100] focus:rounded-xl focus:bg-foreground focus:text-background focus:px-5 focus:h-11 focus:inline-flex focus:items-center focus:tracking-soft focus:text-sm focus:shadow-elegant focus:outline-none focus:ring-2 focus:ring-gold/60"
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
      { rel: "icon", href: "/favicon.ico" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Le Petit Paradis — أزياء الأطفال الفاخرة" },
      { name: "twitter:title", content: "Le Petit Paradis — أزياء الأطفال الفاخرة" },
      { property: "og:description", content: "بوتيك Le Petit Paradis: أزياء أطفال فاخرة مختارة بعناية — فساتين، أحذية، وهدايا للرضّع والبنات والأولاد. توصيل سريع وإرجاع مجاني." },
      { name: "twitter:description", content: "بوتيك Le Petit Paradis: أزياء أطفال فاخرة مختارة بعناية — فساتين، أحذية، وهدايا للرضّع والبنات والأولاد. توصيل سريع وإرجاع مجاني." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f6e8661e-ba3d-47a5-9107-e53a9bcff783/id-preview-15119ac1--13365939-5efa-4765-9cfc-35d137638f66.lovable.app-1778942541281.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f6e8661e-ba3d-47a5-9107-e53a9bcff783/id-preview-15119ac1--13365939-5efa-4765-9cfc-35d137638f66.lovable.app-1778942541281.png" },
      { name: "google-site-verification", content: "VlzVDbZFLTDQ_yVwf8NIbUAtfW4QjVcXhzzaMIc_IRc" },
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = pathname.startsWith("/admin");
  const isAuth = pathname.startsWith("/login");
  const isMachine =
    pathname.startsWith("/sitemap") || pathname.startsWith("/robots") || pathname.startsWith("/debug");

  // Footer renders on storefront and admin pages alike, hidden only on focused flows
  // (auth, checkout, invoice) and machine routes (sitemap/robots/debug).
  const hideFooter =
    isAuth || pathname.startsWith("/checkout") || pathname.startsWith("/invoice") || isMachine;

  // Storefront chrome (top bar, mobile nav, floating widgets) is for the store experience only.
  // Admin and auth use their own self-contained layouts.
  const showStoreChrome = !isAdmin && !isAuth && !isMachine;

  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <CurrencyProvider>
            <AuthProvider>
              <WishlistProvider>
                <BagProvider>
                  <AddressProvider>
                    <LiveEditProvider>
                      <InlineQuickEditProvider>
                        <StorefrontShell
                          showStoreChrome={showStoreChrome}
                          hideFooter={hideFooter}
                          isAdmin={isAdmin}
                        />
                      </InlineQuickEditProvider>
                    </LiveEditProvider>
                  </AddressProvider>
                </BagProvider>
              </WishlistProvider>
            </AuthProvider>
          </CurrencyProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}

function StorefrontShell({
  showStoreChrome,
  hideFooter,
  isAdmin,
}: {
  showStoreChrome: boolean;
  hideFooter: boolean;
  isAdmin: boolean;
}) {
  const { lang } = useLanguage();
  useCustomCss();
  // Admin pages have their own AdminTranslateScope inside AdminShell.
  // Wrap storefront only — translates Arabic → English (or vice versa) at runtime
  // using the bulk dictionary in src/i18n/adminDict.ts.
  const wrapped = (
    <div className="storefront-shell">
      <SkipLink />
      {showStoreChrome && <DesktopHeader />}
      <AnalyticsTracker />
      <div id="main-content" tabIndex={-1}>
        <Outlet />
      </div>
      {!hideFooter && <Footer />}
      {showStoreChrome && (
        <>
          <WishlistBanner />
          <WhatsAppButton />
          <MobileBottomNav />
          <CookieBanner />
        </>
      )}
      <OfflineBanner />
      <Toaster />
    </div>
  );

  if (isAdmin || lang === "ar") return wrapped;
  return (
    <TranslateScope enabled toLang={lang} scopeKey={lang}>
      {wrapped}
    </TranslateScope>
  );
}
