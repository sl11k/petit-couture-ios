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
import { classifyItem, trackEvent, type WishlistSource } from "@/lib/analytics";
import { useAuth } from "@/state/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "maisonnet:wishlist:v1";

type Ctx = {
  items: string[];
  has: (id: string) => boolean;
  toggle: (id: string, source?: WishlistSource) => void;
  add: (id: string, source?: WishlistSource) => void;
  remove: (id: string, source?: WishlistSource) => void;
  clear: (source?: WishlistSource) => void;
  merge: (ids: string[], source?: WishlistSource) => { added: number };
  /** Replace the entire list. Used for "Undo" reverts; emits a single analytics event. */
  restore: (snapshot: string[]) => void;
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

  // ─── Cloud sync ────────────────────────────────────────────────────────────
  // When a user signs in, union-merge local items with whatever is stored on the
  // server, then mirror every subsequent local change to the DB. When signed
  // out, the wishlist is purely local (existing behaviour).
  const { user } = useAuth();
  const userIdRef = useRef<string | null>(null);
  const syncedItemsRef = useRef<Set<string>>(new Set());
  const itemsRef = useRef<string[]>(items);
  itemsRef.current = items;

  useEffect(() => {
    let cancelled = false;
    const uid = user?.id ?? null;

    if (!uid) {
      // Signed out — clear sync tracking; keep local items as-is.
      userIdRef.current = null;
      syncedItemsRef.current = new Set();
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from("wishlist_items")
        .select("item_id")
        .eq("user_id", uid);
      if (cancelled) return;
      if (error) {
        // Network/RLS error — leave local items alone.
        // eslint-disable-next-line no-console
        console.error("[wishlist] load failed", error);
        return;
      }

      const serverIds = new Set((data ?? []).map((r) => r.item_id));
      const localIds = itemsRef.current;
      const onlyLocal = localIds.filter((id) => !serverIds.has(id));

      // Push local-only items to server.
      if (onlyLocal.length > 0) {
        const rows = onlyLocal.map((item_id) => ({ user_id: uid, item_id }));
        const { error: upsertErr } = await supabase
          .from("wishlist_items")
          .upsert(rows, { onConflict: "user_id,item_id" });
        if (upsertErr) {
          // eslint-disable-next-line no-console
          console.error("[wishlist] merge upsert failed", upsertErr);
        }
      }

      // Union locally so server-only items become visible.
      const union = Array.from(new Set([...localIds, ...serverIds]));

      userIdRef.current = uid;
      syncedItemsRef.current = new Set(union);

      if (
        union.length !== localIds.length ||
        union.some((v, i) => v !== localIds[i])
      ) {
        setItems(union);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Mirror local diffs to server (only after initial load completed).
  useEffect(() => {
    const uid = userIdRef.current;
    if (!uid) return;
    const synced = syncedItemsRef.current;
    const current = new Set(items);

    const toAdd: string[] = [];
    const toRemove: string[] = [];
    for (const id of current) if (!synced.has(id)) toAdd.push(id);
    for (const id of synced) if (!current.has(id)) toRemove.push(id);

    if (toAdd.length === 0 && toRemove.length === 0) return;

    syncedItemsRef.current = current;

    (async () => {
      if (toAdd.length > 0) {
        const rows = toAdd.map((item_id) => ({ user_id: uid, item_id }));
        const { error } = await supabase
          .from("wishlist_items")
          .upsert(rows, { onConflict: "user_id,item_id" });
        if (error) {
          // eslint-disable-next-line no-console
          console.error("[wishlist] add sync failed", error);
        }
      }
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from("wishlist_items")
          .delete()
          .eq("user_id", uid)
          .in("item_id", toRemove);
        if (error) {
          // eslint-disable-next-line no-console
          console.error("[wishlist] remove sync failed", error);
        }
      }
    })();
  }, [items]);

  const { t, isRTL } = useLanguage();
  const messages = useRef(t.wishlist);
  messages.current = t.wishlist;

  const has = useCallback((id: string) => items.includes(id), [items]);
  // Per-item feedback is handled by the persistent <WishlistBanner /> at the app
  // shell. Keep notify as a no-op so the existing call sites stay intact while
  // we avoid double feedback (banner + sonner toast).
  const notify = useCallback((_kind: "added" | "removed") => {
    void _kind;
    void isRTL;
  }, [isRTL]);
  const add = useCallback(
    (id: string, source: WishlistSource = "unknown") =>
      setItems((prev) => {
        if (prev.includes(id)) return prev;
        notify("added");
        const next = [...prev, id];
        const { kind, slug } = classifyItem(id);
        trackEvent({
          name: "wishlist_add",
          ts: Date.now(),
          itemId: id,
          itemKind: kind,
          itemSlug: slug,
          source,
          wishlistSize: next.length,
        });
        return next;
      }),
    [notify],
  );
  const remove = useCallback(
    (id: string, source: WishlistSource = "unknown") =>
      setItems((prev) => {
        if (!prev.includes(id)) return prev;
        notify("removed");
        const next = prev.filter((x) => x !== id);
        const { kind, slug } = classifyItem(id);
        trackEvent({
          name: "wishlist_remove",
          ts: Date.now(),
          itemId: id,
          itemKind: kind,
          itemSlug: slug,
          source,
          wishlistSize: next.length,
        });
        return next;
      }),
    [notify],
  );
  const toggle = useCallback(
    (id: string, source: WishlistSource = "unknown") =>
      setItems((prev) => {
        const { kind, slug } = classifyItem(id);
        if (prev.includes(id)) {
          notify("removed");
          const next = prev.filter((x) => x !== id);
          trackEvent({
            name: "wishlist_remove",
            ts: Date.now(),
            itemId: id,
            itemKind: kind,
            itemSlug: slug,
            source,
            wishlistSize: next.length,
          });
          return next;
        }
        notify("added");
        const next = [...prev, id];
        trackEvent({
          name: "wishlist_add",
          ts: Date.now(),
          itemId: id,
          itemKind: kind,
          itemSlug: slug,
          source,
          wishlistSize: next.length,
        });
        return next;
      }),
    [notify],
  );
  const clear = useCallback(
    (source: WishlistSource = "wishlist_screen") => {
      setItems((prev) => {
        if (prev.length === 0) return prev;
        toast(messages.current.cleared ?? messages.current.removed, {
          icon: <Heart className="h-4 w-4" strokeWidth={1.7} />,
          position: isRTL ? "top-left" : "top-right",
          duration: 1800,
        });
        trackEvent({
          name: "wishlist_clear",
          ts: Date.now(),
          previousSize: prev.length,
          source,
        });
        return [];
      });
    },
    [isRTL],
  );

  const merge = useCallback(
    (ids: string[], source: WishlistSource = "shared_link"): { added: number } => {
      let addedCount = 0;
      setItems((prev) => {
        const set = new Set(prev);
        const freshlyAdded: string[] = [];
        for (const id of ids) {
          if (typeof id === "string" && id && !set.has(id)) {
            set.add(id);
            freshlyAdded.push(id);
          }
        }
        addedCount = freshlyAdded.length;
        if (addedCount === 0) return prev;
        const next = Array.from(set);
        for (const id of freshlyAdded) {
          const { kind, slug } = classifyItem(id);
          trackEvent({
            name: "wishlist_add",
            ts: Date.now(),
            itemId: id,
            itemKind: kind,
            itemSlug: slug,
            source,
            wishlistSize: next.length,
          });
        }
        return next;
      });
      return { added: addedCount };
    },
    [],
  );

  const restore = useCallback((snapshot: string[]) => {
    setItems((prev) => {
      const cleaned = snapshot.filter(
        (v): v is string => typeof v === "string" && v.length > 0,
      );
      // No-op shortcut to avoid spurious renders.
      if (
        prev.length === cleaned.length &&
        prev.every((v, i) => v === cleaned[i])
      ) {
        return prev;
      }
      trackEvent({
        name: "wishlist_undo",
        ts: Date.now(),
        previousSize: prev.length,
        nextSize: cleaned.length,
      });
      return cleaned;
    });
  }, []);

  const value = useMemo<Ctx>(
    () => ({ items, has, toggle, add, remove, clear, merge, restore, count: items.length }),
    [items, has, toggle, add, remove, clear, merge, restore],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
