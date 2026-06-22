export type EditablePageIdentity = {
  slug: string;
  type: string;
  titleAr: string;
  titleEn: string;
};

export function getEditablePageIdentity(pathname: string): EditablePageIdentity {
  const clean = decodeURIComponent(pathname.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  if (clean === "/") return { slug: "home", type: "home", titleAr: "الصفحة الرئيسية", titleEn: "Home" };

  const parts = clean.split("/").filter(Boolean);
  const section = parts[0] ?? "page";
  const detail = parts.slice(1).join(" / ");
  const type = section === "product" ? "product" : section === "category" || section === "collection" ? "category" : section === "checkout" ? "checkout" : "custom";
  const names: Record<string, [string, string]> = {
    product: ["صفحة المنتج", "Product page"],
    category: ["صفحة التصنيف", "Category page"],
    collection: ["صفحة المجموعة", "Collection page"],
    checkout: ["صفحة الدفع", "Checkout"],
    contact: ["تواصل معنا", "Contact"],
    help: ["المساعدة", "Help"],
    wishlist: ["المفضلة", "Wishlist"],
    cart: ["سلة التسوق", "Shopping bag"],
    account: ["حساب العميل", "Customer account"],
  };
  const [ar, en] = names[section] ?? [section, section];
  return {
    // One CMS record per exact URL: product/category instances never share sections.
    slug: `route:${encodeURIComponent(clean)}`,
    type,
    titleAr: detail ? `${ar} — ${detail}` : ar,
    titleEn: detail ? `${en} — ${detail}` : en,
  };
}
