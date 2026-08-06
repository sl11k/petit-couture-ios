import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { trackServerEvent, getCurrentSessionId } from "@/lib/serverAnalytics";
import { pixelTrack } from "@/lib/pixels";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "maisonnet:bag:v1";


export type BagItem = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  price: number;
  currency: string;
  image: string;
  size: string;
  color: string;
  qty: number;
  sku?: string;
  variantId?: string;
  variantLabel?: string;
  stockLimit?: number;
};

type AddInput = Omit<BagItem, "id" | "qty"> & { qty?: number };

type Ctx = {
  items: BagItem[];
  add: (input: AddInput) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number, stockLimit?: number | null) => void;
  updatePrice: (id: string, price: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
  currency: string;
};

const BagContext = createContext<Ctx | null>(null);

function makeId(slug: string, size: string, color: string, variantId?: string) {
  return variantId ? `${slug}::v::${variantId}` : `${slug}::${size}::${color}`;
}

function normalizeStockLimit(stockLimit?: number | null) {
  if (stockLimit === null || stockLimit === undefined) return undefined;
  const limit = Math.floor(Number(stockLimit));
  return Number.isFinite(limit) && limit >= 0 ? limit : undefined;
}

function clampToStock(qty: number, stockLimit?: number) {
  const cleanQty = Math.max(0, Math.floor(Number(qty) || 0));
  if (stockLimit === undefined) return cleanQty;
  return Math.min(cleanQty, stockLimit);
}

function readInitial(): BagItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BagItem[]) : [];
  } catch {
    return [];
  }
}

export function BagProvider({ children }: { children: ReactNode }) {
  // Always start empty so SSR HTML matches the first client render.
  // Hydrate from localStorage after mount to avoid hydration mismatches.
  const [items, setItems] = useState<BagItem[]>([]);

  useEffect(() => {
    const stored = readInitial();
    if (stored.length) setItems(stored);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* noop */
    }
  }, [items]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      try {
        const next = e.newValue ? JSON.parse(e.newValue) : [];
        if (Array.isArray(next)) setItems(next);
      } catch {
        /* noop */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Snapshot the cart into abandoned_carts whenever it changes (debounced).
  // Guests and signed-in users alike get captured, so the Abandoned page
  // reflects real drop-offs — not just users who reached checkout.
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(async () => {
      try {
        const session_id = getCurrentSessionId();
        if (!session_id || session_id === "ssr") return;
        const { data: auth } = await supabase.auth.getUser();
        const user_id = auth.user?.id ?? null;
        const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);

        if (items.length === 0) {
          // Empty cart: leave prior snapshots alone (they represent past drop-offs).
          return;
        }

        await (supabase.from("abandoned_carts") as any).upsert(
          {
            session_id,
            user_id,
            email: auth.user?.email ?? null,
            items: items.map((i) => ({
              slug: i.slug,
              name: i.name,
              brand: i.brand,
              image: i.image,
              price: i.price,
              qty: i.qty,
              size: i.size,
              color: i.color,
              sku: i.sku ?? null,
              variant_id: i.variantId ?? null,
              variant_label: i.variantLabel ?? null,
            })),
            subtotal,
            currency: items[0]?.currency ?? "SAR",
            stage: "cart",
            converted: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "session_id" },
        );

      } catch {
        /* best effort */
      }
    }, 1500);
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [items]);

  const add = useCallback((input: AddInput) => {

    const id = makeId(input.slug, input.size, input.color, input.variantId);
    const limit = normalizeStockLimit(input.stockLimit);
    const qty = clampToStock(input.qty ?? 1, limit);
    if (qty <= 0) return;
    setItems((prev) => {
      const existing = prev.find((p) => p.id === id);
      if (existing) {
        const nextLimit = limit ?? normalizeStockLimit(existing.stockLimit);
        return prev.map((p) =>
          p.id === id
            ? { ...p, ...input, id, stockLimit: nextLimit, qty: clampToStock(p.qty + qty, nextLimit) }
            : p,
        );
      }
      return [...prev, { ...input, stockLimit: limit, qty, id }];
    });
    void trackServerEvent("add_to_cart", {
      slug: input.slug,
      name: input.name,
      price: input.price,
      qty,
      size: input.size,
      color: input.color,
    });
    pixelTrack("AddToCart", {
      content_name: input.name,
      content_id: input.id || input.slug,
      value: input.price * qty,
      currency: input.currency || "SAR",
      quantity: qty
    });
  }, []);

  const remove = useCallback(
    (id: string) => setItems((prev) => prev.filter((p) => p.id !== id)),
    [],
  );

  const setQty = useCallback((id: string, qty: number, stockLimit?: number | null) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((p) => p.id !== id)
        : prev.map((p) => {
            if (p.id !== id) return p;
            const nextLimit = normalizeStockLimit(stockLimit) ?? normalizeStockLimit(p.stockLimit);
            return { ...p, stockLimit: nextLimit, qty: clampToStock(qty, nextLimit) };
          }),
    );
  }, []);

  const updatePrice = useCallback((id: string, price: number) => {
    setItems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, price } : p)),
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<Ctx>(() => {
    const count = items.reduce((s, i) => s + i.qty, 0);
    const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
    const currency = items[0]?.currency ?? "SAR";
    return { items, add, remove, setQty, updatePrice, clear, count, subtotal, currency };
  }, [items, add, remove, setQty, updatePrice, clear]);

  return <BagContext.Provider value={value}>{children}</BagContext.Provider>;
}

export function useBag() {
  const ctx = useContext(BagContext);
  if (!ctx) throw new Error("useBag must be used within BagProvider");
  return ctx;
}
