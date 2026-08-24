import { createFileRoute } from "@tanstack/react-router";

/**
 * Returns the visitor's country (2-letter code) as seen by the edge network.
 * Public, non-sensitive: used only to enrich analytics page views.
 */
export const Route = createFileRoute("/api/public/geo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const h = request.headers;
        const country =
          h.get("cf-ipcountry") ||
          h.get("x-vercel-ip-country") ||
          h.get("x-country-code") ||
          null;
        return new Response(
          JSON.stringify({ country: country && country !== "XX" ? country.toUpperCase() : null }),
          {
            headers: {
              "content-type": "application/json",
              "cache-control": "no-store",
            },
          },
        );
      },
    },
  },
});
