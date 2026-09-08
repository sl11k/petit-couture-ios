import { createFileRoute } from "@tanstack/react-router";
import { SITE } from "@/lib/seo";

type Entry = { path: string; changefreq: string; priority: number };

/**
 * Sitemap.xml ديناميكي — الصفحات الثابتة + الأقسام والمنتجات والصفحات المنشورة
 * من قاعدة البيانات. (نستثني admin/account/checkout/bag/login…)
 */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const staticPages: Entry[] = [
          { path: "/", changefreq: "daily", priority: 1.0 },
          { path: "/search", changefreq: "weekly", priority: 0.7 },
          { path: "/our-story", changefreq: "monthly", priority: 0.6 },
          { path: "/shipping", changefreq: "monthly", priority: 0.5 },
          { path: "/contact", changefreq: "monthly", priority: 0.5 },
          { path: "/help", changefreq: "monthly", priority: 0.5 },
          { path: "/privacy", changefreq: "yearly", priority: 0.3 },
          { path: "/track-order", changefreq: "monthly", priority: 0.4 },
        ];

        const dynamic: Entry[] = [];

        try {
          const { createClient } = await import("@supabase/supabase-js");
          const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
          const key =
            process.env["SUPABASE_PUBLISHABLE_KEY"] ??
            process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
          if (url && key) {
            const supabase = createClient(url, key, {
              auth: { persistSession: false, autoRefreshToken: false },
              global: {
                fetch: (input: RequestInfo | URL, init?: RequestInit) => {
                  const headers = new Headers(init?.headers);
                  if (key.startsWith("sb_") && headers.get("Authorization") === "Bearer " + key) {
                    headers.delete("Authorization");
                  }
                  headers.set("apikey", key);
                  return fetch(input, { ...init, headers });
                },
              },
            });

            const pageSize = 1000;

            // Categories
            for (let offset = 0; ; ) {
              const { data, error } = await supabase
                .from("categories")
                .select("slug")
                .eq("is_active", true)
                .order("id")
                .range(offset, offset + pageSize - 1);
              if (error) throw error;
              if (!data || data.length === 0) break;
              for (const row of data as { slug: string | null }[]) {
                if (row.slug)
                  dynamic.push({
                    path: `/category/${encodeURIComponent(row.slug)}`,
                    changefreq: "weekly",
                    priority: 0.8,
                  });
              }
              offset += data.length;
            }

            // Products
            for (let offset = 0; ; ) {
              const { data, error } = await supabase
                .from("products")
                .select("slug")
                .eq("is_active", true)
                .order("id")
                .range(offset, offset + pageSize - 1);
              if (error) throw error;
              if (!data || data.length === 0) break;
              for (const row of data as { slug: string | null }[]) {
                if (row.slug)
                  dynamic.push({
                    path: `/product/${encodeURIComponent(row.slug)}`,
                    changefreq: "weekly",
                    priority: 0.9,
                  });
              }
              offset += data.length;
            }
          }
        } catch {
          /* If the catalog can't be read, still serve the static pages. */
        }

        const seen = new Set<string>();
        const all = [...staticPages, ...dynamic].filter((u) => {
          if (seen.has(u.path)) return false;
          seen.add(u.path);
          return true;
        });

        const xml =
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          all
            .map(
              (u) =>
                `  <url>\n` +
                `    <loc>${SITE.url}${u.path}</loc>\n` +
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
