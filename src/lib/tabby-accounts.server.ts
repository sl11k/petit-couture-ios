/**
 * Tabby multi-account resolution.
 *
 * A Tabby merchant account is bound to ONE country / settlement currency, so a
 * store selling in both KSA and UAE needs two accounts. This module resolves
 * which account should handle a given order, and lets webhook / reconciliation
 * paths try every configured account when the payment's origin is unknown.
 *
 * Configuration sources (first wins per field):
 *  1. Environment: TABBY_SA_* / TABBY_AE_* (and legacy TABBY_* = default account)
 *  2. integrations row (category=payment, provider=tabby) config.accounts.{sa,ae}
 *  3. legacy top-level integration fields (api_secret / config.merchant_code ...)
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type TabbyAccountKey = "sa" | "ae";

export type TabbyAccount = {
  key: TabbyAccountKey;
  secret: string;
  publicKey: string | null;
  merchantCode: string;
  currency: string;
  webhookSecret: string | null;
};

const DEFAULTS: Record<TabbyAccountKey, { currency: string; merchantCode: string }> = {
  sa: { currency: "SAR", merchantCode: "sa" },
  ae: { currency: "AED", merchantCode: "ae" },
};

const str = (value: unknown) => String(value ?? "").trim();

async function loadIntegration() {
  const { data } = await supabaseAdmin
    .from("integrations")
    .select("id, api_key, api_secret, config")
    .eq("category", "payment")
    .eq("provider", "tabby")
    .eq("enabled", true)
    .maybeSingle();

  const config = (data?.config && typeof data.config === "object" ? data.config : {}) as Record<
    string,
    unknown
  >;
  const accounts = (config.accounts && typeof config.accounts === "object"
    ? config.accounts
    : {}) as Record<string, Record<string, unknown>>;
  return { row: data, config, accounts };
}

function envFor(key: TabbyAccountKey, field: string) {
  const prefix = key.toUpperCase();
  return str(process.env[`TABBY_${prefix}_${field}`]);
}

function buildAccount(
  key: TabbyAccountKey,
  account: Record<string, unknown>,
  legacy: { secret: string; publicKey: string; merchantCode: string; currency: string; webhookSecret: string },
  isLegacyAccount: boolean,
): TabbyAccount | null {
  const secret =
    envFor(key, "SECRET_KEY") ||
    str(account.secret_key) ||
    str(account.api_secret) ||
    (isLegacyAccount ? legacy.secret : "");
  // A Tabby secret key always starts with `sk_`; a public key pasted into the
  // secret slot would silently create a broken account, so ignore it.
  if (!secret || !secret.startsWith("sk_")) return null;


  const merchantCode =
    envFor(key, "MERCHANT_CODE") ||
    str(account.merchant_code) ||
    (isLegacyAccount ? legacy.merchantCode : "") ||
    DEFAULTS[key].merchantCode;

  const currency = (
    envFor(key, "CURRENCY") ||
    str(account.currency) ||
    (isLegacyAccount ? legacy.currency : "") ||
    DEFAULTS[key].currency
  ).toUpperCase();

  const publicKey =
    envFor(key, "PUBLIC_KEY") ||
    str(account.public_key) ||
    str(account.api_key) ||
    (isLegacyAccount ? legacy.publicKey : "") ||
    null;

  const webhookSecret =
    envFor(key, "WEBHOOK_SECRET") ||
    str(account.webhook_secret) ||
    (isLegacyAccount ? legacy.webhookSecret : "") ||
    null;

  return { key, secret, publicKey, merchantCode, currency, webhookSecret };
}

/** All configured Tabby accounts (KSA and UAE), in no particular order. */
export async function listTabbyAccounts(): Promise<TabbyAccount[]> {
  const { row, config, accounts } = await loadIntegration();

  const legacy = {
    secret:
      str(process.env.TABBY_SECRET_KEY) ||
      str(row?.api_secret) ||
      str(config.secret_key) ||
      str(config.tabby_secret_key) ||
      str(config.api_secret),
    publicKey: str(row?.api_key) || str(config.public_key) || str(config.tabby_public_key),
    merchantCode:
      str(process.env.TABBY_MERCHANT_CODE) ||
      str(config.merchant_code) ||
      str(config.tabby_merchant_code),
    currency:
      str(process.env.TABBY_CURRENCY) || str(config.currency) || str(config.tabby_currency),
    webhookSecret:
      str(process.env.TABBY_WEBHOOK_SECRET) ||
      str(config.webhook_secret) ||
      str(process.env.PAYMENT_WEBHOOK_SECRET),
  };

  // The pre-existing single account settles in AED, so legacy config belongs to
  // the UAE account unless it explicitly declares SAR.
  const legacyKey: TabbyAccountKey = legacy.currency.toUpperCase() === "SAR" ? "sa" : "ae";

  const result: TabbyAccount[] = [];
  for (const key of ["sa", "ae"] as TabbyAccountKey[]) {
    const built = buildAccount(key, accounts[key] ?? {}, legacy, key === legacyKey);
    if (built) result.push(built);
  }
  return result;
}

type OrderLike = {
  currency?: string | null;
  shipping_address?: unknown;
  customer_phone?: string | null;
};

function preferredKeyForOrder(order: OrderLike): TabbyAccountKey {
  const currency = str(order.currency).toUpperCase();
  if (currency === "SAR") return "sa";
  if (currency === "AED") return "ae";
  const address = (order.shipping_address && typeof order.shipping_address === "object"
    ? order.shipping_address
    : {}) as Record<string, unknown>;
  const country = str(address.country || address.countryCode).toUpperCase();
  if (["SA", "KSA", "SAUDI ARABIA", "السعودية"].includes(country)) return "sa";
  if (["AE", "UAE", "UNITED ARAB EMIRATES", "الإمارات"].includes(country)) return "ae";
  const phone = str(order.customer_phone).replace(/[^\d+]/g, "");
  if (phone.startsWith("+966") || phone.startsWith("966")) return "sa";
  if (phone.startsWith("+971") || phone.startsWith("971")) return "ae";
  return "sa";
}

/** Accounts ordered by best fit for this order (preferred country first). */
export async function tabbyAccountsForOrder(order: OrderLike): Promise<TabbyAccount[]> {
  const accounts = await listTabbyAccounts();
  const preferred = preferredKeyForOrder(order);
  return [...accounts].sort((a, b) => Number(b.key === preferred) - Number(a.key === preferred));
}

/** The single best account for an order; throws when nothing is configured. */
export async function resolveTabbyAccount(order: OrderLike): Promise<TabbyAccount> {
  const [account] = await tabbyAccountsForOrder(order);
  if (!account) throw new Error("No Tabby account is configured");
  return account;
}

/**
 * Find the account that owns a Tabby object (checkout session or payment).
 * Used by webhook + reconciliation paths where the origin account is unknown.
 */
export async function findTabbyAccountForPayment(
  paymentId: string,
  order?: OrderLike,
): Promise<{ account: TabbyAccount; payment: Record<string, unknown> } | null> {
  const accounts = order ? await tabbyAccountsForOrder(order) : await listTabbyAccounts();
  for (const account of accounts) {
    const response = await fetch(
      `https://api.tabby.ai/api/v1/payments/${encodeURIComponent(paymentId)}`,
      { headers: { Authorization: `Bearer ${account.secret}` } },
    );
    if (response.ok) {
      const payment = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      return { account, payment };
    }
  }
  return null;
}
