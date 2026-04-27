// Loose-typed Supabase client for tables not yet in generated types.
// The generated types lag behind new migrations; we cast here to avoid
// rewriting every query with `as any`. Real safety comes from RLS + manual
// validation in handlers.
import { supabase } from "@/integrations/supabase/client";

export const db = supabase as unknown as {
  from: (table: string) => any;
  auth: typeof supabase.auth;
  storage: typeof supabase.storage;
};
