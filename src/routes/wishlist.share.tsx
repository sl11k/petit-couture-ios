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

// Accepts ?ids=cat-slug,prod-slug,full:id  -- compact, human-readable
const searchSchema = z.object({
  ids: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/wishlist/share")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Shared wishlist — Maisonnét" },
      {
        name: "description",
        content: "Open a shared Maisonnét wishlist and add the saved pieces to yours.",
      },
      { property: "og:title", content: "Shared wishlist — Maisonnét" },
      {
        property: "og:description",
        content: "Open a shared Maisonnét wishlist and add the saved pieces to yours.",
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

function SharePage() {
  const { ids } = Route.useSearch();
  const navigate = useNavigate();
  const { merge, has } = useWishlist();
  const { t, isRTL } = useLanguage();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const decoded = decodeIds(ids);
    const fresh = decoded.filter((id) => !has(id));

    if (decoded.length > 0) merge(decoded, "shared_link");

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
