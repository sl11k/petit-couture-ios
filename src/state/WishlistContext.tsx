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
import { toast } from "sonner";
import { Heart } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

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

  const { t, isRTL } = useLanguage();
  const messages = useRef(t.wishlist);
  messages.current = t.wishlist;

  const has = useCallback((id: string) => items.includes(id), [items]);
  const notify = useCallback(
    (kind: "added" | "removed") => {
      const msg = kind === "added" ? messages.current.added : messages.current.removed;
      toast(msg, {
        icon: <Heart className="h-4 w-4" strokeWidth={1.7} fill={kind === "added" ? "currentColor" : "none"} />,
        position: isRTL ? "top-left" : "top-right",
        duration: 1800,
      });
    },
    [isRTL],
  );
  const add = useCallback(
    (id: string) =>
      setItems((prev) => {
        if (prev.includes(id)) return prev;
        notify("added");
        return [...prev, id];
      }),
    [notify],
  );
  const remove = useCallback(
    (id: string) =>
      setItems((prev) => {
        if (!prev.includes(id)) return prev;
        notify("removed");
        return prev.filter((x) => x !== id);
      }),
    [notify],
  );
  const toggle = useCallback(
    (id: string) =>
      setItems((prev) => {
        if (prev.includes(id)) {
          notify("removed");
          return prev.filter((x) => x !== id);
        }
        notify("added");
        return [...prev, id];
      }),
    [notify],
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
