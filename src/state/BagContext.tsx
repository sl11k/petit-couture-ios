import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { trackServerEvent } from "@/lib/serverAnalytics";

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
};

type AddInput = Omit<BagItem, "id" | "qty"> & { qty?: number };

type Ctx = {
  items: BagItem[];
  add: (input: AddInput) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
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

  const add = useCallback((input: AddInput) => {
    const id = makeId(input.slug, input.size, input.color, input.variantId);
    const qty = input.qty ?? 1;
    setItems((prev) => {
      const existing = prev.find((p) => p.id === id);
      if (existing) {
        return prev.map((p) => (p.id === id ? { ...p, qty: p.qty + qty } : p));
      }
      return [...prev, { ...input, qty, id }];
    });
    void trackServerEvent("add_to_cart", {
      slug: input.slug,
      name: input.name,
      price: input.price,
      qty,
      size: input.size,
      color: input.color,
    });
  }, []);

  const remove = useCallback(
    (id: string) => setItems((prev) => prev.filter((p) => p.id !== id)),
    [],
  );

  const setQty = useCallback((id: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((p) => p.id !== id)
        : prev.map((p) => (p.id === id ? { ...p, qty } : p)),
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
