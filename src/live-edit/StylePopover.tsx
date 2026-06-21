import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Type, Palette, X } from "lucide-react";

export type StyleValue = Record<string, string>;

/**
 * Floating mini panel that edits inline CSS on the selected element.
 * Used by SiteInlineEditor to give admins quick visual control over
 * any element they click — text color, background, size, weight, padding.
 */
export function StylePopover({
  el,
  initial,
  onChange,
  onClose,
}: {
  el: HTMLElement;
  initial: StyleValue;
  onChange: (next: StyleValue) => void;
  onClose: () => void;
}) {
  const [style, setStyle] = useState<StyleValue>(initial);
  const [tab, setTab] = useState<"text" | "box">("text");

  useEffect(() => setStyle(initial), [initial]);

  const set = (k: string, v: string) => {
    const next = { ...style, [k]: v };
    setStyle(next);
    el.style.setProperty(k, v);
    onChange(next);
  };

  // Position next to the selected element
  const rect = el.getBoundingClientRect();
  const top = Math.min(window.innerHeight - 280, Math.max(8, rect.bottom + 8));
  const left = Math.min(window.innerWidth - 280, Math.max(8, rect.left));

  return (
    <div
      data-lpe-ui
      className="fixed z-[90] w-[268px] rounded-xl border border-border bg-background shadow-2xl p-3"
      style={{ top, left }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-1">
          <button
            onClick={() => setTab("text")}
            className={`h-7 px-2 rounded-md text-[11px] inline-flex items-center gap-1 ${tab === "text" ? "bg-foreground text-background" : "hover:bg-muted"}`}
          >
            <Type className="h-3 w-3" /> نص
          </button>
          <button
            onClick={() => setTab("box")}
            className={`h-7 px-2 rounded-md text-[11px] inline-flex items-center gap-1 ${tab === "box" ? "bg-foreground text-background" : "hover:bg-muted"}`}
          >
            <Palette className="h-3 w-3" /> صندوق
          </button>
        </div>
        <button onClick={onClose} className="h-6 w-6 grid place-items-center rounded hover:bg-muted">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {tab === "text" && (
        <div className="space-y-2.5">
          <Row label="لون النص">
            <input
              type="color"
              value={toHex(style["color"]) || "#000000"}
              onChange={(e) => set("color", e.target.value)}
              className="h-7 w-12 rounded border border-border"
            />
          </Row>
          <Row label="حجم الخط">
            <input
              type="range"
              min={10}
              max={64}
              value={parseInt(style["font-size"] || getComputedStyle(el).fontSize) || 16}
              onChange={(e) => set("font-size", `${e.target.value}px`)}
              className="flex-1 accent-foreground"
            />
            <span className="text-[11px] text-muted-foreground w-10 text-end">{style["font-size"] || "—"}</span>
          </Row>
          <Row label="وزن الخط">
            <select
              value={style["font-weight"] || "400"}
              onChange={(e) => set("font-weight", e.target.value)}
              className="flex-1 h-7 rounded border border-border bg-background text-[12px] px-2"
            >
              <option value="300">رفيع</option>
              <option value="400">عادي</option>
              <option value="500">متوسط</option>
              <option value="600">شبه عريض</option>
              <option value="700">عريض</option>
              <option value="800">أعرض</option>
            </select>
          </Row>
          <Row label="المحاذاة">
            <div className="flex gap-1 flex-1">
              {(["start", "center", "end"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => set("text-align", a)}
                  className={`flex-1 h-7 rounded border text-[11px] ${style["text-align"] === a ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted"}`}
                >
                  {a === "start" ? "بداية" : a === "center" ? "وسط" : "نهاية"}
                </button>
              ))}
            </div>
          </Row>
        </div>
      )}

      {tab === "box" && (
        <div className="space-y-2.5">
          <Row label="لون الخلفية">
            <input
              type="color"
              value={toHex(style["background-color"]) || "#ffffff"}
              onChange={(e) => set("background-color", e.target.value)}
              className="h-7 w-12 rounded border border-border"
            />
            <button
              onClick={() => set("background-color", "transparent")}
              className="h-7 px-2 rounded border border-border text-[11px] hover:bg-muted"
            >
              شفاف
            </button>
          </Row>
          <Row label="حشو داخلي">
            <input
              type="range"
              min={0}
              max={64}
              value={parseInt(style["padding"] || "0") || 0}
              onChange={(e) => set("padding", `${e.target.value}px`)}
              className="flex-1 accent-foreground"
            />
            <span className="text-[11px] text-muted-foreground w-10 text-end">{style["padding"] || "—"}</span>
          </Row>
          <Row label="استدارة الحواف">
            <input
              type="range"
              min={0}
              max={48}
              value={parseInt(style["border-radius"] || "0") || 0}
              onChange={(e) => set("border-radius", `${e.target.value}px`)}
              className="flex-1 accent-foreground"
            />
            <span className="text-[11px] text-muted-foreground w-10 text-end">{style["border-radius"] || "—"}</span>
          </Row>
          <Row label="لون الحدود">
            <input
              type="color"
              value={toHex(style["border-color"]) || "#e5e5e5"}
              onChange={(e) => {
                set("border-color", e.target.value);
                if (!style["border-width"]) set("border-width", "1px");
                if (!style["border-style"]) set("border-style", "solid");
              }}
              className="h-7 w-12 rounded border border-border"
            />
          </Row>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-muted-foreground w-20 shrink-0">{label}</span>
      {children}
    </div>
  );
}

function toHex(v: string | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  if (s.startsWith("#")) return s.length === 7 ? s : null;
  const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  const toh = (n: string) => parseInt(n).toString(16).padStart(2, "0");
  return `#${toh(m[1])}${toh(m[2])}${toh(m[3])}`;
}
