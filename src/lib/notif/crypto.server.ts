// Server-only encryption for notification provider credentials.
// Uses AES-GCM with a key derived from NOTIF_ENCRYPTION_KEY via SHA-256.
// Format: "v1:<base64(iv)>:<base64(ciphertext)>"

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.NOTIF_ENCRYPTION_KEY;
  if (!secret) throw new Error("NOTIF_ENCRYPTION_KEY is not configured");
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function b64encode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64decode(str: string): Uint8Array {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encryptSecret(plain: string): Promise<string> {
  if (!plain) return "";
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plain),
  );
  return `v1:${b64encode(iv)}:${b64encode(ct)}`;
}

export async function decryptSecret(payload: string | null | undefined): Promise<string> {
  if (!payload) return "";
  const parts = payload.split(":");
  if (parts.length !== 3 || parts[0] !== "v1") {
    // Legacy / plaintext — return as-is so migrations work.
    return payload;
  }
  const iv = b64decode(parts[1]);
  const ct = b64decode(parts[2]);
  const key = await getKey();
  const ivBuf = new ArrayBuffer(iv.byteLength); new Uint8Array(ivBuf).set(iv);
  const ctBuf = new ArrayBuffer(ct.byteLength); new Uint8Array(ctBuf).set(ct);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBuf }, key, ctBuf);
  return new TextDecoder().decode(plain);
}

export function maskSecret(plain: string): string {
  if (!plain) return "";
  if (plain.length <= 8) return "••••";
  return plain.slice(0, 4) + "••••" + plain.slice(-4);
}
