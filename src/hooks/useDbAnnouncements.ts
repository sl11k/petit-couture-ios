import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DbAnnouncement = {
  id: string;
  message_ar: string;
  message_en: string;
  sort_order: number;
};

/**
 * Fetches active announcement messages from the DB, ordered by sort_order.
 * Falls back to the provided `fallback` array if the DB is empty.
 */
export function useDbAnnouncements(fallback: string[], lang: "ar" | "en") {
  const [messages, setMessages] = useState<string[]>(fallback);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("announcement_messages")
        .select("id, message_ar, message_en, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (cancelled) return;
      const rows = (data as DbAnnouncement[]) ?? [];
      if (rows.length === 0) {
        setMessages(fallback);
        return;
      }
      setMessages(rows.map((r) => (lang === "ar" ? r.message_ar : r.message_en)).filter(Boolean));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  return messages;
}
