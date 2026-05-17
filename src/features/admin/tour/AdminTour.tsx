import { useEffect, useLayoutEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { ADMIN_TOUR_STEPS } from "./steps";

const STORAGE_KEY = "lpp:admin-tour:v1";
const PAD = 8;
const CARD_W = 340;
const CARD_GAP = 14;

export function hasCompletedAdminTour(): boolean {
  if (typeof window === "undefined") return true;
  try { return window.localStorage.getItem(STORAGE_KEY) === "done"; } catch { return false; }
}
function markCompleted() {
  try { window.localStorage.setItem(STORAGE_KEY, "done"); } catch { /* noop */ }
}

type Rect = { top: number; left: number; width: number; height: number };

function getTargetEl(key: string | null): HTMLElement | null {
  if (!key || typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>(`[data-tour="${CSS.escape(key)}"]`);
}

/**
 * AdminTour — lightweight, dependency-free guided tour.
 * - Spotlight overlay (cuts target out of a dim layer using box-shadow).
 * - Bilingual + RTL aware via LanguageContext.
 * - Persists completion in localStorage.
 */
export function AdminTour({
  open,
  onClose,
  /** Called when the tour needs the mobile sidebar to be visible. */
  ensureSidebarOpen,
}: {
  open: boolean;
  onClose: () => void;
  ensureSidebarOpen?: () => void;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [tick, setTick] = useState(0);

  const step = ADMIN_TOUR_STEPS[idx];
  const total = ADMIN_TOUR_STEPS.length;

  // Reset to first step whenever (re)opened
  useEffect(() => { if (open) setIdx(0); }, [open]);

  // Open the mobile sidebar when a sidebar/nav target is needed.
  useEffect(() => {
    if (!open || !step) return;
    const needsSidebar = step.target === "sidebar" || step.target?.startsWith("nav:");
    if (needsSidebar && window.innerWidth < 1024) ensureSidebarOpen?.();
  }, [open, step, ensureSidebarOpen]);

  // Measure the target element on each step / on resize / scroll.
  useLayoutEffect(() => {
    if (!open) return;
    if (!step?.target) { setRect(null); return; }
    let raf = 0;
    const measure = () => {
      const el = getTargetEl(step.target);
      if (!el) { setRect(null); return; }
      try { el.scrollIntoView({ block: "center", inline: "nearest" }); } catch { /* noop */ }
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      });
    };
    measure();
    const onResize = () => setTick((t) => t + 1);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, step, tick, idx]);

  const next = useCallback(() => {
    if (idx >= total - 1) { markCompleted(); onClose(); return; }
    setIdx((i) => i + 1);
  }, [idx, total, onClose]);
  const prev = useCallback(() => setIdx((i) => Math.max(0, i - 1)), []);
  const skip = useCallback(() => { markCompleted(); onClose(); }, [onClose]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
      else if (e.key === "ArrowRight") (ar ? prev : next)();
      else if (e.key === "ArrowLeft") (ar ? next : prev)();
      else if (e.key === "Enter") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, next, prev, skip, ar]);

  if (!open || !step) return null;
  if (typeof document === "undefined") return null;

  // Compute card position
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let cardStyle: React.CSSProperties;
  if (!rect) {
    cardStyle = {
      position: "fixed",
      top: "50%", left: "50%",
      transform: "translate(-50%, -50%)",
      width: Math.min(CARD_W, vw - 24),
    };
  } else {
    // Prefer placement, otherwise auto: right of target on desktop, else below.
    const want = step.placement ?? "auto";
    const wantRight = want === "right" || (want === "auto" && vw >= 1024);
    let top = rect.top;
    let left = ar
      ? rect.left - CARD_W - CARD_GAP
      : rect.left + rect.width + CARD_GAP;
    let useBottom = !wantRight;
    if (wantRight) {
      const fits = ar ? left > 8 : left + CARD_W < vw - 8;
      if (!fits) useBottom = true;
    }
    if (useBottom) {
      top = rect.top + rect.height + CARD_GAP;
      left = Math.min(Math.max(8, rect.left), vw - CARD_W - 8);
      if (top + 220 > vh) top = Math.max(8, rect.top - 220 - CARD_GAP);
    } else {
      top = Math.min(Math.max(8, top), vh - 220);
    }
    cardStyle = { position: "fixed", top, left, width: Math.min(CARD_W, vw - 24) };
  }

  return createPortal(
    <div
      dir={ar ? "rtl" : "ltr"}
      className="fixed inset-0 z-[100] pointer-events-none"
      aria-live="polite"
    >
      {/* Dim overlay with cut-out spotlight */}
      {rect ? (
        <div
          className="fixed pointer-events-auto"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            borderRadius: 10,
            boxShadow:
              "0 0 0 9999px rgba(15, 23, 42, 0.62), 0 0 0 2px hsl(43 74% 49% / 0.9), 0 10px 30px -10px rgba(0,0,0,0.5)",
            transition: "all 220ms cubic-bezier(.22,.61,.36,1)",
          }}
          onClick={skip}
        />
      ) : (
        <div
          className="fixed inset-0 pointer-events-auto bg-slate-900/60"
          onClick={skip}
        />
      )}

      {/* Tooltip card */}
      <div
        className="pointer-events-auto rounded-xl border bg-white shadow-2xl"
        style={{
          ...cardStyle,
          borderColor: "hsl(43 74% 49% / 0.35)",
          background: "#ffffff",
        }}
        role="dialog"
        aria-modal="true"
      >
        <div className="px-5 pt-4 pb-3 border-b" style={{ borderColor: "hsl(43 74% 49% / 0.18)" }}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-medium tracking-[0.18em] uppercase text-black">
              {ar ? `الخطوة ${idx + 1} من ${total}` : `Step ${idx + 1} of ${total}`}
            </span>
            <button
              onClick={skip}
              className="text-xs text-black/60 hover:text-black transition"
            >
              {ar ? "تخطّي" : "Skip"}
            </button>
          </div>
          <h3 className="mt-2 font-serif text-base font-semibold leading-snug text-black">
            {ar ? step.title.ar : step.title.en}
          </h3>
        </div>
        <div className="px-5 py-4 text-sm leading-relaxed text-black">
          {ar ? step.body.ar : step.body.en}
        </div>
        <div className="flex items-center justify-between gap-2 px-5 pb-4">
          <button
            onClick={prev}
            disabled={idx === 0}
            className="rounded-md px-3 py-1.5 text-xs border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {ar ? "السابق" : "Back"}
          </button>
          <div className="flex items-center gap-1.5">
            {ADMIN_TOUR_STEPS.map((_, i) => (
              <span
                key={i}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === idx ? 18 : 6,
                  background:
                    i === idx
                      ? "hsl(43 74% 49%)"
                      : i < idx
                        ? "hsl(43 74% 49% / 0.5)"
                        : "hsl(var(--muted-foreground) / 0.3)",
                }}
              />
            ))}
          </div>
          <button
            onClick={next}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-white"
            style={{ background: "hsl(43 74% 49%)" }}
          >
            {idx === total - 1 ? (ar ? "إنهاء" : "Finish") : (ar ? "التالي" : "Next")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
