export type IntegrationCategory =
  | "payment" | "shipping" | "maps" | "whatsapp" | "sms" | "email" | "analytics" | "system";

export interface IntegrationDef {
  category: IntegrationCategory;
  provider: string;
  displayName: string;
  desc: string;
  icon: string;
  fields: { key: string; label: string; type: "text" | "password" | "select" | "textarea"; options?: string[]; placeholder?: string }[];
  hasMode?: boolean;     // sandbox/live toggle
  hasWebhook?: boolean;
  testable?: boolean;
}

export const INTEGRATION_CATALOG: IntegrationDef[] = [
  // === Payment gateways ===
  { category: "payment", provider: "stripe", displayName: "Stripe", desc: "بوابة دفع عالمية (Visa, Mastercard, Apple Pay)", icon: "💳",
    hasMode: true, hasWebhook: true, testable: true,
    fields: [
      { key: "publishable_key", label: "Publishable Key", type: "text", placeholder: "pk_test_..." },
      { key: "account_id", label: "Account ID (اختياري)", type: "text" },
    ] },
  { category: "payment", provider: "moyasar", displayName: "Moyasar", desc: "بوابة دفع سعودية (مدى, STC Pay)", icon: "💳",
    hasMode: true, hasWebhook: true, testable: true,
    fields: [{ key: "publishable_key", label: "Publishable Key", type: "text" }] },
  { category: "payment", provider: "tap", displayName: "Tap Payments", desc: "بوابة دفع خليجية", icon: "💳",
    hasMode: true, hasWebhook: true, testable: true, fields: [] },
  { category: "payment", provider: "paytabs", displayName: "PayTabs", desc: "بوابة دفع للشرق الأوسط", icon: "💳",
    hasMode: true, hasWebhook: true, testable: true,
    fields: [{ key: "profile_id", label: "Profile ID", type: "text" }] },

  // === Shipping ===
  { category: "shipping", provider: "smsa", displayName: "SMSA Express", desc: "شركة شحن سعودية", icon: "📦",
    hasMode: true, hasWebhook: true, testable: true,
    fields: [{ key: "passkey", label: "Passkey", type: "password" }] },
  { category: "shipping", provider: "aramex", displayName: "Aramex", desc: "شحن دولي وإقليمي", icon: "📦",
    hasMode: true, hasWebhook: true, testable: true,
    fields: [
      { key: "username", label: "Username", type: "text" },
      { key: "account_number", label: "Account Number", type: "text" },
    ] },
  { category: "shipping", provider: "dhl", displayName: "DHL Express", desc: "شحن دولي", icon: "📦",
    hasMode: true, hasWebhook: true, testable: true,
    fields: [{ key: "site_id", label: "Site ID", type: "text" }] },
  { category: "shipping", provider: "shipa", displayName: "Shipa Delivery", desc: "شحن إماراتي وخليجي", icon: "📦",
    hasMode: true, hasWebhook: true, testable: true, fields: [] },

  // === Maps ===
  { category: "maps", provider: "google_maps", displayName: "Google Maps", desc: "اختيار الموقع، حساب المسافة، التوصيل", icon: "🗺️",
    testable: true,
    fields: [
      { key: "delivery_radius_km", label: "نطاق التوصيل (كم)", type: "text", placeholder: "50" },
      { key: "default_center", label: "المركز الافتراضي (lat,lng)", type: "text", placeholder: "24.7136,46.6753" },
    ] },

  // === WhatsApp ===
  { category: "whatsapp", provider: "meta_whatsapp", displayName: "WhatsApp Business (Meta)", desc: "API الرسمي من ميتا", icon: "💬",
    hasWebhook: true, testable: true,
    fields: [
      { key: "phone_number_id", label: "Phone Number ID", type: "text" },
      { key: "business_account_id", label: "Business Account ID", type: "text" },
    ] },
  { category: "whatsapp", provider: "twilio_whatsapp", displayName: "Twilio WhatsApp", desc: "WhatsApp عبر Twilio", icon: "💬",
    hasWebhook: true, testable: true,
    fields: [{ key: "from_number", label: "From Number", type: "text", placeholder: "+14155238886" }] },
  { category: "whatsapp", provider: "ultramsg", displayName: "UltraMsg", desc: "خدمة WhatsApp مبسّطة", icon: "💬",
    testable: true,
    fields: [{ key: "instance_id", label: "Instance ID", type: "text" }] },

  // === SMS ===
  { category: "sms", provider: "twilio_sms", displayName: "Twilio SMS", desc: "إرسال SMS عبر Twilio", icon: "📱",
    testable: true,
    fields: [
      { key: "account_sid", label: "Account SID", type: "text" },
      { key: "sender_name", label: "Sender Name", type: "text" },
    ] },
  { category: "sms", provider: "unifonic", displayName: "Unifonic", desc: "SMS سعودي", icon: "📱",
    testable: true,
    fields: [{ key: "sender_name", label: "Sender Name", type: "text", placeholder: "STORE" }] },
  { category: "sms", provider: "msegat", displayName: "Msegat", desc: "SMS خليجي", icon: "📱",
    testable: true,
    fields: [
      { key: "username", label: "Username", type: "text" },
      { key: "sender_name", label: "Sender Name", type: "text" },
    ] },

  // === Email ===
  { category: "email", provider: "resend", displayName: "Resend", desc: "خدمة بريد للمطورين (موصى بها)", icon: "📧",
    testable: true,
    fields: [{ key: "from_email", label: "From Email", type: "text", placeholder: "noreply@store.com" }] },
  { category: "email", provider: "sendgrid", displayName: "SendGrid", desc: "بريد ضخم وموثوق", icon: "📧",
    testable: true,
    fields: [{ key: "from_email", label: "From Email", type: "text" }] },
  { category: "email", provider: "smtp", displayName: "SMTP مخصص", desc: "اربط أي خادم SMTP", icon: "📧",
    testable: true,
    fields: [
      { key: "host", label: "SMTP Host", type: "text", placeholder: "smtp.gmail.com" },
      { key: "port", label: "Port", type: "text", placeholder: "587" },
      { key: "username", label: "Username", type: "text" },
      { key: "from_email", label: "From Email", type: "text" },
    ] },

  // === Analytics ===
  { category: "analytics", provider: "google_analytics", displayName: "Google Analytics 4", desc: "تحليلات الزوار", icon: "📊",
    fields: [{ key: "measurement_id", label: "Measurement ID", type: "text", placeholder: "G-XXXXXXXXXX" }] },
  { category: "analytics", provider: "google_tag_manager", displayName: "Google Tag Manager", desc: "إدارة جميع التاجات", icon: "📊",
    fields: [{ key: "container_id", label: "Container ID", type: "text", placeholder: "GTM-XXXXXXX" }] },
  { category: "analytics", provider: "meta_pixel", displayName: "Meta Pixel", desc: "تتبع Facebook/Instagram", icon: "📊",
    fields: [
      { key: "pixel_id", label: "Pixel ID", type: "text" },
      { key: "conversion_token", label: "Conversion API Token (server-side)", type: "password" },
    ] },
  { category: "analytics", provider: "tiktok_pixel", displayName: "TikTok Pixel", desc: "تتبع حملات TikTok", icon: "📊",
    fields: [{ key: "pixel_id", label: "Pixel ID", type: "text" }] },
  { category: "analytics", provider: "snapchat_pixel", displayName: "Snapchat Pixel", desc: "تتبع حملات Snapchat", icon: "📊",
    fields: [{ key: "pixel_id", label: "Pixel ID", type: "text" }] },

  // === Future systems ===
  { category: "system", provider: "erp", displayName: "نظام ERP", desc: "ربط مع SAP / Odoo / Oracle", icon: "🏢",
    fields: [
      { key: "endpoint", label: "API Endpoint", type: "text", placeholder: "https://erp.example.com/api" },
      { key: "system_type", label: "نوع النظام", type: "select", options: ["SAP","Odoo","Oracle","Microsoft Dynamics","أخرى"] },
    ] },
  { category: "system", provider: "accounting", displayName: "نظام محاسبي", desc: "QuickBooks / Zoho Books / Xero", icon: "🧮",
    fields: [
      { key: "endpoint", label: "API Endpoint", type: "text" },
      { key: "system_type", label: "النظام", type: "select", options: ["QuickBooks","Zoho Books","Xero","أخرى"] },
    ] },
  { category: "system", provider: "crm", displayName: "نظام CRM", desc: "HubSpot / Salesforce / Zoho", icon: "👥",
    fields: [
      { key: "endpoint", label: "API Endpoint", type: "text" },
      { key: "system_type", label: "النظام", type: "select", options: ["HubSpot","Salesforce","Zoho","أخرى"] },
    ] },
  { category: "system", provider: "inventory", displayName: "نظام مخزون", desc: "ربط بنظام مخزون مستقل", icon: "📋",
    fields: [{ key: "endpoint", label: "API Endpoint", type: "text" }] },
  { category: "system", provider: "pos", displayName: "نقاط البيع POS", desc: "Square / Foodics / Lightspeed", icon: "🛒",
    fields: [
      { key: "endpoint", label: "API Endpoint", type: "text" },
      { key: "system_type", label: "النظام", type: "select", options: ["Square","Foodics","Lightspeed","أخرى"] },
    ] },
  { category: "system", provider: "marketplace", displayName: "Marketplace", desc: "Amazon / Noon / Salla", icon: "🛍️",
    fields: [
      { key: "marketplace", label: "السوق", type: "select", options: ["Amazon","Noon","Salla","Zid","أخرى"] },
      { key: "seller_id", label: "Seller ID", type: "text" },
    ] },
];

export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  payment: "💳 بوابات الدفع",
  shipping: "📦 شركات الشحن",
  maps: "🗺️ الخرائط والمواقع",
  whatsapp: "💬 WhatsApp",
  sms: "📱 SMS",
  email: "📧 البريد الإلكتروني",
  analytics: "📊 Analytics & Pixels",
  system: "🏢 الأنظمة المؤسسية",
};
