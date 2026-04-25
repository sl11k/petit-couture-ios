import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "ar";

type Dict = {
  dir: "ltr" | "rtl";
  brandTagline: string;
  announcements: string[];
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    legal: string;
    cta: string;
  };
  ages: { baby: string; girl: string; boy: string };
  curatedEdit: string;
  mostPopular: string;
  shopAll: string;
  footer: string;
  nav: { menu: string; home: string; account: string; search: string; bag: string };
  categories: Record<string, string>;
  product: {
    backToBoutique: string;
    color: string;
    size: string;
    sizeGuide: string;
    description: string;
    addToBag: string;
    tamara: (n: number, currency: string) => string;
    shippingFree: string;
    returns: string;
  };
  bag: {
    title: string;
    empty: string;
    emptyCta: string;
    item: string;
    items: string;
    size: string;
    color: string;
    qty: string;
    remove: string;
    subtotal: string;
    shipping: string;
    shippingFree: string;
    estimatedTotal: string;
    checkout: string;
    secure: string;
    continueShopping: string;
  };
  checkout: {
    title: string;
    eyebrow: string;
    sectionContact: string;
    sectionAddress: string;
    fullName: string;
    phone: string;
    email: string;
    nationalAddress: string;
    nationalAddressHelp: string;
    buildingNumber: string;
    street: string;
    district: string;
    city: string;
    postalCode: string;
    additionalNumber: string;
    notes: string;
    notesPlaceholder: string;
    cityPlaceholder: string;
    submit: string;
    success: string;
    errors: {
      nameRequired: string;
      nameTooLong: string;
      phoneInvalid: string;
      emailInvalid: string;
      shortCodeInvalid: string;
      buildingInvalid: string;
      streetRequired: string;
      districtRequired: string;
      cityRequired: string;
      postalInvalid: string;
      additionalInvalid: string;
      notesTooLong: string;
    };
  };
};

const dictionaries: Record<Lang, Dict> = {
  en: {
    dir: "ltr",
    brandTagline: "ENFANTS · EST. 2018",
    announcements: [
      "Buy Now, Pay Later with Tamara",
      "Shop and pay in Saudi Riyal (SAR)",
      "Add your Saudi National Address for faster delivery",
    ],
    hero: {
      eyebrow: "FOR A LIMITED TIME ONLY",
      title: "15% Off",
      subtitle: "Everything",
      legal: "Selected new-season pieces. Auto-applied at checkout.",
      cta: "Shop Now",
    },
    ages: { baby: "Baby", girl: "Girl", boy: "Boy" },
    curatedEdit: "— CURATED EDIT —",
    mostPopular: "Most Popular",
    shopAll: "SHOP ALL",
    footer: "Maison · Riyadh · Dubai · Paris",
    nav: { menu: "Menu", home: "Home", account: "Account", search: "Search", bag: "Bag" },
    categories: {
      "best-sellers": "Best Sellers",
      "new-in": "New In",
      swimwear: "Swimwear",
      dresses: "Dresses",
      tops: "Tops",
      shoes: "Shoes",
      "outfit-sets": "Outfit Sets",
      gifts: "Gifts",
      babysuits: "Babysuits",
      bags: "Bags",
    },
    product: {
      backToBoutique: "← BACK TO BOUTIQUE",
      color: "COLOR",
      size: "SIZE",
      sizeGuide: "Size guide",
      description: "Description",
      addToBag: "Add to Bag",
      tamara: (n, c) => `or 4 × ${n} ${c} with Tamara`,
      shippingFree: "Complimentary delivery on orders over 500 SAR",
      returns: "Free returns within 14 days",
    },
    bag: {
      title: "Your Bag",
      empty: "Your bag is empty",
      emptyCta: "Discover the boutique",
      item: "item",
      items: "items",
      size: "Size",
      color: "Color",
      qty: "Qty",
      remove: "Remove",
      subtotal: "Subtotal",
      shipping: "Shipping",
      shippingFree: "Complimentary",
      estimatedTotal: "Estimated Total",
      checkout: "Secure Checkout",
      secure: "Encrypted payment · Tamara · Apple Pay",
      continueShopping: "Continue shopping",
    },
  },
  ar: {
    dir: "rtl",
    brandTagline: "أطفال · تأسست 2018",
    announcements: [
      "اشترِ الآن وادفع لاحقًا مع تمارا",
      "تسوّق وادفع بالريال السعودي",
      "أضف العنوان الوطني السعودي لتوصيل أسرع",
    ],
    hero: {
      eyebrow: "لفترة محدودة فقط",
      title: "خصم ١٥٪",
      subtitle: "على كل شيء",
      legal: "قطع مختارة من الموسم الجديد. يُطبَّق تلقائيًا عند الدفع.",
      cta: "تسوّق الآن",
    },
    ages: { baby: "رضّع", girl: "بنات", boy: "أولاد" },
    curatedEdit: "— مختارات الموسم —",
    mostPopular: "الأكثر شهرة",
    shopAll: "تسوّق الكل",
    footer: "ميزون · الرياض · دبي · باريس",
    nav: { menu: "القائمة", home: "الرئيسية", account: "الحساب", search: "البحث", bag: "الحقيبة" },
    categories: {
      "best-sellers": "الأكثر مبيعًا",
      "new-in": "وصل حديثًا",
      swimwear: "ملابس السباحة",
      dresses: "فساتين",
      tops: "بلوزات",
      shoes: "أحذية",
      "outfit-sets": "أطقم",
      gifts: "هدايا",
      babysuits: "ملابس الرضّع",
      bags: "حقائب",
    },
    product: {
      backToBoutique: "→ العودة إلى البوتيك",
      color: "اللون",
      size: "المقاس",
      sizeGuide: "دليل المقاسات",
      description: "الوصف",
      addToBag: "أضف إلى الحقيبة",
      tamara: (n, c) => `أو ٤ دفعات بقيمة ${n} ${c} مع تمارا`,
      shippingFree: "توصيل مجاني للطلبات فوق ٥٠٠ ريال",
      returns: "إرجاع مجاني خلال ١٤ يومًا",
    },
    bag: {
      title: "حقيبتك",
      empty: "حقيبتك فارغة",
      emptyCta: "اكتشفي البوتيك",
      item: "قطعة",
      items: "قطع",
      size: "المقاس",
      color: "اللون",
      qty: "الكمية",
      remove: "إزالة",
      subtotal: "المجموع الفرعي",
      shipping: "الشحن",
      shippingFree: "مجاني",
      estimatedTotal: "الإجمالي المتوقّع",
      checkout: "إتمام الشراء بأمان",
      secure: "دفع مشفّر · تمارا · Apple Pay",
      continueShopping: "متابعة التسوّق",
    },
  },
};

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: Dict;
  isRTL: boolean;
};

const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");
  const t = dictionaries[lang];

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = t.dir;
    }
  }, [lang, t.dir]);

  return (
    <LanguageContext.Provider
      value={{
        lang,
        setLang,
        toggle: () => setLang((l) => (l === "en" ? "ar" : "en")),
        t,
        isRTL: t.dir === "rtl",
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
