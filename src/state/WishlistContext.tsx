import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "maisonnet:wishlist:v1";

type Ctx = {
  items: string[];
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  add: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  count: number;
};

const WishlistContext = createContext<Ctx | null>(null);

function readInitial(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<string[]>(() => readInitial());

  // Hydrate after mount in case SSR rendered with empty state
  useEffect(() => {
    const stored = readInitial();
    if (stored.length) setItems(stored);
  }, []);

  // Persist on change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // quota or privacy mode — ignore
    }
  }, [items]);

  // Sync across tabs
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

  const has = useCallback((id: string) => items.includes(id), [items]);
  const add = useCallback(
    (id: string) => setItems((prev) => (prev.includes(id) ? prev : [...prev, id])),
    [],
  );
  const remove = useCallback(
    (id: string) => setItems((prev) => prev.filter((x) => x !== id)),
    [],
  );
  const toggle = useCallback(
    (id: string) =>
      setItems((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    [],
  );
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<Ctx>(
    () => ({ items, has, toggle, add, remove, clear, count: items.length }),
    [items, has, toggle, add, remove, clear],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
