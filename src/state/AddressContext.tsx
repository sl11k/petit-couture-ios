import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "maisonnet:address:v1";

export type Address = {
  fullName: string;
  phone: string;
  email: string;
  shortCode: string;
  buildingNumber: string;
  street: string;
  district: string;
  city: string;
  postalCode: string;
  additionalNumber: string;
  notes?: string;
};

type Ctx = {
  address: Address | null;
  save: (a: Address) => void;
  clear: () => void;
};

const AddressContext = createContext<Ctx | null>(null);

function readInitial(): Address | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Address) : null;
  } catch {
    return null;
  }
}

export function AddressProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<Address | null>(() => readInitial());

  useEffect(() => {
    const stored = readInitial();
    if (stored) setAddress(stored);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (address) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(address));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
  }, [address]);

  const save = useCallback((a: Address) => setAddress(a), []);
  const clear = useCallback(() => setAddress(null), []);

  const value = useMemo<Ctx>(() => ({ address, save, clear }), [address, save, clear]);

  return <AddressContext.Provider value={value}>{children}</AddressContext.Provider>;
}

export function useAddress() {
  const ctx = useContext(AddressContext);
  if (!ctx) throw new Error("useAddress must be used within AddressProvider");
  return ctx;
}
