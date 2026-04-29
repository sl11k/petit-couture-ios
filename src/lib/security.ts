// Security helpers: password policy, 2FA (TOTP), session, lockout checks.
import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";

export type PasswordPolicy = {
  min_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_number: boolean;
  require_symbol: boolean;
};

export const DEFAULT_POLICY: PasswordPolicy = {
  min_length: 10,
  require_uppercase: true,
  require_lowercase: true,
  require_number: true,
  require_symbol: false,
};

export function validatePassword(pwd: string, policy: PasswordPolicy = DEFAULT_POLICY): string[] {
  const errs: string[] = [];
  if (pwd.length < policy.min_length) errs.push(`الحد الأدنى ${policy.min_length} حرفًا`);
  if (policy.require_uppercase && !/[A-Z]/.test(pwd)) errs.push("حرف كبير واحد على الأقل");
  if (policy.require_lowercase && !/[a-z]/.test(pwd)) errs.push("حرف صغير واحد على الأقل");
  if (policy.require_number && !/\d/.test(pwd)) errs.push("رقم واحد على الأقل");
  if (policy.require_symbol && !/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) errs.push("رمز خاص واحد على الأقل");
  return errs;
}

export function passwordStrength(pwd: string): { score: number; label: string } {
  let s = 0;
  if (pwd.length >= 8) s++;
  if (pwd.length >= 12) s++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) s++;
  if (/\d/.test(pwd)) s++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) s++;
  const labels = ["ضعيف جدًا", "ضعيف", "متوسط", "جيد", "قوي", "ممتاز"];
  return { score: s, label: labels[s] };
}

export async function checkLockout(email: string): Promise<{ locked: boolean; locked_until: string | null; remaining_attempts: number }> {
  const { data } = await (supabase as any).rpc("check_account_lockout", { _email: email });
  if (Array.isArray(data) && data[0]) return data[0];
  return { locked: false, locked_until: null, remaining_attempts: 5 };
}

export async function registerFailedLogin(email: string) {
  await (supabase as any).rpc("register_failed_login", { _email: email });
}

// === 2FA (TOTP) ===
// Browser-native: generate base32 secret, otpauth URI; verification uses standard TOTP (HMAC-SHA1, 30s).

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateTotpSecret(length = 20): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let bits = "", out = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

export function buildOtpauthUri(secret: string, account: string, issuer = "Store Admin"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

function base32Decode(s: string): Uint8Array {
  s = s.replace(/=+$/, "").toUpperCase();
  let bits = "";
  for (const c of s) {
    const v = B32.indexOf(c);
    if (v < 0) continue;
    bits += v.toString(2).padStart(5, "0");
  }
  const out = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  return out;
}

export async function verifyTotp(secret: string, token: string, window = 1): Promise<boolean> {
  const code = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  const key = base32Decode(secret);
  const step = Math.floor(Date.now() / 1000 / 30);
  const subtle = crypto.subtle;
  const keyBuf = key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer;
  const cryptoKey = await subtle.importKey("raw", keyBuf, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  for (let off = -window; off <= window; off++) {
    const counter = step + off;
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setUint32(4, counter >>> 0);
    view.setUint32(0, Math.floor(counter / 2 ** 32));
    const sig = new Uint8Array(await subtle.sign("HMAC", cryptoKey, buf));
    const offset = sig[sig.length - 1] & 0xf;
    const bin = ((sig[offset] & 0x7f) << 24) | (sig[offset + 1] << 16) | (sig[offset + 2] << 8) | sig[offset + 3];
    const otp = (bin % 1_000_000).toString().padStart(6, "0");
    if (otp === code) return true;
  }
  return false;
}

export function generateBackupCodes(n = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < n; i++) {
    const bytes = new Uint8Array(5);
    crypto.getRandomValues(bytes);
    codes.push(Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 10));
  }
  return codes;
}

export async function hashCode(code: string): Promise<string> {
  const buf = new TextEncoder().encode(code);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// === Active sessions ===
export async function recordSession(userId: string) {
  try {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
    await db.from("active_sessions").insert({ user_id: userId, user_agent: ua, device_label: detectDevice(ua ?? "") });
  } catch { /* ignore */ }
}

function detectDevice(ua: string): string {
  if (/iPhone|iPad/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown";
}
