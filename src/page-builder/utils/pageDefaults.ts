import type { Section, SectionType } from "../schemas/pageSchema";

let counter = 0;
function newId(prefix: string) {
  counter++;
  return `${prefix}-${Date.now()}-${counter}`;
}

export const SECTION_TYPES: { type: SectionType; label_ar: string; label_en: string; icon: string }[] = [
  { type: "hero",          label_ar: "هيرو",                    label_en: "Hero",          icon: "🦸" },
  { type: "banner",        label_ar: "بنر",                     label_en: "Banner",        icon: "🖼️" },
  { type: "button",        label_ar: "زر",                      label_en: "Button",        icon: "🔘" },
  { type: "text_block",    label_ar: "كتلة نصية",               label_en: "Text block",    icon: "📝" },
  { type: "image_text",    label_ar: "صورة + نص",               label_en: "Image + Text",  icon: "🌄" },
  { type: "product_grid",  label_ar: "شبكة منتجات",             label_en: "Product grid",  icon: "🛍️" },
  { type: "feature_grid",  label_ar: "بطاقات مزايا",            label_en: "Feature grid",  icon: "🔲" },
  { type: "stats",         label_ar: "إحصائيات",                label_en: "Stats",         icon: "📊" },
  { type: "testimonials",  label_ar: "آراء العملاء",            label_en: "Testimonials",  icon: "💬" },
  { type: "reviews",       label_ar: "تقييمات حقيقية",          label_en: "Live reviews",  icon: "⭐" },
  { type: "faq",           label_ar: "أسئلة شائعة",             label_en: "FAQ",           icon: "❓" },
  { type: "gallery",       label_ar: "معرض صور",                label_en: "Gallery",       icon: "🎞️" },
  { type: "before_after",  label_ar: "قبل وبعد",                label_en: "Before & after", icon: "◫" },
  { type: "video",         label_ar: "فيديو",                   label_en: "Video",          icon: "▶" },
  { type: "countdown",     label_ar: "عد تنازلي",               label_en: "Countdown",      icon: "⏳" },
  { type: "newsletter",    label_ar: "نشرة بريدية",             label_en: "Newsletter",     icon: "✉" },
  { type: "cta",           label_ar: "دعوة للإجراء",            label_en: "CTA",           icon: "🎯" },
  { type: "divider",       label_ar: "فاصل",                    label_en: "Divider",       icon: "➖" },
  { type: "spacer",        label_ar: "مسافة",                   label_en: "Spacer",        icon: "↕️" },
  { type: "html",          label_ar: "HTML مخصص",               label_en: "Custom HTML",   icon: "</>" },
];

export function createDefaultSection(type: SectionType): Section {
  const id = newId(type);
  switch (type) {
    case "hero":
      return { id, type: "hero", content: {
        eyebrow_ar: "جديد", eyebrow_en: "New",
        title_ar: "عنوان رئيسي يجذب الانتباه", title_en: "A headline that grabs attention",
        subtitle_ar: "وصف قصير يشرح القيمة المقدمة في جملة أو جملتين.",
        subtitle_en: "A short subtitle explaining the value proposition.",
        alignment: "center",
        buttons: [{ label_ar: "ابدأ الآن", label_en: "Get started", url: "/", variant: "primary" }],
      }, settings: { spacing: { paddingTop: 80, paddingBottom: 80 } } };
    case "text_block":
      return { id, type: "text_block", content: { title_ar: "عنوان", title_en: "Heading", body_ar: "اكتب محتواك هنا.", body_en: "Write your content here.", alignment: "left" } };
    case "image_text":
      return { id, type: "image_text", content: { title_ar: "عنوان", title_en: "Heading", body_ar: "وصف.", body_en: "Description.", imageSide: "left", image: { url: "", alt: "" } } };
    case "feature_grid":
      return { id, type: "feature_grid", content: {
        title_ar: "مزايا", title_en: "Features", columns: 3,
        cards: [
          { id: newId("card"), title_ar: "ميزة 1", title_en: "Feature 1", description_ar: "وصف.", description_en: "Description." },
          { id: newId("card"), title_ar: "ميزة 2", title_en: "Feature 2", description_ar: "وصف.", description_en: "Description." },
          { id: newId("card"), title_ar: "ميزة 3", title_en: "Feature 3", description_ar: "وصف.", description_en: "Description." },
        ],
      } };
    case "stats":
      return { id, type: "stats", content: { items: [
        { id: newId("st"), value: "100+", label_ar: "عميل", label_en: "Customers" },
        { id: newId("st"), value: "50+",  label_ar: "منتج", label_en: "Products" },
        { id: newId("st"), value: "24/7", label_ar: "دعم",  label_en: "Support" },
        { id: newId("st"), value: "5★",   label_ar: "تقييم", label_en: "Rating" },
      ] } };
    case "testimonials":
      return { id, type: "testimonials", content: { title_ar: "آراء العملاء", title_en: "Testimonials", items: [
        { id: newId("t"), name: "سارة", role_ar: "عميلة", role_en: "Customer", quote_ar: "تجربة رائعة!", quote_en: "Amazing experience!" },
      ] } };
    case "reviews":
      return { id, type: "reviews", content: { title_ar: "تقييمات عملائنا", title_en: "Customer Reviews", limit: 6, minRating: 4, columns: 3 } };
    case "faq":
      return { id, type: "faq", content: { title_ar: "أسئلة شائعة", title_en: "FAQ", items: [
        { id: newId("q"), question_ar: "سؤال؟", question_en: "Question?", answer_ar: "إجابة.", answer_en: "Answer." },
      ] } };
    case "gallery":
      return { id, type: "gallery", content: { columns: 3, images: [] } };
    case "before_after":
      return { id, type: "before_after", content: {
        title_ar: "قبل وبعد", title_en: "Before & after",
        beforeImage: { url: "", alt: "Before" }, afterImage: { url: "", alt: "After" },
        beforeLabel_ar: "قبل", beforeLabel_en: "Before",
        afterLabel_ar: "بعد", afterLabel_en: "After",
        layout: "slider", imageHeight: 520,
      } };
    case "video":
      return { id, type: "video", content: {
        title_ar: "شاهد قصتنا", title_en: "Watch our story", videoUrl: "",
        poster: { url: "", alt: "Video cover" }, caption_ar: "", caption_en: "",
        autoplay: false, muted: true, loop: false, controls: true, aspectRatio: "16/9",
      } };
    case "countdown": {
      const target = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      return { id, type: "countdown", content: {
        title_ar: "الإطلاق قريباً", title_en: "Launching soon",
        subtitle_ar: "كونوا على الموعد", subtitle_en: "Save the date", targetDate: target,
        expiredText_ar: "انطلقنا!", expiredText_en: "We are live!",
        button: { label_ar: "تسوق الآن", label_en: "Shop now", url: "/", variant: "primary" },
      } };
    }
    case "newsletter":
      return { id, type: "newsletter", content: {
        title_ar: "انضمي إلى قائمتنا", title_en: "Join our list",
        subtitle_ar: "استلمي الأخبار والعروض الحصرية", subtitle_en: "Get news and exclusive offers",
        placeholder_ar: "بريدك الإلكتروني", placeholder_en: "Your email",
        buttonLabel_ar: "اشتركي", buttonLabel_en: "Subscribe",
        successText_ar: "تم اشتراكك بنجاح", successText_en: "You are subscribed",
      } };
    case "cta":
      return { id, type: "cta", content: {
        title_ar: "جاهز للبدء؟", title_en: "Ready to start?",
        subtitle_ar: "انضم الآن.", subtitle_en: "Join now.",
        alignment: "center",
        buttons: [{ label_ar: "ابدأ", label_en: "Start", url: "/", variant: "primary" }],
      } };
    case "button":
      return { id, type: "button", content: {
        button: { label_ar: "اضغط هنا", label_en: "Click here", url: "/", variant: "primary" },
        alignment: "center", size: "md", shape: "rounded", fullWidth: false,
      } };
    case "banner":
      return { id, type: "banner", content: {
        title_ar: "عنوان البنر", title_en: "Banner title",
        subtitle_ar: "نص فرعي", subtitle_en: "Subtitle",
        button: { label_ar: "اعرف المزيد", label_en: "Learn more", url: "/", variant: "primary" },
        height: "md", overlay: 0.35, alignment: "center", shape: "rounded", textColor: "#ffffff",
        image: { url: "", alt: "" },
      } };
    case "product_grid":
      return { id, type: "product_grid", content: {
        title_ar: "منتجاتنا", title_en: "Our products",
        source: "newest", limit: 8, columns: 4, layout: "grid", carouselCardSize: "medium", showNavigation: true, cardShape: "rounded", showPrice: true,
      } };
    case "divider":
      return { id, type: "divider", content: { style: "solid", color: "#e5e7eb", thickness: 1, width: 100 } };
    case "spacer":
      return { id, type: "spacer", content: { height: 40 } };
    case "html":
      return { id, type: "html", content: { html: "<div style=\"padding:16px;text-align:center;\">HTML مخصص — عدّل من اللوحة اليمنى</div>" } };
    default:
      throw new Error(`Unknown section type: ${type}`);
  }
}

/**
 * Starter sections for a fresh page so the editor canvas isn't blank when opened.
 * Tailored per page type so admins can edit a real design instead of building from zero.
 */
export function getDefaultSectionsForPage(pageType: string): Section[] {
  const mk = (t: SectionType, mutate?: (s: any) => void): Section => {
    const s = createDefaultSection(t) as any;
    if (mutate) mutate(s);
    return s as Section;
  };
  switch (pageType) {
    case "home":
      return [
        mk("hero", (s) => {
          s.content.eyebrow_ar = "مرحباً بكم"; s.content.eyebrow_en = "Welcome";
          s.content.title_ar = "اكتشفي تشكيلتنا الجديدة"; s.content.title_en = "Discover our new collection";
          s.content.subtitle_ar = "أزياء أنيقة لكل المناسبات بجودة عالية وأسعار مميزة.";
          s.content.subtitle_en = "Elegant fashion for every occasion with premium quality.";
          s.content.buttons = [
            { label_ar: "تسوقي الآن", label_en: "Shop now", url: "/category/all", variant: "primary" },
            { label_ar: "اعرفي أكثر", label_en: "Learn more", url: "/our-story", variant: "secondary" },
          ];
        }),
        mk("banner", (s) => {
          s.content.title_ar = "تخفيضات الموسم"; s.content.title_en = "Season sale";
          s.content.subtitle_ar = "خصومات تصل إلى 50%"; s.content.subtitle_en = "Up to 50% off";
          s.content.button = { label_ar: "تسوقي العروض", label_en: "Shop deals", url: "/category/sale", variant: "primary" };
        }),
        mk("product_grid", (s) => {
          s.content.title_ar = "الأكثر مبيعاً"; s.content.title_en = "Best sellers";
          s.content.source = "newest"; s.content.limit = 8; s.content.columns = 4;
        }),
        mk("feature_grid", (s) => {
          s.content.title_ar = "لماذا نحن"; s.content.title_en = "Why choose us";
          const t = Date.now();
          s.content.cards = [
            { id: `c-${t}-1`, title_ar: "شحن سريع", title_en: "Fast shipping", description_ar: "توصيل خلال 1-3 أيام عمل.", description_en: "Delivery in 1-3 business days." },
            { id: `c-${t}-2`, title_ar: "إرجاع سهل", title_en: "Easy returns", description_ar: "إرجاع خلال 14 يوم.", description_en: "14-day returns." },
            { id: `c-${t}-3`, title_ar: "دعم 24/7", title_en: "24/7 support", description_ar: "نحن هنا للمساعدة.", description_en: "We're here to help." },
          ];
        }),
        mk("reviews"),
        mk("cta", (s) => {
          s.content.title_ar = "انضمي إلى عائلتنا"; s.content.title_en = "Join our family";
          s.content.subtitle_ar = "اشتركي للحصول على عروض حصرية."; s.content.subtitle_en = "Subscribe for exclusive deals.";
          s.content.buttons = [{ label_ar: "اشتركي", label_en: "Subscribe", url: "/", variant: "primary" }];
        }),
      ];
    // System / native-route page types must never seed placeholder sections,
    // because they render *below* the live product/category/checkout content
    // and end up looking like the actual page has gone missing. Admins can
    // still add blocks explicitly from the editor.
    case "product":
    case "product_card":
    case "category":
    case "checkout":
    case "header":
    case "footer":
      return [];
    default:
      return [mk("hero"), mk("text_block"), mk("cta")];
  }
}

