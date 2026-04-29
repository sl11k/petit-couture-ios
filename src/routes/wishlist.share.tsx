import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Heart } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useWishlist } from "@/state/WishlistContext";
import { categories } from "@/data/categories";
import { trackEvent } from "@/lib/analytics";
import { setLastImport } from "@/lib/lastImport";

// Accepts ?ids=cat-slug,prod-slug,full:id  -- compact, human-readable
const searchSchema = z.object({
  ids: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/wishlist/share")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Shared wishlist — Le Petit Paradis" },
      {
        name: "description",
        content: "Open a shared Le Petit Paradis wishlist and add the saved pieces to yours.",
      },
      { property: "og:title", content: "Shared wishlist — Le Petit Paradis" },
      {
        property: "og:description",
        content: "Open a shared Le Petit Paradis wishlist and add the saved pieces to yours.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SharePage,
});

const VALID_PREFIXES = ["product:", "category:", "hero:"] as const;
const validSlugs = new Set(categories.map((c) => c.slug));

function decodeIds(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((tok) => tok.trim())
    .filter(Boolean)
    .map((tok) => {
      // Already prefixed
      if (VALID_PREFIXES.some((p) => tok.startsWith(p))) return tok;
      // Bare slug -> assume product
      if (validSlugs.has(tok)) return `product:${tok}`;
      return null;
    })
    .filter((x): x is string => x !== null)
    .filter((id) => {
      if (id.startsWith("hero:")) return true;
      const slug = id.split(":")[1];
      return validSlugs.has(slug);
    })
    // Cap to prevent abuse
    .slice(0, 100);
}

const SEEN_KEY = "maisonnet:wishlist-share:seen:v1";

function loadSeen(): Set<string> {
  if (typeof sessionStorage === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((v) => typeof v === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function markSeen(token: string) {
  if (typeof sessionStorage === "undefined") return;
  try {
    const seen = loadSeen();
    seen.add(token);
    // Cap to avoid unbounded growth across a long session.
    const trimmed = Array.from(seen).slice(-50);
    sessionStorage.setItem(SEEN_KEY, JSON.stringify(trimmed));
  } catch {
    /* quota or privacy mode — ignore */
  }
}

function SharePage() {
  const { ids } = Route.useSearch();
  const navigate = useNavigate();
  const { merge, has } = useWishlist();
  const { t, isRTL } = useLanguage();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    // Dedupe per exact ids payload across the whole session, so back/forward
    // navigation to the same /wishlist/share?ids=... never re-fires the toast
    // or re-runs the merge.
    const token = (ids ?? "").trim();
    const alreadySeen = loadSeen().has(token);

    if (!alreadySeen) {
      const decoded = decodeIds(ids);
      const fresh = decoded.filter((id) => !has(id));

      if (decoded.length > 0) merge(decoded, "shared_link");
      setLastImport(fresh);

      trackEvent({
        name: "wishlist_import",
        ts: Date.now(),
        requested: decoded.length,
        added: fresh.length,
        source: "shared_link",
      });

      const w = t.wishlist;
      const message =
        fresh.length === 0
          ? w.importedNone
          : fresh.length === 1
            ? w.importedOne
            : w.importedMany(fresh.length);

      toast(message, {
        icon: <Heart className="h-4 w-4" strokeWidth={1.7} fill="currentColor" />,
        position: isRTL ? "top-left" : "top-right",
        duration: 2200,
      });

      markSeen(token);
    }

    navigate({ to: "/wishlist", replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen w-full bg-cream flex items-center justify-center">
      <div className="text-center">
        <div className="h-[64px] w-[64px] mx-auto rounded-full bg-cream-warm grid place-items-center border border-gold-soft">
          <Heart className="h-[24px] w-[24px] text-gold-deep animate-pulse" strokeWidth={1.4} />
        </div>
        <p className="mt-4 text-[12px] tracking-luxury text-muted-foreground">
          {t.wishlist.title}
        </p>
      </div>
    </div>
  );
}
