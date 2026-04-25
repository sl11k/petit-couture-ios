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
  wishlist: {
    added: string;
    removed: string;
    title: string;
    eyebrow: string;
    empty: string;
    emptySubtitle: string;
    emptyCta: string;
    item: string;
    items: string;
    view: string;
    remove: string;
    clearAll: string;
    cleared: string;
    share: string;
    shareAll: string;
    linkCopied: string;
    shareTitle: string;
    shareText: string;
    shareFailed: string;
    importedOne: string;
    importedMany: (n: number) => string;
    importedNone: string;
  };
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
    savedTitle: string;
    savedEyebrow: string;
    edit: string;
    useThisAddress: string;
    bagEmptyDuringCheckout: string;
    confirmEyebrow: string;
    confirmTitle: string;
    confirmAwaiting: string;
    steps: { bag: string; address: string; payment: string; stepOf: (n: number, total: number) => string };
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
    wishlist: {
      added: "Added to wishlist",
      removed: "Removed from wishlist",
      title: "Wishlist",
      eyebrow: "SAVED PIECES",
      empty: "Your wishlist is empty",
      emptySubtitle: "Tap the heart on any piece you love to save it here.",
      emptyCta: "Discover the boutique",
      item: "saved item",
      items: "saved items",
      view: "View",
      remove: "Remove",
      clearAll: "Clear all",
      cleared: "Wishlist cleared",
      share: "Share",
      shareAll: "Share wishlist",
      linkCopied: "Share link copied",
      shareTitle: "My Maisonnét wishlist",
      shareText: "Take a look at the pieces I'm loving on Maisonnét.",
      shareFailed: "Couldn't share — link copied instead",
      importedOne: "1 piece added to your wishlist",
      importedMany: (n) => `${n} pieces added to your wishlist`,
      importedNone: "Nothing new to add — already saved",
    },
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
    checkout: {
      title: "Checkout",
      eyebrow: "DELIVERY DETAILS",
      sectionContact: "Contact",
      sectionAddress: "Saudi National Address",
      fullName: "Full name",
      phone: "Phone (+966)",
      email: "Email",
      nationalAddress: "Short Code",
      nationalAddressHelp: "8 characters · 4 letters + 4 digits (e.g. RIYD2342)",
      buildingNumber: "Building number",
      street: "Street",
      district: "District",
      city: "City",
      postalCode: "Postal code",
      additionalNumber: "Additional number",
      notes: "Delivery notes (optional)",
      notesPlaceholder: "Concierge, gate code, gift wrap…",
      cityPlaceholder: "Riyadh",
      submit: "Confirm & Pay",
      success: "Address saved — proceeding to payment",
      savedTitle: "Deliver to",
      savedEyebrow: "SAVED ADDRESS",
      edit: "Edit",
      useThisAddress: "Use this address",
      bagEmptyDuringCheckout: "Your bag is empty — add a piece to continue",
      confirmEyebrow: "CONFIRMING DELIVERY",
      confirmTitle: "Please review before placing your order",
      confirmAwaiting: "Complete the address fields above to review your delivery summary.",
      steps: {
        bag: "Bag",
        address: "Address",
        payment: "Payment",
        stepOf: (n, total) => `Step ${n} of ${total}`,
      },
      errors: {
        nameRequired: "Please enter your full name",
        nameTooLong: "Name must be under 80 characters",
        phoneInvalid: "Enter a valid Saudi phone (+9665XXXXXXXX or 05XXXXXXXX)",
        emailInvalid: "Enter a valid email address",
        shortCodeInvalid: "Format: 4 letters + 4 digits (e.g. RIYD2342)",
        buildingInvalid: "Building number must be 4 digits",
        streetRequired: "Street is required",
        districtRequired: "District is required",
        cityRequired: "City is required",
        postalInvalid: "Postal code must be 5 digits",
        additionalInvalid: "Additional number must be 4 digits",
        notesTooLong: "Notes must be under 240 characters",
      },
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
    wishlist: {
      added: "أُضيف إلى المفضلة",
      removed: "أُزيل من المفضلة",
      title: "المفضلة",
      eyebrow: "القطع المحفوظة",
      empty: "قائمة المفضلة فارغة",
      emptySubtitle: "اضغطي على القلب لحفظ القطع التي تعجبك هنا.",
      emptyCta: "اكتشفي البوتيك",
      item: "قطعة محفوظة",
      items: "قطع محفوظة",
      view: "عرض",
      remove: "إزالة",
      clearAll: "مسح الكل",
      cleared: "تم مسح المفضلة",
      share: "مشاركة",
      shareAll: "مشاركة المفضلة",
      linkCopied: "تم نسخ رابط المشاركة",
      shareTitle: "قائمة مفضلتي في ميزون",
      shareText: "ألقِ نظرة على القطع التي أحبّها في ميزون.",
      shareFailed: "تعذّرت المشاركة — تم نسخ الرابط بدلاً من ذلك",
      importedOne: "تمت إضافة قطعة واحدة إلى مفضلتك",
      importedMany: (n) => `تمت إضافة ${n} قطع إلى مفضلتك`,
      importedNone: "لا جديد للإضافة — محفوظة مسبقًا",
    },
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
    checkout: {
      title: "إتمام الشراء",
      eyebrow: "تفاصيل التوصيل",
      sectionContact: "معلومات التواصل",
      sectionAddress: "العنوان الوطني السعودي",
      fullName: "الاسم الكامل",
      phone: "الهاتف (+٩٦٦)",
      email: "البريد الإلكتروني",
      nationalAddress: "الرمز المختصر",
      nationalAddressHelp: "٨ خانات · ٤ أحرف + ٤ أرقام (مثال: RIYD2342)",
      buildingNumber: "رقم المبنى",
      street: "اسم الشارع",
      district: "الحي",
      city: "المدينة",
      postalCode: "الرمز البريدي",
      additionalNumber: "الرقم الإضافي",
      notes: "ملاحظات التوصيل (اختياري)",
      notesPlaceholder: "الكونسيرج، رمز البوابة، تغليف هدية…",
      cityPlaceholder: "الرياض",
      submit: "تأكيد والدفع",
      success: "تم حفظ العنوان — جارٍ الانتقال للدفع",
      savedTitle: "التوصيل إلى",
      savedEyebrow: "العنوان المحفوظ",
      edit: "تعديل",
      useThisAddress: "استخدام هذا العنوان",
      bagEmptyDuringCheckout: "سلتك فارغة — أضف قطعة للمتابعة",
      confirmEyebrow: "تأكيد التوصيل",
      confirmTitle: "يرجى المراجعة قبل تأكيد طلبك",
      confirmAwaiting: "أكمل حقول العنوان أعلاه لمراجعة ملخص التوصيل.",
      steps: {
        bag: "السلة",
        address: "العنوان",
        payment: "الدفع",
        stepOf: (n, total) => `الخطوة ${n} من ${total}`,
      },
      errors: {
        nameRequired: "يرجى إدخال الاسم الكامل",
        nameTooLong: "الاسم يجب أن يكون أقل من ٨٠ حرفًا",
        phoneInvalid: "أدخل رقم هاتف سعودي صحيح (+٩٦٦٥XXXXXXXX أو ٠٥XXXXXXXX)",
        emailInvalid: "أدخل بريدًا إلكترونيًا صحيحًا",
        shortCodeInvalid: "الصيغة: ٤ أحرف + ٤ أرقام (مثال: RIYD2342)",
        buildingInvalid: "رقم المبنى يجب أن يكون ٤ أرقام",
        streetRequired: "اسم الشارع مطلوب",
        districtRequired: "الحي مطلوب",
        cityRequired: "المدينة مطلوبة",
        postalInvalid: "الرمز البريدي يجب أن يكون ٥ أرقام",
        additionalInvalid: "الرقم الإضافي يجب أن يكون ٤ أرقام",
        notesTooLong: "الملاحظات يجب أن تكون أقل من ٢٤٠ حرفًا",
      },
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
