import { createContext, useContext, useState, type ReactNode } from "react";

type LiveEditState = {
  enabled: boolean;
  pageId: string | null;
  slug: string | null;
  start: (slug: string, pageId: string) => void;
  stop: () => void;
};

const Ctx = createContext<LiveEditState | null>(null);

export function LiveEditProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [pageId, setPageId] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  return (
    <Ctx.Provider
      value={{
        enabled,
        pageId,
        slug,
        start: (s, id) => {
          setSlug(s);
          setPageId(id);
          setEnabled(true);
        },
        stop: () => {
          setEnabled(false);
          setPageId(null);
          setSlug(null);
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useLiveEdit() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLiveEdit must be used inside LiveEditProvider");
  return v;
}
