import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getRecoveryCart } from "@/lib/cart-recovery.functions";

export const Route = createFileRoute("/recover/$token")({
  component: RecoverPage,
  head: () => ({
    meta: [
      { title: "استكمال طلبك | le petit paradise" },
      {
        name: "description",
        content: "أكمل طلبك المحفوظ في السلة واستفد من الخصم الخاص بك في le petit paradise.",
      },
      { property: "og:title", content: "استكمال طلبك | le petit paradise" },
      {
        property: "og:description",
        content: "أكمل طلبك المحفوظ في السلة واستفد من الخصم الخاص بك.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const STORAGE_KEY = "maisonnet:bag:v1";

function RecoverPage() {
  const { token } = Route.useParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await getRecoveryCart({ data: { token } });
        if (cancelled) return;
        if (!res.ok || !res.items.length) {
          setError("انتهت صلاحية هذا الرابط أو لم نعد نجد سلتك.");
          return;
        }
        const currency = (res as any).currency || "SAR";
        const items = res.items.map((i: any) => ({
          id: i.variant_id
            ? `${i.slug}::v::${i.variant_id}`
            : `${i.slug}::${i.size ?? ""}::${i.color ?? ""}`,
          slug: i.slug,
          name: i.name,
          brand: i.brand ?? "",
          price: Number(i.price) || 0,
          currency: i.currency ?? currency,
          image: i.image ?? "",
          size: i.size ?? "",
          color: i.color ?? "",
          qty: Math.max(1, Number(i.qty) || 1),
          sku: i.sku ?? undefined,
          variantId: i.variant_id ?? i.variantId ?? undefined,
          variantLabel: i.variant_label ?? i.variantLabel ?? undefined,
        }));
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        const q = res.coupon ? `?coupon=${encodeURIComponent(res.coupon)}` : "";
        window.location.assign(`/checkout${q}`);
      } catch {
        if (!cancelled) setError("تعذّر استرجاع السلة، حاول مرة أخرى.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-lg font-medium">
        {error ? "تعذّر استكمال الطلب" : "جارٍ استرجاع سلتك..."}
      </h1>
      {error ? (
        <>
          <p className="text-sm text-muted-foreground">{error}</p>
          <a href="/" className="text-sm underline">
            العودة للمتجر
          </a>
        </>
      ) : (
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      )}
    </main>
  );
}
