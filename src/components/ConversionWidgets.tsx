import { useEffect, useState } from "react";
import { Shield, Truck, RefreshCw, Award, Lock } from "lucide-react";

const ICONS: Record<string, any> = {
  "دفع آمن": Lock, "شحن سريع": Truck, "استرجاع خلال 14 يوم": RefreshCw,
  "ضمان الجودة": Shield, "ضمان أصلي": Award,
};

export function TrustBadges({ badges, compact }: { badges: string[]; compact?: boolean }) {
  if (!badges || badges.length === 0) return null;
  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-4" : "grid-cols-2 sm:grid-cols-4"}`}>
      {badges.map((b) => {
        const Icon = ICONS[b] ?? Shield;
        return (
          <div key={b} className="flex flex-col items-center justify-center gap-1 rounded-lg border border-border bg-card p-2 text-center">
            <Icon className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-medium leading-tight">{b}</span>
          </div>
        );
      })}
    </div>
  );
}

export function StarRating({ value, size = 14, count }: { value: number; size?: number; count?: number }) {
  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24"
            fill={value >= i ? "#f59e0b" : value >= i - 0.5 ? "url(#half)" : "none"}
            stroke="#f59e0b" strokeWidth="2">
            <defs>
              <linearGradient id="half"><stop offset="50%" stopColor="#f59e0b" /><stop offset="50%" stopColor="transparent" /></linearGradient>
            </defs>
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        ))}
      </div>
      {typeof count === "number" && <span className="text-[11px] text-muted-foreground">({count})</span>}
    </div>
  );
}

export function FreeShippingBar({ subtotal, threshold, currency = "ر.س" }: { subtotal: number; threshold: number; currency?: string }) {
  if (!threshold || threshold <= 0) return null;
  const remaining = Math.max(0, threshold - subtotal);
  const pct = Math.min(100, (subtotal / threshold) * 100);
  if (remaining === 0) {
    return (
      <div className="rounded-lg border border-emerald-300/40 bg-emerald-50 p-2 text-center text-xs font-medium text-emerald-700 dark:bg-emerald-950/30">
        🎉 رائع! حصلت على شحن مجاني
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-card p-2">
      <p className="mb-1 text-xs">أضف <b>{remaining.toFixed(0)} {currency}</b> للحصول على شحن مجاني 🚚</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function LowStockBadge({ stock, threshold = 5 }: { stock: number; threshold?: number }) {
  if (stock <= 0) return <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">نفد المخزون</span>;
  if (stock <= threshold) return <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 animate-pulse">متبقي {stock} فقط ⚡</span>;
  return null;
}

export function CountdownTimer({ endsAt }: { endsAt: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  const diff = new Date(endsAt).getTime() - now;
  if (diff <= 0) return null;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return (
    <div className="flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-700 dark:bg-rose-950/20">
      ⏰ ينتهي خلال:
      {d > 0 && <span className="font-mono font-semibold">{d}ي</span>}
      <span className="font-mono font-semibold">{String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</span>
    </div>
  );
}

import { useEffect, useState } from "react";
