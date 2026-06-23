import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // CRITICAL: subscribe BEFORE getSession so we don't miss the initial event.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    // Check lockout before attempting
    const { checkLockout, registerFailedLogin, recordSession } = await import("@/lib/security");
    const lock = await checkLockout(email);
    if (lock.locked) {
      const until = lock.locked_until ? new Date(lock.locked_until).toLocaleString("ar") : "";
      throw new Error(`الحساب مقفل مؤقتًا بسبب محاولات متكررة. حتى: ${until}`);
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      try {
        const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
        await supabase.from("failed_login_attempts").insert({
          email, user_agent: ua, reason: error.message, metadata: { code: (error as any).code ?? null },
        });
        await registerFailedLogin(email);
      } catch { /* ignore */ }
      throw error;
    }
    // Success: log + record session
    const { logAudit } = await import("@/lib/audit");
    await logAudit({ action: "auth.login", entity: "user", metadata: { email } });
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await recordSession(user.id);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/account` : undefined;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    try {
      const { logAudit } = await import("@/lib/audit");
      await logAudit({ action: "auth.logout", entity: "user" });
    } catch { /* ignore */ }
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({ user: session?.user ?? null, session, ready, signIn, signUp, signOut }),
    [session, ready, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
