import { cn } from "@/lib/utils";

/**
 * ApplePayBadge — شارة Apple Pay الرسمية المُختصرة
 * تُعرض في صفحات المنتج وCheckout عند توفر الجهاز/المتصفح المدعوم.
 * استخدم متغير `compact` للظهور بجوار السعر.
 */
export function ApplePayBadge({
  variant = "default",
  className,
}: {
  variant?: "default" | "compact" | "button";
  className?: string;
}) {
  if (variant === "button") {
    return (
      <button
        type="button"
        className={cn(
          "w-full h-12 rounded-lg bg-black text-white font-medium",
          "flex items-center justify-center gap-1 active:bg-black/80 transition",
          className,
        )}
        aria-label="Pay with Apple Pay"
      >
        <span className="text-sm"></span>
        <span className="text-sm">Pay</span>
      </button>
    );
  }
  if (variant === "compact") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded bg-black text-white px-2 py-0.5 text-[11px]",
          className,
        )}
      >
        <span></span> Pay
      </span>
    );
  }
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md bg-black text-white px-3 py-1.5 text-xs",
        className,
      )}
    >
      <span className="text-sm"></span>
      <span>Pay متاح</span>
    </div>
  );
}

/** كشف توفر Apple Pay في المتصفح */
export function useApplePayAvailable(): boolean {
  if (typeof window === "undefined") return false;
  // @ts-expect-error - ApplePaySession is Safari-only
  return Boolean(window.ApplePaySession?.canMakePayments?.());
}
