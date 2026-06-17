import type { Section, SectionType } from "../schemas/pageSchema";

let counter = 0;
function newId(prefix: string) {
  counter++;
  return `${prefix}-${Date.now()}-${counter}`;
}

export const SECTION_TYPES: { type: SectionType; label_ar: string; label_en: string; icon: string }[] = [
  { type: "hero",          label_ar: "هيرو",                    label_en: "Hero",          icon: "🦸" },
  { type: "text_block",    label_ar: "كتلة نصية",               label_en: "Text block",    icon: "📝" },
  { type: "image_text",    label_ar: "صورة + نص",               label_en: "Image + Text",  icon: "🖼️" },
  { type: "feature_grid",  label_ar: "بطاقات مزايا",            label_en: "Feature grid",  icon: "🔲" },
  { type: "stats",         label_ar: "إحصائيات",                label_en: "Stats",         icon: "📊" },
  { type: "testimonials",  label_ar: "آراء العملاء",            label_en: "Testimonials",  icon: "💬" },
  { type: "faq",           label_ar: "أسئلة شائعة",             label_en: "FAQ",           icon: "❓" },
  { type: "gallery",       label_ar: "معرض صور",                label_en: "Gallery",       icon: "🖼️" },
  { type: "cta",           label_ar: "دعوة للإجراء",            label_en: "CTA",           icon: "🎯" },
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
    case "faq":
      return { id, type: "faq", content: { title_ar: "أسئلة شائعة", title_en: "FAQ", items: [
        { id: newId("q"), question_ar: "سؤال؟", question_en: "Question?", answer_ar: "إجابة.", answer_en: "Answer." },
      ] } };
    case "gallery":
      return { id, type: "gallery", content: { columns: 3, images: [] } };
    case "cta":
      return { id, type: "cta", content: {
        title_ar: "جاهز للبدء؟", title_en: "Ready to start?",
        subtitle_ar: "انضم الآن.", subtitle_en: "Join now.",
        alignment: "center",
        buttons: [{ label_ar: "ابدأ", label_en: "Start", url: "/", variant: "primary" }],
      } };
    default:
      throw new Error(`Unknown section type: ${type}`);
  }
}
