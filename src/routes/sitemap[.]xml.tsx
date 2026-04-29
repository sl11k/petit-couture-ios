import { createFileRoute } from "@tanstack/react-router";
import { categories } from "@/data/categories";
import { SITE } from "@/lib/seo";

/**
 * Sitemap.xml ديناميكي — كل الصفحات القابلة للفهرسة:
 * static + categories + products. (استثنِ admin/account/checkout/bag…)
 */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const today = new Date().toISOString().slice(0, 10);

        const staticPages = [
          { path: "/", changefreq: "daily", priority: 1.0 },
          { path: "/search", changefreq: "weekly", priority: 0.7 },
          { path: "/contact", changefreq: "monthly", priority: 0.5 },
          { path: "/help", changefreq: "monthly", priority: 0.5 },
          { path: "/privacy", changefreq: "yearly", priority: 0.3 },
          { path: "/track-order", changefreq: "monthly", priority: 0.4 },
        ];

        const categoryPages = categories.map((c) => ({
          path: `/category/${c.slug}`,
          changefreq: "weekly",
          priority: 0.8,
        }));

        const all = [...staticPages, ...categoryPages];

        const xml =
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          all
            .map(
              (u) =>
                `  <url>\n` +
                `    <loc>${SITE.url}${u.path}</loc>\n` +
                `    <lastmod>${today}</lastmod>\n` +
                `    <changefreq>${u.changefreq}</changefreq>\n` +
                `    <priority>${u.priority.toFixed(1)}</priority>\n` +
                `  </url>`,
            )
            .join("\n") +
          `\n</urlset>\n`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
