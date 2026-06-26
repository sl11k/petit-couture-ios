import { createFileRoute, Link, useRouter, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Share2,
  ShoppingBag,
  Truck,
  RotateCcw,
  Star,
  ZoomIn,
  X,
  Plus,
  Minus,
  ShieldCheck,
  CreditCard,
  Package,
  MessageCircle,
  Bell,
  Gift,
  Ruler,
  Check,
  ChevronDown,
  Zap,
} from "lucide-react";
import { getProductForCategory, categories, productsByCategory } from "@/data/categories";
import {
  useDbProductBySlug,
  useDbRelatedProducts,
  useProductSizeVariants,
} from "@/hooks/useDbProducts";
import { useProductExtras } from "@/hooks/useProductExtras";
import { FrequentlyBoughtTogether } from "@/components/product/FrequentlyBoughtTogether";
import { useLanguage } from "@/i18n/LanguageContext";
import { useWishlist } from "@/state/WishlistContext";
import { useBag } from "@/state/BagContext";
import { usePriceFormatter } from "@/state/CurrencyContext";
import { trackEvent } from "@/lib/analytics";
import { ShareSheet, type ShareSheetPayload } from "@/components/ShareSheet";

import { VariantsPicker } from "@/components/product/VariantsPicker";
import { ProductOptionsPicker } from "@/components/product/ProductOptionsPicker";

import { buildMeta, productJsonLd, breadcrumbJsonLd, canonical } from "@/lib/seo";
import { devValidateJsonLd } from "@/lib/seoValidate";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/product/$slug")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("products")
      .select(
        "slug,name_ar,name_en,description_ar,description_en,size_guide_image_url,size_guide_content_ar,size_guide_content_en,image_url,images,sku,brand,price,currency,stock,is_active,status",
      )
      .eq("slug", params.slug)
      .eq("is_active", true)
      .eq("status", "active")
      .maybeSingle();
    return { dbProduct: data };
  },
  head: ({ params, loaderData }) => {
    const dbProduct = loaderData?.dbProduct;
    const cat = categories.find((c) => c.slug === params.slug);
    const product = productsByCategory[params.slug];
    const path = `/product/${params.slug}`;
    if (!dbProduct && !cat) {
      return buildMeta({
        title: "غير موجود — Le Petit Paradis",
        description: "هذه الصفحة غير متوفرة.",
        path,
        noindex: true,
        robots: "noindex, follow",
      });
    }
    const dbName = dbProduct?.name_ar || dbProduct?.name_en;
    const title = `${dbName || cat?.name || "منتج"} — Le Petit Paradis`;
    const description = dbProduct
      ? dbProduct.description_ar ||
        dbProduct.description_en ||
        `${dbName} — أزياء أطفال فاخرة من Le Petit Paradis.`
      : product
        ? `${product.name} من ${product.brand}. ${cat?.name ?? "منتج"} — أزياء أطفال فاخرة من Le Petit Paradis.`
        : `تشكيلة ${cat?.name} الفاخرة من Le Petit Paradis للأطفال.`;
    const dbImages = Array.isArray(dbProduct?.images)
      ? dbProduct.images.filter((item): item is string => typeof item === "string")
      : [];
    const image = dbProduct?.image_url ?? dbImages[0] ?? product?.images?.[0] ?? cat?.img;
    const inStock = dbProduct
      ? (dbProduct.stock ?? 0) > 0
      : Boolean(product && (product as any).inStock !== false);
    const jsonLd: Array<Record<string, unknown>> = [
      breadcrumbJsonLd([
        { name: "الرئيسية", path: "/" },
        { name: "الأقسام", path: "/category" },
        { name: dbName || cat?.name || "منتج", path },
      ]),
    ];
    if (dbProduct || product) {
      jsonLd.push(
        productJsonLd({
          name: dbName || product?.name || "منتج",
          description,
          image: dbProduct
            ? dbImages.length
              ? dbImages
              : image
                ? [image]
                : []
            : (product?.images ?? (image ? [image] : [])),
          sku: dbProduct?.sku ?? product?.sku,
          brand: dbProduct?.brand ?? product?.brand,
          price: dbProduct?.price ?? product?.price ?? 0,
          currency: dbProduct?.currency ?? (product as any)?.currency ?? "SAR",
          availability: inStock ? "in_stock" : "out_of_stock",
          url: canonical(path),
          rating: (product as any)?.rating
            ? {
                value: (product as any).rating,
                count: (product as any).reviewsCount ?? 0,
              }
            : undefined,
        }),
      );
    }
    return buildMeta({
      title,
      description,
      path,
      image: typeof image === "string" ? image : undefined,
      type: dbProduct || product ? "product" : "website",
      robots: inStock ? undefined : "noindex, follow",
      jsonLd,
    });
  },
  component: ProductDetails,
});

type TabKey = "description" | "specs" | "care" | "shipping";

function ProductDetails() {
  const { slug } = Route.useParams();
  const router = useRouter();
  const { product, productId, loading: productLoading, fromDb } = useDbProductBySlug(slug);
  const { bySize: sizeVariantBySize } = useProductSizeVariants(productId);
  const { reviews: dbReviews, bundles: dbBundles, offers: dbOffers } = useProductExtras(slug);
  const { isRTL, lang } = useLanguage();
  const ar = isRTL;

  const [activeImg, setActiveImg] = useState(0);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [activeOptions, setActiveOptions] = useState<Record<string, any>>({});
  const [size, setSize] = useState<string>(product.sizes[2] ?? product.sizes[0] ?? "");
  const [color, setColor] = useState<string>(product.colors[0]?.name ?? "");

  const displayImages = useMemo(() => {
    if (!activeImage) return product.images;
    const rest = product.images.filter((s) => s !== activeImage);
    return [activeImage, ...rest];
  }, [activeImage, product.images]);

  useEffect(() => {
    if (activeImage) setActiveImg(0);
  }, [activeImage]);

  // Re-sync selection if the loaded product no longer contains the picks.
  useEffect(() => {
    if (size && !product.sizes.includes(size)) {
      setSize(product.sizes[2] ?? product.sizes[0] ?? "");
    }
    if (color && !product.colors.some((c) => c.name === color)) {
      setColor(product.colors[0]?.name ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.sizes.join("|"), product.colors.map((c) => c.name).join("|")]);

  // Once per-size stock loads, avoid landing on a sold-out size: switch to the
  // first size that's actually available.
  useEffect(() => {
    if (!product.sizes.length) return;
    const isSold = (s: string) => {
      const v = sizeVariantBySize[s];
      return !!v && v.stock <= 0;
    };
    if (!size || isSold(size)) {
      const firstAvailable = product.sizes.find((s) => !isSold(s));
      if (firstAvailable && firstAvailable !== size) setSize(firstAvailable);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Object.keys(sizeVariantBySize).join("|"), product.sizes.join("|")]);
  const [qty, setQty] = useState(1);
  const [giftWrap, setGiftWrap] = useState(false);
  const [selectedUpsells, setSelectedUpsells] = useState<string[]>([]);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>("description");
  const [reviewFilter, setReviewFilter] = useState<number | null>(null);
  const [openSizeChart, setOpenSizeChart] = useState(false);
  const [city, setCity] = useState("");
  const [notifyEmail, setNotifyEmail] = useState("");

  const wishlist = useWishlist();
  const bag = useBag();
  const navigate = useNavigate();
  const wishId = `product:${slug}`;
  const wished = wishlist.has(wishId);
  const setWished = () => wishlist.toggle(wishId, "product_detail");

  // Swipeable gallery: keep activeImg in sync with horizontal scroll position.
  const galleryRef = useRef<HTMLDivElement>(null);
  const onGalleryScroll = () => {
    const el = galleryRef.current;
    if (!el) return;
    const slideW = el.clientWidth || 1;
    const idx = Math.round(Math.abs(el.scrollLeft) / slideW);
    if (idx !== activeImg) setActiveImg(idx);
  };
  const goToImage = (i: number) => {
    const el = galleryRef.current;
    setActiveImg(i);
    if (!el) return;
    const left = el.clientWidth * i * (ar ? -1 : 1);
    el.scrollTo({ left, behavior: "smooth" });
  };

  // Dev-only: validate JSON-LD blocks emitted by head() for this PDP.
  useEffect(() => {
    const cat = categories.find((c) => c.slug === slug);
    if (!cat) return;
    const path = `/category/${slug}`;
    const inStock = (product as any).inStock !== false;
    const image = product.images?.[0] ?? cat.img;
    const blocks: Array<Record<string, unknown>> = [
      breadcrumbJsonLd([
        { name: "الرئيسية", path: "/" },
        { name: "الأقسام", path: "/category" },
        { name: cat.name, path },
      ]),
      productJsonLd({
        name: product.name,
        description: product.shortDescription ?? product.description ?? product.name,
        image: product.images ?? [image],
        sku: product.sku,
        brand: product.brand,
        price: product.price,
        currency: (product as any).currency ?? "SAR",
        availability: inStock ? "in_stock" : "out_of_stock",
        url: canonical(path),
        rating: (product as any).rating
          ? { value: (product as any).rating, count: (product as any).reviewsCount ?? 0 }
          : undefined,
      }),
    ];
    devValidateJsonLd(`pdp:${slug}`, blocks);
  }, [slug, product]);

  useEffect(() => {
    const seenKey = `maisonnet:impression:product:${slug}`;
    if (typeof sessionStorage === "undefined") return;
    if (sessionStorage.getItem(seenKey)) return;
    try {
      sessionStorage.setItem(seenKey, "1");
    } catch {
      /* ignore */
    }
    trackEvent({
      name: "wishlist_impression",
      ts: Date.now(),
      itemId: wishId,
      itemKind: "product",
      itemSlug: slug,
      source: "product_detail",
    });
  }, [slug, wishId]);

  // ESC closes any open overlay; lock body scroll while open.
  useEffect(() => {
    const open = zoomOpen || openSizeChart;
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (zoomOpen) setZoomOpen(false);
        if (openSizeChart) setOpenSizeChart(false);
      }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [zoomOpen, openSizeChart]);

  const upsellsTotal = useMemo(
    () =>
      product.upsells
        .filter((u) => selectedUpsells.includes(u.id))
        .reduce((s, u) => s + u.price, 0),
    [product.upsells, selectedUpsells],
  );
  const giftWrapFee = giftWrap ? 35 : 0;
  // Per-size SKU/price/stock (when the product uses the Sizes & SKUs editor).
  const selectedSizeVariant = sizeVariantBySize[size];
  const effectivePrice = selectedSizeVariant?.price ?? product.price;
  const maxQty = selectedSizeVariant ? Math.max(1, selectedSizeVariant.stock) : product.stock || 99;
  const lineTotal = effectivePrice * qty + upsellsTotal + giftWrapFee;

  // Don't let quantity exceed the selected size's available stock.
  useEffect(() => {
    if (qty > maxQty) setQty(maxQty);
  }, [maxQty, qty]);

  const isOOS = product.status === "out_of_stock";
  const isPreorder = product.status === "preorder";
  const isComingSoon = product.status === "coming_soon";

  const addToBag = () => {
    if (isOOS || isComingSoon) return;
    if (!size) {
      toast.error(ar ? "اختر المقاس أولاً" : "Please select a size");
      return;
    }
    if (selectedSizeVariant && selectedSizeVariant.stock <= 0) {
      toast.error(ar ? "هذا المقاس غير متوفر" : "This size is out of stock");
      return;
    }
    bag.add({
      slug,
      name: product.name,
      brand: product.brand,
      price: effectivePrice,
      currency: product.currency,
      image: product.images[0],
      size,
      color,
      sku: selectedSizeVariant?.sku ?? product.sku ?? undefined,
    });
    toast.success(ar ? "تمت الإضافة إلى السلة" : "Added to bag", {
      action: {
        label: ar ? "عرض السلة" : "View bag",
        onClick: () => navigate({ to: "/bag" }),
      },
    });
  };

  const buyNow = () => {
    if (isOOS || isComingSoon) return;
    if (!size) {
      toast.error(ar ? "اختر المقاس أولاً" : "Please select a size");
      return;
    }
    if (selectedSizeVariant && selectedSizeVariant.stock <= 0) {
      toast.error(ar ? "هذا المقاس غير متوفر" : "This size is out of stock");
      return;
    }
    bag.add({
      slug,
      name: product.name,
      brand: product.brand,
      price: effectivePrice,
      currency: product.currency,
      image: product.images[0],
      size,
      color,
      sku: selectedSizeVariant?.sku ?? product.sku ?? undefined,
    });
    navigate({ to: "/checkout" });
  };

  const [sharePayload, setSharePayload] = useState<ShareSheetPayload | null>(null);
  const onShare = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://maisonnet.app";
    const url = `${origin}/wishlist/share?ids=${encodeURIComponent(wishId)}`;
    trackEvent({
      name: "wishlist_share",
      ts: Date.now(),
      scope: "item",
      itemCount: 1,
      source: "product_detail",
    });
    setSharePayload({
      url,
      title: product.name,
      message: ar
        ? `أحببتُ هذه القطعة من لو بوتي باراديس: ${product.name}`
        : `I'm loving this piece from Le Petit Paradis: ${product.name}`,
    });
  };

  const onWhatsApp = () => {
    const text = ar
      ? `مرحبًا، عندي استفسار عن: ${product.name} (${product.sku})`
      : `Hi, I have a question about: ${product.name} (${product.sku})`;
    const phone = "966500000000";
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
  };

  const BackIcon = ar ? ChevronRight : ChevronLeft;
  const fmt = (n: number) => n.toLocaleString(lang === "ar" ? "ar-EG" : "en-US");
  const fmtPrice = usePriceFormatter();
  const discountPct = product.compareAtPrice
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : 0;

  const effectiveReviews = dbReviews.length
    ? dbReviews.map((r) => ({
        id: r.id,
        name: r.customer_name || (ar ? "عميل" : "Customer"),
        rating: r.rating,
        title: r.title || "",
        body: r.body || "",
        verified: !!r.verified_purchase,
        date: new Date(r.created_at).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US"),
      }))
    : product.reviews;
  const effectiveReviewsCount = dbReviews.length || product.reviewsCount;
  const effectiveRating = dbReviews.length
    ? dbReviews.reduce((s, r) => s + r.rating, 0) / dbReviews.length
    : product.rating;

  const filteredReviews = reviewFilter
    ? effectiveReviews.filter((r) => r.rating === reviewFilter)
    : effectiveReviews;

  const ratingBreakdown = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: effectiveReviews.filter((r) => r.rating === star).length,
    pct: effectiveReviews.length
      ? (effectiveReviews.filter((r) => r.rating === star).length / effectiveReviews.length) * 100
      : 0,
  }));

  // Related products from the SAME category (DB-backed). Falls back to a
  // small list of other categories if no DB siblings exist.
  const { products: dbRelated } = useDbRelatedProducts(slug, 8);
  const related = dbRelated.length
    ? dbRelated.map((p) => ({
        slug: p.slug,
        name: p.name,
        category: p.brand || p.name,
        images: p.images,
        price: p.price,
      }))
    : categories
        .filter((c) => c.slug !== slug)
        .slice(0, 6)
        .map((c) => {
          const base = productsByCategory[c.slug] ?? productsByCategory["best-sellers"];
          return {
            slug: c.slug,
            name: base?.name ?? c.name,
            category: c.name,
            images: base?.images ?? [c.img],
            price: base?.price ?? 0,
          };
        });

  const t = {
    color: ar ? "اللون" : "Color",
    size: ar ? "المقاس" : "Size",
    qty: ar ? "الكمية" : "Quantity",
    sizeGuide: ar ? "دليل المقاسات" : "Size guide",
    addToBag: ar ? "أضف إلى السلة" : "Add to Bag",
    buyNow: ar ? "اشتري الآن" : "Buy Now",
    inStock: ar ? "متوفر" : "In Stock",
    lowStock: (n: number) => (ar ? `بقي ${fmt(n)} قطع فقط` : `Only ${n} left`),
    outOfStock: ar ? "نفدت الكمية" : "Out of Stock",
    preorder: ar ? "طلب مسبق" : "Pre-order",
    comingSoon: ar ? "قريبًا" : "Coming soon",
    notifyMe: ar ? "أخبرني عند التوفر" : "Notify me when available",
    notifySent: ar ? "تم — سنخبرك حال التوفر" : "Done — we'll notify you",
    sku: ar ? "كود المنتج" : "SKU",
    reviews: (n: number) => (ar ? `${fmt(n)} تقييم` : `${n} reviews`),
    description: ar ? "الوصف" : "Description",
    specs: ar ? "المواصفات" : "Specifications",
    care: ar ? "العناية والمواد" : "Care & Materials",
    shipping: ar ? "الشحن والإرجاع" : "Shipping & Returns",
    materials: ar ? "المواد" : "Materials",
    careInst: ar ? "تعليمات العناية" : "Care instructions",
    giftWrap: ar ? "تغليف كهدية (+35 ر.س)" : "Gift wrap (+35 SAR)",
    addOns: ar ? "أضف معه" : "Add together",
    deliveryEstimate: ar ? "التوصيل خلال 2-4 أيام عمل" : "Delivery in 2-4 business days",
    freeShippingOver: (n: number) =>
      ar ? `شحن مجاني للطلبات فوق ${fmt(n)} ر.س` : `Free shipping over ${n} SAR`,
    cityCheck: ar ? "تحقق من التوصيل لمدينتك" : "Check delivery to your city",
    cityPlaceholder: ar ? "اكتب اسم المدينة" : "Enter city name",
    check: ar ? "تحقق" : "Check",
    warranty: ar ? "الضمان" : "Warranty",
    returnPolicy: ar ? "سياسة الإرجاع" : "Return policy",
    securePayment: ar ? "دفع آمن 100%" : "100% Secure payment",
    cod: ar ? "الدفع عند الاستلام متاح" : "Cash on delivery available",
    customerReviews: ar ? "تقييمات العملاء" : "Customer Reviews",
    allReviews: ar ? "الكل" : "All",
    verifiedPurchase: ar ? "مشترٍ موثّق" : "Verified purchase",
    relatedProducts: ar ? "منتجات مشابهة" : "You may also like",
    askWhatsapp: ar ? "استفسر عبر واتساب" : "Ask on WhatsApp",
    sizeChart: ar ? "جدول المقاسات" : "Size chart",
    age: ar ? "العمر" : "Age",
    chest: ar ? "الصدر" : "Chest",
    length: ar ? "الطول" : "Length",
    close: ar ? "إغلاق" : "Close",
  };

  const StatusBadge = () => {
    if (isOOS)
      return (
        <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-red-50 text-red-700">
          {t.outOfStock}
        </span>
      );
    if (isComingSoon)
      return (
        <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
          {t.comingSoon}
        </span>
      );
    if (isPreorder)
      return (
        <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
          {t.preorder}
        </span>
      );
    if (product.status === "low_stock")
      return (
        <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
          <Zap className="h-3 w-3" />
          {t.lowStock(product.stock)}
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
        <Check className="h-3 w-3" />
        {t.inStock}
      </span>
    );
  };

  // Avoid the "old design flash": render a skeleton while the DB row loads.
  if (productLoading) {
    return (
      <div className="min-h-screen w-full bg-cream flex justify-center" dir={ar ? "rtl" : "ltr"}>
        <div className="relative w-full max-w-[440px] bg-background min-h-screen shadow-soft animate-pulse">
          <div className="px-5 pt-4 pb-3 flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-muted" />
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="h-10 w-10 rounded-xl bg-muted" />
          </div>
          <div className="px-5">
            <div className="rounded-[28px] bg-muted aspect-[4/5]" />
            <div className="mt-4 flex gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-[68px] w-[56px] rounded-[14px] bg-muted" />
              ))}
            </div>
          </div>
          <div className="px-5 mt-7 space-y-3">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="h-7 w-3/4 rounded bg-muted" />
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-6 w-28 rounded bg-muted mt-3" />
          </div>
          <div className="px-5 mt-7 space-y-3">
            <div className="h-3 w-16 rounded bg-muted" />
            <div className="flex gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-11 w-11 rounded-xl bg-muted" />
              ))}
            </div>
          </div>
          <div className="px-5 mt-7 space-y-3">
            <div className="h-3 w-16 rounded bg-muted" />
            <div className="grid grid-cols-6 gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 rounded-xl bg-muted" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Strict DB-only: if no product row, show a clear not-found instead of seed fallback.
  if (!fromDb) {
    return (
      <div
        className="min-h-[70vh] grid place-items-center px-6 text-center"
        dir={ar ? "rtl" : "ltr"}
      >
        <div>
          <h1 className="text-2xl font-medium">{ar ? "المنتج غير متوفر" : "Product not found"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {ar
              ? "هذه الصفحة لم تعد متاحة أو لم يتم إضافتها بعد."
              : "This page is no longer available."}
          </p>
          <Link to="/" className="inline-block mt-5 underline text-primary">
            {ar ? "العودة للرئيسية" : "Back to home"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden bg-cream flex justify-center"
      dir={ar ? "rtl" : "ltr"}
    >
      <div className="relative w-full max-w-[440px] bg-background min-h-screen overflow-hidden shadow-soft break-words">
        {/* Header */}
        <header className="px-5 pt-2 pb-3 flex items-center justify-between sticky top-0 z-30 bg-background/95 backdrop-blur">
          <button
            aria-label={ar ? "رجوع" : "Back"}
            onClick={() => router.history.back()}
            className="h-10 w-10 -ms-2 grid place-items-center rounded-xl text-foreground/80 active:scale-95 transition"
          >
            <BackIcon className="h-[22px] w-[22px]" strokeWidth={1.6} />
          </button>
          <span className="text-[10.5px] tracking-luxury text-muted-foreground">
            {lang === "en" ? product.category.toUpperCase() : product.category}
          </span>
          <button
            aria-label={ar ? "مشاركة" : "Share"}
            onClick={onShare}
            className="h-10 w-10 -me-2 grid place-items-center rounded-xl text-foreground/70 active:scale-95 transition"
          >
            <Share2 className="h-[18px] w-[18px]" strokeWidth={1.5} />
          </button>
        </header>

        <main className="pb-[160px]">
          {/* Gallery — swipeable, snap-aligned, RTL-aware */}
          <section className="px-5">
            <div
              className="relative overflow-hidden rounded-[28px] bg-pastel-peach aspect-[4/5]"
              role="region"
              aria-roledescription="carousel"
              aria-label={product.name}
            >
              <div
                ref={galleryRef}
                onScroll={onGalleryScroll}
                className="flex h-full w-full overflow-x-auto snap-x snap-mandatory scrollbar-none scroll-smooth"
                dir={ar ? "rtl" : "ltr"}
              >
                {displayImages.map((src, i) => (
                  <div
                    key={src}
                    className="snap-center shrink-0 w-full h-full"
                    role="group"
                    aria-roledescription="slide"
                    aria-label={`${i + 1} / ${displayImages.length}`}
                  >
                    <img
                      src={src}
                      alt={`${product.name} — ${i + 1}`}
                      className="w-full h-full object-cover"
                      width={1024}
                      height={1280}
                      loading={i === 0 ? "eager" : i === 1 ? "eager" : "lazy"}
                      fetchPriority={i === 0 ? "high" : "auto"}
                      decoding={i === 0 ? "sync" : "async"}
                    />
                  </div>
                ))}
              </div>

              {discountPct > 0 && (
                <span className="absolute top-4 start-4 bg-foreground text-background text-[11px] font-semibold px-2.5 py-1 rounded-full pointer-events-none">
                  -{discountPct}%
                </span>
              )}
              <button
                aria-label={ar ? "تكبير" : "Zoom"}
                onClick={() => setZoomOpen(true)}
                className="absolute bottom-4 start-4 h-10 w-10 rounded-xl bg-background/90 backdrop-blur grid place-items-center text-foreground/80 active:scale-95 transition"
              >
                <ZoomIn className="h-[16px] w-[16px]" strokeWidth={1.6} />
              </button>
              <button
                aria-label={
                  ar
                    ? wished
                      ? "إزالة من المفضلة"
                      : "أضف إلى المفضلة"
                    : wished
                      ? "Remove from wishlist"
                      : "Add to wishlist"
                }
                aria-pressed={wished}
                onClick={setWished}
                className="absolute top-4 end-4 h-11 w-11 rounded-xl bg-background/90 backdrop-blur grid place-items-center border border-gold-soft text-gold-deep active:scale-95 transition"
              >
                <Heart
                  className="h-[18px] w-[18px]"
                  strokeWidth={1.5}
                  fill={wished ? "currentColor" : "none"}
                />
              </button>

              {/* Dots */}
              {product.images.length > 1 && (
                <div className="absolute bottom-4 inset-x-0 flex justify-center gap-1.5 pointer-events-none">
                  {product.images.map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 rounded-full transition-all ${i === activeImg ? "w-5 bg-foreground" : "w-1.5 bg-foreground/30"}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Thumbnails */}
            <div
              className="mt-4 flex gap-3 overflow-x-auto scrollbar-none"
              role="tablist"
              aria-label={ar ? "صور المنتج" : "Product images"}
            >
              {product.images.map((src, i) => (
                <button
                  key={src}
                  role="tab"
                  aria-selected={i === activeImg}
                  aria-label={`${ar ? "صورة" : "Image"} ${i + 1}`}
                  onClick={() => goToImage(i)}
                  className={`h-[68px] w-[56px] shrink-0 overflow-hidden rounded-[14px] border transition active:scale-95 ${i === activeImg ? "border-gold ring-1 ring-gold/40" : "border-border opacity-80"}`}
                >
                  <img
                    src={src}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width={200}
                    height={250}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
              {product.videoUrl && (
                <button className="h-[68px] w-[56px] shrink-0 rounded-[14px] border border-border grid place-items-center bg-muted text-muted-foreground text-[10px]">
                  ▶ Video
                </button>
              )}
            </div>
          </section>

          {/* Title & price */}
          <section className="px-5 mt-7">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10.5px] tracking-luxury text-gold-deep">
                {lang === "en" ? product.brand.toUpperCase() : product.brand}
              </span>
              <StatusBadge />
            </div>
            <h1 className="font-serif text-[26px] sm:text-[28px] leading-tight text-foreground mt-1.5 break-words">
              {product.name}
            </h1>

            {/* Rating + SKU */}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground min-w-0">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={`h-[13px] w-[13px] ${i <= Math.round(effectiveRating) ? "text-gold-deep fill-gold-deep" : "text-border"}`}
                  />
                ))}
                <span className="ms-1 text-foreground/80">{effectiveRating.toFixed(1)}</span>
              </div>
              <span>·</span>
              <button
                onClick={() =>
                  document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" })
                }
                className="hover:text-foreground underline-offset-4 hover:underline"
              >
                {t.reviews(effectiveReviewsCount)}
              </button>
              <span>·</span>
              <span className="truncate">
                {t.sku}: {selectedSizeVariant?.sku ?? product.sku}
              </span>
            </div>

            {/* Price */}
            <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[22px] text-foreground tracking-tight font-medium">
                {fmtPrice(effectivePrice)}
              </span>
              {product.compareAtPrice && product.compareAtPrice > effectivePrice && (
                <span className="text-[14px] text-muted-foreground line-through">
                  {fmtPrice(product.compareAtPrice)}
                </span>
              )}
              {discountPct > 0 && (
                <span className="text-[12px] text-emerald-700 font-medium">
                  {ar ? `وفّر ${discountPct}%` : `Save ${discountPct}%`}
                </span>
              )}
            </div>
            <p className="text-[12px] text-muted-foreground mt-1">
              {ar
                ? `أو 4 دفعات بدون فوائد ${fmtPrice(effectivePrice / 4)} عبر تمارا`
                : `Or 4 interest-free of ${fmtPrice(effectivePrice / 4)} with Tamara`}
            </p>
          </section>

          {/* Color */}
          <section className="px-5 mt-7">
            <div className="flex items-center justify-between">
              <span
                id="pdp-color-label"
                className="text-[12px] tracking-luxury text-muted-foreground"
              >
                {t.color}
              </span>
              <span className="text-[13px] text-foreground/80" aria-live="polite">
                {color}
              </span>
            </div>
            <div role="radiogroup" aria-labelledby="pdp-color-label" className="mt-3 flex gap-3">
              {product.colors.map((c) => {
                const active = c.name === color;
                return (
                  <button
                    key={c.name}
                    role="radio"
                    aria-checked={active}
                    onClick={() => setColor(c.name)}
                    aria-label={c.name}
                    className={`h-11 w-11 rounded-xl grid place-items-center transition active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 ${active ? "ring-1 ring-gold ring-offset-2 ring-offset-background" : ""}`}
                  >
                    <span
                      className="h-8 w-8 rounded-full border border-border"
                      style={{ backgroundColor: c.hex }}
                    />
                  </button>
                );
              })}
            </div>
          </section>

          {/* Size */}
          <section className="px-5 mt-7">
            <div className="flex items-center justify-between">
              <span
                id="pdp-size-label"
                className="text-[12px] tracking-luxury text-muted-foreground"
              >
                {t.size}
              </span>
              <button
                onClick={() => setOpenSizeChart(true)}
                className="text-[12px] text-gold-deep tracking-soft underline-offset-4 hover:underline inline-flex items-center gap-1"
              >
                <Ruler className="h-3 w-3" /> {t.sizeGuide}
              </button>
            </div>
            <div
              role="radiogroup"
              aria-labelledby="pdp-size-label"
              className="mt-3 grid grid-cols-3 min-[380px]:grid-cols-4 gap-2"
            >
              {product.sizes.map((s) => {
                const active = s === size;
                const sv = sizeVariantBySize[s];
                const soldOut = !!sv && sv.stock <= 0;
                return (
                  <button
                    key={s}
                    role="radio"
                    aria-checked={active}
                    disabled={soldOut}
                    onClick={() => setSize(s)}
                    title={soldOut ? (ar ? "غير متوفر" : "Out of stock") : undefined}
                    className={`min-h-12 rounded-xl px-2 py-2 text-[13px] tracking-soft border transition active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 whitespace-normal break-words ${active ? "bg-gold-soft border-gold text-gold-deep font-medium" : "bg-background border-border text-muted-foreground hover:border-foreground/40"} ${soldOut ? "opacity-40 line-through cursor-not-allowed" : ""}`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Variants (sizes + colors as full DB variants when configured) */}
          {productId && (
            <section className="px-5 mt-5">
              <VariantsPicker
                productId={productId}
                slug={slug}
                productName={product.name}
                brand={product.brand}
                basePrice={product.price}
                currency={(product as any).currency ?? "SAR"}
                image={product.images?.[0] ?? ""}
              />
            </section>
          )}

          {/* Product options (color/size/age/...) — drives main image when color selected */}
          {productId && (
            <section className="px-5 mt-2">
              <ProductOptionsPicker
                productId={productId}
                onImageChange={setActiveImage}
                onSelectionChange={setActiveOptions}
              />
            </section>
          )}

          {/* Quantity */}
          <section className="px-5 mt-7">
            <div className="flex items-center justify-between">
              <span className="text-[12px] tracking-luxury text-muted-foreground">{t.qty}</span>
              <div className="flex items-center gap-1 border border-border rounded-xl">
                <button
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="h-10 w-10 grid place-items-center text-foreground/70 active:scale-95"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center text-[14px] font-medium">{fmt(qty)}</span>
                <button
                  onClick={() => setQty(Math.min(maxQty, qty + 1))}
                  disabled={qty >= maxQty}
                  className="h-10 w-10 grid place-items-center text-foreground/70 active:scale-95 disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            {selectedSizeVariant &&
              selectedSizeVariant.stock > 0 &&
              selectedSizeVariant.stock <= 5 && (
                <p className="mt-2 text-[12px] text-amber-700">
                  {ar
                    ? `بقي ${fmt(selectedSizeVariant.stock)} فقط لهذا المقاس`
                    : `Only ${fmt(selectedSizeVariant.stock)} left in this size`}
                </p>
              )}
          </section>

          {/* Gift wrap */}
          {product.giftWrapAvailable && (
            <section className="px-5 mt-5">
              <label className="flex items-center justify-between gap-3 rounded-[16px] border border-border p-3.5 cursor-pointer min-w-0">
                <span className="flex min-w-0 items-center gap-2.5 text-[13px] text-foreground/85 break-words">
                  <Gift className="h-[16px] w-[16px] text-gold-deep" />
                  {t.giftWrap}
                </span>
                <span
                  className={`h-5 w-9 rounded-full transition ${giftWrap ? "bg-foreground" : "bg-border"} relative`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={giftWrap}
                    onChange={(e) => setGiftWrap(e.target.checked)}
                  />
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-background transition ${giftWrap ? (ar ? "right-0.5" : "left-[18px]") : ar ? "right-[18px]" : "left-0.5"}`}
                  />
                </span>
              </label>
            </section>
          )}

          {/* Upsells */}
          {product.upsells.length > 0 && (
            <section className="px-5 mt-7">
              <h2 className="font-serif text-[18px] text-foreground">{t.addOns}</h2>
              <div className="mt-3 space-y-2.5">
                {product.upsells.map((u) => {
                  const checked = selectedUpsells.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className="flex items-center gap-3 rounded-[16px] border border-border p-2.5 cursor-pointer min-w-0"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setSelectedUpsells((prev) =>
                            e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id),
                          )
                        }
                        className="h-4 w-4 accent-foreground"
                      />
                      <img
                        src={u.image}
                        alt={u.name}
                        width={56}
                        height={56}
                        loading="lazy"
                        decoding="async"
                        className="h-14 w-14 rounded-[10px] object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] text-foreground/90 break-words">{u.name}</p>
                        <p className="text-[12px] text-muted-foreground">{fmtPrice(u.price)}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>
          )}

          {/* Tabs: Description / Specs / Care / Shipping */}
          <section className="px-5 mt-8">
            <div
              role="tablist"
              aria-label={ar ? "تفاصيل المنتج" : "Product details"}
              className="flex gap-1 border-b border-border overflow-x-auto scrollbar-none"
            >
              {(
                [
                  ["description", t.description],
                  ["specs", t.specs],
                  ["care", t.care],
                  ["shipping", t.shipping],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={tab === key}
                  id={`pdp-tab-${key}`}
                  aria-controls={`pdp-tabpanel-${key}`}
                  onClick={() => setTab(key)}
                  className={`px-3 py-2.5 text-[12.5px] whitespace-nowrap border-b-2 -mb-px transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 ${tab === key ? "border-gold text-foreground font-medium" : "border-transparent text-muted-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div
              className="mt-4"
              role="tabpanel"
              id={`pdp-tabpanel-${tab}`}
              aria-labelledby={`pdp-tab-${tab}`}
            >
              {tab === "description" && (
                <div>
                  <p className="text-[13px] text-foreground/70 italic">
                    {product.shortDescription}
                  </p>
                  <p className="mt-3 text-[14px] leading-[1.65] text-foreground/80">
                    {product.description}
                  </p>
                  <ul className="mt-4 space-y-1.5">
                    {product.details.map((d) => (
                      <li
                        key={d}
                        className="text-[13.5px] text-foreground/70 flex items-start gap-2"
                      >
                        <span className="mt-2 h-1 w-1 rounded-full bg-gold shrink-0" /> {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {tab === "specs" && (
                <dl className="divide-y divide-border">
                  {product.specs.map((sp) => (
                    <div
                      key={sp.label}
                      className="flex flex-wrap justify-between gap-x-3 gap-y-1 py-2.5 text-[13.5px]"
                    >
                      <dt className="text-muted-foreground break-words">{sp.label}</dt>
                      <dd className="text-foreground/85 font-medium break-words text-end">
                        {sp.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {tab === "care" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-[12.5px] tracking-luxury text-muted-foreground mb-2">
                      {t.materials}
                    </h3>
                    <ul className="space-y-1">
                      {product.materials.map((m) => (
                        <li
                          key={m}
                          className="text-[13.5px] text-foreground/80 flex items-center gap-2"
                        >
                          <Check className="h-3.5 w-3.5 text-gold-deep" /> {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-[12.5px] tracking-luxury text-muted-foreground mb-2">
                      {t.careInst}
                    </h3>
                    <ul className="space-y-1">
                      {product.careInstructions.map((c) => (
                        <li
                          key={c}
                          className="text-[13.5px] text-foreground/80 flex items-center gap-2"
                        >
                          <span className="h-1 w-1 rounded-full bg-gold" /> {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              {tab === "shipping" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-[13.5px] text-foreground/80">
                    <Truck className="h-[16px] w-[16px] text-gold-deep" /> {t.deliveryEstimate}
                  </div>
                  <div className="flex items-center gap-3 text-[13.5px] text-foreground/80">
                    <Package className="h-[16px] w-[16px] text-gold-deep" />{" "}
                    {t.freeShippingOver(500)}
                  </div>
                  <div className="flex items-center gap-3 text-[13.5px] text-foreground/80">
                    <RotateCcw className="h-[16px] w-[16px] text-gold-deep" />{" "}
                    {product.returnPolicy}
                  </div>
                  <div className="mt-3 rounded-[14px] border border-border p-3">
                    <p className="text-[12px] text-muted-foreground mb-2">{t.cityCheck}</p>
                    <div className="flex flex-col min-[380px]:flex-row gap-2">
                      <input
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder={t.cityPlaceholder}
                        className="min-w-0 flex-1 h-10 rounded-full border border-border bg-background px-4 text-[13px]"
                      />
                      <button className="h-10 px-4 rounded-xl bg-foreground text-background text-[12.5px]">
                        {t.check}
                      </button>
                    </div>
                    {city && (
                      <p className="mt-2 text-[12px] text-emerald-700">
                        {ar
                          ? `التوصيل إلى ${city}: 2-4 أيام عمل`
                          : `Delivery to ${city}: 2-4 business days`}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Trust badges */}
          <section className="px-5 mt-7">
            <div className="rounded-[20px] border border-border bg-cream-warm/60 p-4 grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
              <div className="flex items-start gap-2">
                <ShieldCheck
                  className="h-[18px] w-[18px] text-gold-deep shrink-0 mt-0.5"
                  strokeWidth={1.5}
                />
                <div>
                  <p className="text-[12px] font-medium text-foreground/85">{t.warranty}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                    {product.warranty}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <RotateCcw
                  className="h-[18px] w-[18px] text-gold-deep shrink-0 mt-0.5"
                  strokeWidth={1.5}
                />
                <div>
                  <p className="text-[12px] font-medium text-foreground/85">{t.returnPolicy}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                    {product.returnPolicy}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CreditCard
                  className="h-[18px] w-[18px] text-gold-deep shrink-0 mt-0.5"
                  strokeWidth={1.5}
                />
                <p className="text-[12px] text-foreground/85">{t.securePayment}</p>
              </div>
              <div className="flex items-start gap-2">
                <Package
                  className="h-[18px] w-[18px] text-gold-deep shrink-0 mt-0.5"
                  strokeWidth={1.5}
                />
                <p className="text-[12px] text-foreground/85">{t.cod}</p>
              </div>
            </div>
          </section>

          {/* WhatsApp inquiry */}
          <section className="px-5 mt-5">
            <button
              onClick={onWhatsApp}
              className="w-full h-12 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-[13.5px] font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition"
            >
              <MessageCircle className="h-[16px] w-[16px]" />
              {t.askWhatsapp}
            </button>
          </section>

          <FrequentlyBoughtTogether
            productId={productId}
            currentProduct={{
              slug: product.slug,
              name: product.name,
              brand: product.brand ?? "",
              price: product.price,
              image: product.images?.[0] ?? "",
              currency: product.currency ?? "SAR",
            }}
          />

          {dbOffers.length > 0 && (
            <section className="px-5 mt-6">
              <h2 className="font-serif text-[18px] text-foreground mb-2">
                {ar ? "عروض خاصة" : "Special offers"}
              </h2>
              <ul className="space-y-2">
                {dbOffers.map((o) => (
                  <li
                    key={o.id}
                    className="rounded-[14px] border border-gold-deep/30 bg-gold-deep/5 p-3 text-[13px] text-foreground/85 flex items-start gap-2"
                  >
                    <Gift className="h-4 w-4 text-gold-deep mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">
                        {ar
                          ? o.config?.title_ar || o.config?.title || (ar ? "عرض" : "Offer")
                          : o.config?.title_en || o.config?.title || "Offer"}
                      </p>
                      {(o.config?.description_ar ||
                        o.config?.description_en ||
                        o.config?.description) && (
                        <p className="text-[12px] text-muted-foreground mt-0.5">
                          {ar
                            ? o.config.description_ar || o.config.description
                            : o.config.description_en || o.config.description}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {dbBundles.length > 0 && (
            <section className="px-5 mt-6">
              <h2 className="font-serif text-[18px] text-foreground mb-2">
                {ar ? "اشترِ ضمن باقة ووفّر" : "Save with a bundle"}
              </h2>
              <ul className="space-y-2">
                {dbBundles.map((b) => (
                  <li
                    key={b.id}
                    className="rounded-[14px] border border-border p-3 text-[13px] text-foreground/85"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{b.name}</p>
                      {b.bundle_price != null && (
                        <span className="text-gold-deep font-semibold whitespace-nowrap">
                          {fmtPrice(Number(b.bundle_price))}
                        </span>
                      )}
                      {b.bundle_price == null && b.discount_percent != null && (
                        <span className="text-gold-deep font-semibold whitespace-nowrap">
                          -{b.discount_percent}%
                        </span>
                      )}
                    </div>
                    {b.description && (
                      <p className="text-[12px] text-muted-foreground mt-1">{b.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Reviews */}
          <section id="reviews" className="px-5 mt-9">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-[20px] text-foreground">{t.customerReviews}</h2>
              <span className="text-[12px] text-muted-foreground">
                {t.reviews(effectiveReviewsCount)}
              </span>
            </div>

            {/* Rating breakdown */}
            <div className="mt-4 flex items-center gap-5">
              <div className="text-center">
                <div className="text-[34px] font-serif text-foreground leading-none">
                  {effectiveRating.toFixed(1)}
                </div>
                <div className="flex items-center justify-center gap-0.5 mt-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className={`h-[12px] w-[12px] ${i <= Math.round(effectiveRating) ? "text-gold-deep fill-gold-deep" : "text-border"}`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex-1 space-y-1">
                {ratingBreakdown.map((b) => (
                  <button
                    key={b.star}
                    onClick={() => setReviewFilter(reviewFilter === b.star ? null : b.star)}
                    className="w-full flex items-center gap-2 text-[11.5px] text-muted-foreground"
                  >
                    <span className="w-3 text-end">{b.star}</span>
                    <Star className="h-3 w-3 text-gold-deep fill-gold-deep" />
                    <span className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                      <span
                        className="block h-full bg-gold-deep rounded-full"
                        style={{ width: `${b.pct}%` }}
                      />
                    </span>
                    <span className="w-5 text-end">{b.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Filter chips */}
            <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-none">
              <button
                onClick={() => setReviewFilter(null)}
                className={`h-8 px-3 rounded-xl text-[12px] border whitespace-nowrap ${reviewFilter === null ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"}`}
              >
                {t.allReviews}
              </button>
              {[5, 4, 3, 2, 1].map((s) => (
                <button
                  key={s}
                  onClick={() => setReviewFilter(s)}
                  className={`h-8 px-3 rounded-xl text-[12px] border whitespace-nowrap inline-flex items-center gap-1 ${reviewFilter === s ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"}`}
                >
                  {s} <Star className="h-3 w-3 fill-current" />
                </button>
              ))}
            </div>

            {/* Reviews list */}
            <ul className="mt-4 space-y-4">
              {filteredReviews.map((r) => (
                <li key={r.id} className="rounded-[16px] border border-border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[13.5px] font-medium text-foreground">{r.name}</p>
                      {r.verified && (
                        <span className="text-[10.5px] text-emerald-700 inline-flex items-center gap-1 mt-0.5">
                          <Check className="h-3 w-3" /> {t.verifiedPurchase}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star
                          key={i}
                          className={`h-[12px] w-[12px] ${i <= r.rating ? "text-gold-deep fill-gold-deep" : "text-border"}`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="mt-2 text-[13.5px] font-medium text-foreground/90">{r.title}</p>
                  <p className="mt-1 text-[13px] text-foreground/70 leading-relaxed">{r.body}</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">{r.date}</p>
                </li>
              ))}
              {filteredReviews.length === 0 && (
                <p className="text-[13px] text-muted-foreground text-center py-6">
                  {ar ? "لا توجد تقييمات" : "No reviews yet"}
                </p>
              )}
            </ul>
          </section>

          {/* Related products */}
          <section className="mt-10">
            <h2 className="px-5 font-serif text-[20px] text-foreground">{t.relatedProducts}</h2>
            <div className="mt-3 flex gap-3 overflow-x-auto scrollbar-none px-5 pb-2">
              {related.map((p) => (
                <Link
                  key={p.slug}
                  to="/product/$slug"
                  params={{ slug: p.slug }}
                  className="shrink-0 w-[140px]"
                >
                  <div className="aspect-[4/5] rounded-[16px] overflow-hidden bg-pastel-peach">
                    <img
                      src={p.images[0]}
                      alt={p.name}
                      width={400}
                      height={500}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <p className="mt-2 text-[12px] text-foreground/85 line-clamp-1">{p.category}</p>
                  <p className="text-[12px] text-muted-foreground">{fmtPrice(p.price)}</p>
                </Link>
              ))}
            </div>
          </section>

          <div className="mt-10 text-center">
            <Link to="/" className="text-[12px] tracking-luxury text-gold-deep">
              {ar ? "→ العودة إلى البوتيك" : "← BACK TO BOUTIQUE"}
            </Link>
          </div>
        </main>

        {/* Sticky bottom CTA */}
        <div className="fixed lg:absolute bottom-0 inset-x-0 max-w-[440px] mx-auto bg-background/95 backdrop-blur-md border-t border-border z-40">
          {isOOS || isComingSoon ? (
            <div className="px-5 pt-3 pb-6 space-y-2">
              <p className="text-[12px] text-center text-muted-foreground">
                {isOOS ? t.outOfStock : t.comingSoon}
              </p>
              <div className="flex gap-2">
                <input
                  value={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.value)}
                  placeholder="email@example.com"
                  type="email"
                  className="flex-1 h-12 rounded-full border border-border bg-background px-4 text-[13px]"
                />
                <button className="h-12 px-5 rounded-xl bg-foreground text-background text-[13px] font-medium inline-flex items-center gap-1.5">
                  <Bell className="h-4 w-4" /> {t.notifyMe}
                </button>
              </div>
            </div>
          ) : (
            <div className="px-5 pt-3 pb-6 flex items-center gap-2.5">
              <button
                aria-label={ar ? "أضف إلى المفضلة" : "Add to wishlist"}
                onClick={setWished}
                className="h-[52px] w-[52px] rounded-xl border border-gold-soft text-gold-deep grid place-items-center active:scale-95 transition shrink-0"
              >
                <Heart
                  className="h-[18px] w-[18px]"
                  strokeWidth={1.5}
                  fill={wished ? "currentColor" : "none"}
                />
              </button>
              <button
                onClick={addToBag}
                className="flex-1 h-[52px] rounded-xl border border-foreground text-foreground text-[13px] font-medium tracking-soft active:scale-[0.98] transition flex items-center justify-center gap-2"
              >
                <ShoppingBag className="h-[16px] w-[16px]" strokeWidth={1.6} />
                {t.addToBag}
              </button>
              <button
                onClick={buyNow}
                className="flex-1 h-[52px] rounded-xl bg-foreground text-background text-[13px] font-medium tracking-soft active:scale-[0.98] transition flex items-center justify-center gap-1.5 shadow-soft"
              >
                <Zap className="h-[15px] w-[15px]" strokeWidth={2} />
                {t.buyNow}
              </button>
            </div>
          )}
          <div className="px-5 pb-3 -mt-3 text-center">
            <span className="text-[10.5px] text-muted-foreground">
              {ar ? "الإجمالي: " : "Total: "}
              {fmtPrice(lineTotal)}
            </span>
          </div>
        </div>
      </div>

      {/* Zoom modal */}
      {zoomOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 grid place-items-center"
          onClick={() => setZoomOpen(false)}
        >
          <button
            aria-label={t.close}
            onClick={() => setZoomOpen(false)}
            className="absolute top-5 end-5 h-11 w-11 rounded-xl bg-white/10 grid place-items-center text-white"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={displayImages[activeImg]}
            alt={product.name}
            width={1280}
            height={1600}
            loading="eager"
            decoding="sync"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}

      {/* Size chart modal */}
      {openSizeChart && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
          onClick={() => setOpenSizeChart(false)}
        >
          <div
            className="w-full max-w-[440px] bg-background rounded-t-[28px] p-5 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-[20px]">{t.sizeChart}</h3>
              <button
                onClick={() => setOpenSizeChart(false)}
                className="h-9 w-9 rounded-xl bg-muted grid place-items-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {product.sizeGuideImageUrl && (
              <img
                src={product.sizeGuideImageUrl}
                alt={t.sizeGuide}
                className="mb-4 max-h-[55vh] w-full rounded-2xl object-contain bg-muted"
                loading="eager"
              />
            )}
            {product.sizeGuideContent && (
              <p className="mb-4 whitespace-pre-wrap rounded-2xl bg-muted/50 p-3 text-[13px] leading-6 text-foreground/80">
                {product.sizeGuideContent}
              </p>
            )}
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-muted-foreground text-[11.5px] tracking-luxury">
                  <th className="text-start py-2">{t.size}</th>
                  <th className="text-start py-2">{t.age}</th>
                  <th className="text-start py-2">{t.chest}</th>
                  <th className="text-start py-2">{t.length}</th>
                </tr>
              </thead>
              <tbody>
                {product.sizeChart.map((row) => (
                  <tr key={row.size} className="border-t border-border">
                    <td className="py-2.5 font-medium">{row.size}</td>
                    <td className="py-2.5 text-foreground/75">{row.age}</td>
                    <td className="py-2.5 text-foreground/75">{row.chest}</td>
                    <td className="py-2.5 text-foreground/75">{row.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ShareSheet
        open={sharePayload !== null}
        onClose={() => setSharePayload(null)}
        payload={sharePayload}
      />
    </div>
  );
}
