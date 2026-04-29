import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "ar";

const STORAGE_KEY = "maisonnet:lang:v1";

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
    addedNamed: (name: string) => string;
    removedNamed: (name: string) => string;
    undo: string;
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
    sortBy: string;
    sortNewest: string;
    sortOldest: string;
    sortPriceAsc: string;
    sortPriceDesc: string;
    sortNameAsc: string;
  };
  account: {
    eyebrow: string;
    titleSignedOut: string;
    titleSignedIn: string;
    subtitle: string;
    syncBannerTitle: string;
    syncBannerBody: string;
    syncBannerCta: string;
    email: string;
    password: string;
    signIn: string;
    signUp: string;
    signOut: string;
    switchToSignUp: string;
    switchToSignIn: string;
    signedInAs: string;
    syncedCount: (n: number) => string;
    error: string;
    invalidCredentials: string;
    weakPassword: string;
    emailInUse: string;
    welcome: (name: string) => string;
    mergedOnSignIn: (added: number) => string;
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
  common: {
    back: string;
    backToStore: string;
    loading: string;
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    confirm: string;
    yes: string;
    no: string;
    close: string;
    next: string;
    previous: string;
    submit: string;
    search: string;
    retry: string;
    error: string;
    success: string;
    notFound: string;
    notFoundTitle: string;
    notFoundBody: string;
    backToHome: string;
    offline: string;
    comingSoon: string;
    features: string;
    page: string;
    of: string;
    skipToContent: string;
  };
  legal: {
    privacyTitle: string;
    privacySubtitle: string;
    lastUpdated: string;
    unsubscribeTitle: string;
    unsubscribeProcessing: string;
    unsubscribeDone: string;
    unsubscribeAlready: string;
    unsubscribeInvalid: string;
    unsubscribeInvalidBody: string;
    managePrefs: string;
  };
  admin: {
    dashboard: string;
    products: string;
    orders: string;
    customers: string;
    inventory: string;
    categories: string;
    coupons: string;
    campaigns: string;
    content: string;
    reports: string;
    analytics: string;
    settings: string;
    users: string;
    notifications: string;
    integrations: string;
    payments: string;
    shipping: string;
    returns: string;
    invoices: string;
    audit: string;
    security: string;
    support: string;
    help: string;
    messages: string;
    abandoned: string;
    incomplete: string;
    performance: string;
    storefront: string;
    webhooks: string;
    privacy: string;
    states: string;
    errors: string;
    create: string;
    add: string;
    update: string;
    delete: string;
    export: string;
    import: string;
    filter: string;
    search: string;
    actions: string;
    status: string;
    name: string;
    price: string;
    stock: string;
    sku: string;
    date: string;
    total: string;
    customer: string;
    order: string;
    refresh: string;
    backToAdmin: string;
  };
  cookies: {
    title: string;
    body: string;
    accept: string;
    reject: string;
    customize: string;
  };
  errors: {
    boundaryTitle: string;
    boundaryBody: string;
    tryAgain: string;
    reload: string;
  };
  langSwitch: { ar: string; en: string };
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
      addedNamed: (name) => `Added to wishlist · ${name}`,
      removedNamed: (name) => `Removed from wishlist · ${name}`,
      undo: "Undo",
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
      sortBy: "Sort",
      sortNewest: "Newest",
      sortOldest: "Oldest",
      sortPriceAsc: "Price · low to high",
      sortPriceDesc: "Price · high to low",
      sortNameAsc: "Name · A to Z",
    },
    account: {
      eyebrow: "MY ACCOUNT",
      titleSignedOut: "Sync across devices",
      titleSignedIn: "Your Maisonnét account",
      subtitle: "Sign in with your email to keep your wishlist with you, on any device.",
      syncBannerTitle: "Save across devices",
      syncBannerBody: "Sign in to keep your wishlist synced wherever you shop.",
      syncBannerCta: "Sign in",
      email: "Email",
      password: "Password",
      signIn: "Sign in",
      signUp: "Create account",
      signOut: "Sign out",
      switchToSignUp: "New here? Create an account",
      switchToSignIn: "Already have an account? Sign in",
      signedInAs: "Signed in as",
      syncedCount: (n) => (n === 1 ? "1 piece synced" : `${n} pieces synced`),
      error: "Something went wrong. Please try again.",
      invalidCredentials: "Email or password is incorrect.",
      weakPassword: "Password must be at least 6 characters.",
      emailInUse: "An account already exists with that email.",
      welcome: (name) => `Welcome, ${name}`,
      mergedOnSignIn: (added) => (added === 1 ? "1 saved piece added from this device" : `${added} saved pieces added from this device`),
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
    common: {
      back: "Back",
      backToStore: "← Back to store",
      loading: "Loading…",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      edit: "Edit",
      confirm: "Confirm",
      yes: "Yes",
      no: "No",
      close: "Close",
      next: "Next",
      previous: "Previous",
      submit: "Submit",
      search: "Search",
      retry: "Retry",
      error: "Error",
      success: "Success",
      notFound: "Not found",
      notFoundTitle: "Page not found",
      notFoundBody: "The page you are looking for is unavailable or has been moved.",
      backToHome: "Back to home",
      offline: "You are offline",
      comingSoon: "Coming soon",
      features: "Features",
      page: "Page",
      of: "of",
      skipToContent: "Skip to content",
    },
    legal: {
      privacyTitle: "Privacy Policy",
      privacySubtitle: "How we handle your data",
      lastUpdated: "Last updated",
      unsubscribeTitle: "Unsubscribe",
      unsubscribeProcessing: "Processing…",
      unsubscribeDone: "You have been unsubscribed",
      unsubscribeAlready: "Already unsubscribed",
      unsubscribeInvalid: "Invalid link",
      unsubscribeInvalidBody: "The link may be expired or incorrect.",
      managePrefs: "Manage all preferences",
    },
    admin: {
      dashboard: "Dashboard",
      products: "Products",
      orders: "Orders",
      customers: "Customers",
      inventory: "Inventory",
      categories: "Categories",
      coupons: "Coupons",
      campaigns: "Campaigns",
      content: "Content",
      reports: "Reports",
      analytics: "Analytics",
      settings: "Settings",
      users: "Users",
      notifications: "Notifications",
      integrations: "Integrations",
      payments: "Payments",
      shipping: "Shipping",
      returns: "Returns",
      invoices: "Invoices",
      audit: "Audit log",
      security: "Security",
      support: "Support",
      help: "Help",
      messages: "Messages",
      abandoned: "Abandoned carts",
      incomplete: "Incomplete orders",
      performance: "Performance",
      storefront: "Storefront",
      webhooks: "Webhooks",
      privacy: "Privacy",
      states: "States",
      errors: "Errors",
      create: "Create",
      add: "Add",
      update: "Update",
      delete: "Delete",
      export: "Export",
      import: "Import",
      filter: "Filter",
      search: "Search",
      actions: "Actions",
      status: "Status",
      name: "Name",
      price: "Price",
      stock: "Stock",
      sku: "SKU",
      date: "Date",
      total: "Total",
      customer: "Customer",
      order: "Order",
      refresh: "Refresh",
      backToAdmin: "← Back to admin",
    },
    cookies: {
      title: "We value your privacy",
      body: "We use cookies to improve your experience. You can accept all or customize preferences.",
      accept: "Accept all",
      reject: "Reject",
      customize: "Customize",
    },
    errors: {
      boundaryTitle: "Something went wrong",
      boundaryBody: "An unexpected error occurred. Please try again.",
      tryAgain: "Try again",
      reload: "Reload page",
    },
    langSwitch: { ar: "العربية", en: "English" },
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
      addedNamed: (name) => `أُضيف إلى المفضلة · ${name}`,
      removedNamed: (name) => `أُزيل من المفضلة · ${name}`,
      undo: "تراجع",
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
      sortBy: "ترتيب",
      sortNewest: "الأحدث",
      sortOldest: "الأقدم",
      sortPriceAsc: "السعر · من الأقل إلى الأعلى",
      sortPriceDesc: "السعر · من الأعلى إلى الأقل",
      sortNameAsc: "الاسم · أ إلى ي",
    },
    account: {
      eyebrow: "حسابي",
      titleSignedOut: "زامن بين أجهزتك",
      titleSignedIn: "حسابك في ميزون",
      subtitle: "سجّلي الدخول ببريدك الإلكتروني للاحتفاظ بمفضلتك على أي جهاز.",
      syncBannerTitle: "احفظي بين الأجهزة",
      syncBannerBody: "سجّلي الدخول للاحتفاظ بمفضلتك أينما تتسوّقين.",
      syncBannerCta: "تسجيل الدخول",
      email: "البريد الإلكتروني",
      password: "كلمة المرور",
      signIn: "تسجيل الدخول",
      signUp: "إنشاء حساب",
      signOut: "تسجيل الخروج",
      switchToSignUp: "جديدة هنا؟ أنشئي حسابًا",
      switchToSignIn: "لديك حساب؟ سجّلي الدخول",
      signedInAs: "مسجّلة باسم",
      syncedCount: (n) => (n === 1 ? "قطعة واحدة مزامنة" : `${n} قطع مزامنة`),
      error: "حدث خطأ. يرجى المحاولة مرة أخرى.",
      invalidCredentials: "البريد أو كلمة المرور غير صحيحة.",
      weakPassword: "يجب أن تتكوّن كلمة المرور من 6 أحرف على الأقل.",
      emailInUse: "يوجد حساب بهذا البريد بالفعل.",
      welcome: (name) => `مرحبًا، ${name}`,
      mergedOnSignIn: (added) => (added === 1 ? "أُضيفت قطعة واحدة من هذا الجهاز" : `أُضيفت ${added} قطع من هذا الجهاز`),
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
    common: {
      back: "رجوع",
      backToStore: "← العودة للمتجر",
      loading: "جارٍ التحميل…",
      save: "حفظ",
      cancel: "إلغاء",
      delete: "حذف",
      edit: "تعديل",
      confirm: "تأكيد",
      yes: "نعم",
      no: "لا",
      close: "إغلاق",
      next: "التالي",
      previous: "السابق",
      submit: "إرسال",
      search: "بحث",
      retry: "إعادة المحاولة",
      error: "خطأ",
      success: "تم",
      notFound: "غير موجود",
      notFoundTitle: "الصفحة غير موجودة",
      notFoundBody: "الصفحة التي تبحث عنها غير متوفرة أو تم نقلها.",
      backToHome: "العودة للرئيسية",
      offline: "أنت غير متصل بالإنترنت",
      comingSoon: "قريبًا",
      features: "الميزات",
      page: "صفحة",
      of: "من",
      skipToContent: "تخطّي إلى المحتوى",
    },
    legal: {
      privacyTitle: "سياسة الخصوصية",
      privacySubtitle: "كيف نتعامل مع بياناتك",
      lastUpdated: "آخر تحديث",
      unsubscribeTitle: "إلغاء الاشتراك",
      unsubscribeProcessing: "جاري المعالجة…",
      unsubscribeDone: "تم إلغاء الاشتراك",
      unsubscribeAlready: "تم الإلغاء سابقًا",
      unsubscribeInvalid: "رابط غير صالح",
      unsubscribeInvalidBody: "قد يكون الرابط منتهي الصلاحية أو غير صحيح.",
      managePrefs: "إدارة كل التفضيلات",
    },
    admin: {
      dashboard: "لوحة التحكم",
      products: "المنتجات",
      orders: "الطلبات",
      customers: "العملاء",
      inventory: "المخزون",
      categories: "الفئات",
      coupons: "الكوبونات",
      campaigns: "الحملات",
      content: "المحتوى",
      reports: "التقارير",
      analytics: "التحليلات",
      settings: "الإعدادات",
      users: "المستخدمون",
      notifications: "الإشعارات",
      integrations: "التكاملات",
      payments: "المدفوعات",
      shipping: "الشحن",
      returns: "المرتجعات",
      invoices: "الفواتير",
      audit: "سجل التدقيق",
      security: "الأمان",
      support: "الدعم",
      help: "المساعدة",
      messages: "الرسائل",
      abandoned: "السلال المهجورة",
      incomplete: "الطلبات الناقصة",
      performance: "الأداء",
      storefront: "الواجهة",
      webhooks: "Webhooks",
      privacy: "الخصوصية",
      states: "الحالات",
      errors: "الأخطاء",
      create: "إنشاء",
      add: "إضافة",
      update: "تحديث",
      delete: "حذف",
      export: "تصدير",
      import: "استيراد",
      filter: "تصفية",
      search: "بحث",
      actions: "الإجراءات",
      status: "الحالة",
      name: "الاسم",
      price: "السعر",
      stock: "المخزون",
      sku: "الرمز",
      date: "التاريخ",
      total: "الإجمالي",
      customer: "العميل",
      order: "الطلب",
      refresh: "تحديث",
      backToAdmin: "← العودة للوحة الإدارة",
    },
    cookies: {
      title: "نهتم بخصوصيتك",
      body: "نستخدم ملفات تعريف الارتباط لتحسين تجربتك. يمكنك القبول الكامل أو تخصيص التفضيلات.",
      accept: "قبول الكل",
      reject: "رفض",
      customize: "تخصيص",
    },
    errors: {
      boundaryTitle: "حدث خطأ ما",
      boundaryBody: "حدث خطأ غير متوقّع. يُرجى المحاولة مرة أخرى.",
      tryAgain: "إعادة المحاولة",
      reload: "إعادة تحميل الصفحة",
    },
    langSwitch: { ar: "العربية", en: "English" },
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

function readInitialLang(): Lang {
  if (typeof window === "undefined") return "ar";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "ar" || stored === "en") return stored;
  } catch {
    /* noop */
  }
  return "ar";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");
  const t = dictionaries[lang];

  // Hydrate from storage on mount
  useEffect(() => {
    const initial = readInitialLang();
    if (initial !== lang) setLangState(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = t.dir;
    }
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, lang);
      } catch {
        /* noop */
      }
    }
  }, [lang, t.dir]);

  const setLang = (l: Lang) => setLangState(l);

  return (
    <LanguageContext.Provider
      value={{
        lang,
        setLang,
        toggle: () => setLangState((l) => (l === "en" ? "ar" : "en")),
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
