import { createFileRoute } from "@tanstack/react-router";
import { SITE } from "@/lib/seo";

/** robots.txt — يحجب الصفحات الحساسة ويشير للـ sitemap */
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        const body =
          `User-agent: *\n` +
          `Allow: /\n` +
          `Disallow: /admin\n` +
          `Disallow: /admin/\n` +
          `Disallow: /account\n` +
          `Disallow: /account/\n` +
          `Disallow: /api/\n` +
          `Disallow: /checkout\n` +
          `Disallow: /bag\n` +
          `Disallow: /login\n` +
          `Disallow: /unsubscribe\n` +
          `Disallow: /order-confirmation/\n` +
          `Disallow: /invoice/\n` +
          `Disallow: /debug/\n` +
          `Disallow: /*?*sort=\n` +
          `Disallow: /*?*filter=\n` +
          `\n` +
          `Sitemap: ${SITE.url}/sitemap.xml\n`;

        return new Response(body, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
