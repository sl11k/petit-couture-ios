import { useEffect } from "react";
import { MessageSquare, Mail, Share2, Link as LinkIcon, X } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

export type ShareSheetPayload = {
  /** The deep link URL to share. */
  url: string;
  /** Subject line — used by Email and as the native share title. */
  title: string;
  /** Body preview shown in the sheet and prepended to message/email bodies. */
  message: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  payload: ShareSheetPayload | null;
};

/** Detect iOS so we can prefer the iMessage-friendly `&body=` separator. */
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/** SMS deep link that works on iMessage (iOS) and Android Messages. */
function buildSmsHref(body: string): string {
  // iOS: sms:&body=...   Android: sms:?body=...
  const sep = isIOS() ? "&" : "?";
  return `sms:${sep}body=${encodeURIComponent(body)}`;
}

function buildMailHref(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function ShareSheet({ open, onClose, payload }: Props) {
  const { t, isRTL } = useLanguage();

  // Lock body scroll while open + close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !payload) return null;

  const { url, title, message } = payload;
  const fullBody = `${message}\n\n${url}`;
  const position = isRTL ? ("top-left" as const) : ("top-right" as const);

  const labels = {
    heading: isRTL ? "مشاركة" : "Share",
    preview: isRTL ? "معاينة الرسالة" : "Message preview",
    sms: isRTL ? "الرسائل النصية" : "Messages",
    email: isRTL ? "البريد الإلكتروني" : "Email",
    native: isRTL ? "خيارات أخرى" : "More options",
    copy: isRTL ? "نسخ الرابط" : "Copy link",
    close: isRTL ? "إغلاق" : "Close",
  };

  const closeAfter = (fn: () => void | Promise<void>) => async () => {
    try {
      await fn();
    } finally {
      onClose();
    }
  };

  const onSms = closeAfter(() => {
    if (typeof window !== "undefined") {
      window.location.href = buildSmsHref(fullBody);
    }
  });

  const onEmail = closeAfter(() => {
    if (typeof window !== "undefined") {
      window.location.href = buildMailHref(title, fullBody);
    }
  });

  const onNative = closeAfter(async () => {
    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    if (nav && typeof nav.share === "function") {
      try {
        await nav.share({ title, text: message, url });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    // Fall back to copy if native share is unavailable
    try {
      await nav?.clipboard?.writeText(url);
      toast(t.wishlist.linkCopied, {
        icon: <LinkIcon className="h-4 w-4" strokeWidth={1.7} />,
        position,
        duration: 1800,
      });
    } catch {
      toast(t.wishlist.shareFailed, { position, duration: 2200 });
    }
  });

  const onCopy = closeAfter(async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast(t.wishlist.linkCopied, {
        icon: <LinkIcon className="h-4 w-4" strokeWidth={1.7} />,
        position,
        duration: 1800,
      });
    } catch {
      toast(t.wishlist.shareFailed, { position, duration: 2200 });
    }
  });

  const options: {
    key: string;
    label: string;
    Icon: typeof MessageSquare;
    onClick: () => void;
  }[] = [
    { key: "sms", label: labels.sms, Icon: MessageSquare, onClick: onSms },
    { key: "email", label: labels.email, Icon: Mail, onClick: onEmail },
    { key: "native", label: labels.native, Icon: Share2, onClick: onNative },
    { key: "copy", label: labels.copy, Icon: LinkIcon, onClick: onCopy },
  ];

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={labels.heading}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label={labels.close}
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm animate-in fade-in duration-200"
      />

      {/* Sheet — anchored to bottom of the iOS frame */}
      <div className="relative w-full max-w-[440px] flex items-end pointer-events-none">
        <div className="pointer-events-auto w-full bg-background rounded-t-[28px] border-t border-x border-gold-soft shadow-soft pb-8 animate-in slide-in-from-bottom-4 duration-300">
          {/* Grabber */}
          <div className="pt-3 flex justify-center">
            <span className="h-[5px] w-10 rounded-full bg-foreground/15" />
          </div>

          {/* Header */}
          <div className="px-6 pt-3 flex items-center justify-between">
            <span className="text-[10.5px] tracking-luxury text-gold-deep">
              {isRTL ? labels.heading : labels.heading.toUpperCase()}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label={labels.close}
              className="h-9 w-9 -me-2 grid place-items-center rounded-xl text-foreground/70 active:scale-95 transition"
            >
              <X className="h-[18px] w-[18px]" strokeWidth={1.6} />
            </button>
          </div>

          <h2 className="px-6 mt-1 font-serif text-[24px] leading-tight text-foreground">
            {title}
          </h2>

          {/* Message preview */}
          <div className="mx-6 mt-4 rounded-[20px] border border-gold-soft bg-cream-warm/60 p-4">
            <p className="text-[10px] tracking-luxury text-gold-deep">
              {isRTL ? labels.preview : labels.preview.toUpperCase()}
            </p>
            <p
              className={[
                "mt-2 font-serif italic text-[15px] leading-snug text-foreground",
                isRTL ? "text-right" : "text-left",
              ].join(" ")}
            >
              {message}
            </p>
            <p
              className={[
                "mt-2 text-[12px] text-muted-foreground tracking-soft break-all",
                isRTL ? "text-right" : "text-left",
              ].join(" ")}
              dir="ltr"
            >
              {url}
            </p>
          </div>

          {/* Channels */}
          <div className="px-6 mt-5 grid grid-cols-4 gap-3">
            {options.map(({ key, label, Icon, onClick }) => (
              <button
                key={key}
                type="button"
                onClick={onClick}
                className="flex flex-col items-center gap-2 active:scale-95 transition"
              >
                <span className="h-14 w-14 rounded-xl grid place-items-center bg-cream-warm border border-gold-soft text-gold-deep">
                  <Icon className="h-[20px] w-[20px]" strokeWidth={1.6} />
                </span>
                <span className="text-[11px] text-foreground/80 tracking-soft text-center leading-tight">
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
