import { useEffect, useState } from "react";
import { LayoutGrid, Palette, RotateCcw, Sparkles, Type, X } from "lucide-react";

export type StyleValue = Record<string, string>;
type Tab = "text" | "box" | "layout" | "effects";

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
  const [tab, setTab] = useState<Tab>("text");
  useEffect(() => setStyle(initial), [initial]);
  const set = (key: string, value: string) => {
    const next = { ...style, [key]: value };
    setStyle(next);
    el.style.setProperty(key, value);
    onChange(next);
  };
  const reset = () => {
    Object.keys(style).forEach((key) => el.style.removeProperty(key));
    setStyle({});
    onChange({});
  };
  const tabs: Array<[Tab, typeof Type, string]> = [
    ["text", Type, "نص"],
    ["box", Palette, "صندوق"],
    ["layout", LayoutGrid, "تخطيط"],
    ["effects", Sparkles, "تأثيرات"],
  ];
  return (
    <aside
      data-lpe-ui
      data-testid="live-design-inspector"
      dir="rtl"
      className="fixed z-[10001] top-24 end-4 w-[340px] max-h-[calc(100vh-8rem)] overflow-auto rounded-2xl border border-white/10 bg-[#211b1d]/[.98] text-white shadow-2xl p-4"
    >
      <header className="flex items-start justify-between mb-3">
        <div>
          <small className="text-[9px] tracking-[.18em] text-white/45">DESIGN INSPECTOR</small>
          <div className="text-sm font-semibold mt-1">
            {el.tagName.toLowerCase()} · {el.textContent?.trim().slice(0, 24) || "عنصر"}
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={reset}
            title="إعادة تنسيق العنصر"
            className="h-7 w-7 grid place-items-center rounded-lg hover:bg-white/10"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onClose}
            className="h-7 w-7 grid place-items-center rounded-lg hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>
      <nav className="grid grid-cols-4 gap-1 rounded-xl bg-white/[.06] p-1 mb-4">
        {tabs.map(([value, Icon, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`h-9 rounded-lg text-[10px] inline-flex justify-center items-center gap-1 ${tab === value ? "bg-white text-[#211b1d]" : "text-white/65 hover:bg-white/10"}`}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </nav>
      {tab === "text" && (
        <Panel>
          <ColorRow
            label="لون النص"
            value={style.color || getComputedStyle(el).color}
            onChange={(v) => set("color", v)}
          />
          <RangeRow
            label="حجم الخط"
            value={style["font-size"] || getComputedStyle(el).fontSize}
            min={8}
            max={120}
            onChange={(v) => set("font-size", `${v}px`)}
          />
          <SelectRow
            label="وزن الخط"
            value={style["font-weight"] || getComputedStyle(el).fontWeight}
            options={["300", "400", "500", "600", "700", "800"]}
            labels={["رفيع", "عادي", "متوسط", "شبه عريض", "عريض", "ثقيل"]}
            onChange={(v) => set("font-weight", v)}
          />
          <RangeRow
            label="تباعد الحروف"
            value={style["letter-spacing"]}
            min={-2}
            max={16}
            onChange={(v) => set("letter-spacing", `${v}px`)}
          />
          <RangeRow
            label="ارتفاع السطر"
            value={style["line-height"] ? String(Number(style["line-height"]) * 10) : "15"}
            min={8}
            max={30}
            onChange={(v) => set("line-height", String(v / 10))}
          />
          <SelectRow
            label="المحاذاة"
            value={style["text-align"] || "start"}
            options={["start", "center", "end", "justify"]}
            labels={["بداية", "وسط", "نهاية", "ضبط"]}
            onChange={(v) => set("text-align", v)}
          />
          <SelectRow
            label="تحويل النص"
            value={style["text-transform"] || "none"}
            options={["none", "uppercase", "lowercase", "capitalize"]}
            labels={["بدون", "كبير", "صغير", "أول حرف"]}
            onChange={(v) => set("text-transform", v)}
          />
        </Panel>
      )}
      {tab === "box" && (
        <Panel>
          <ColorRow
            label="لون الخلفية"
            value={style["background-color"] || getComputedStyle(el).backgroundColor}
            onChange={(v) => set("background-color", v)}
          />
          <ColorRow
            label="لون الحدود"
            value={style["border-color"] || getComputedStyle(el).borderColor}
            onChange={(v) => {
              set("border-color", v);
              if (!style["border-style"]) set("border-style", "solid");
            }}
          />
          <RangeRow
            label="سمك الحدود"
            value={style["border-width"]}
            max={12}
            onChange={(v) => set("border-width", `${v}px`)}
          />
          <RangeRow
            label="استدارة الحواف"
            value={style["border-radius"]}
            max={100}
            onChange={(v) => set("border-radius", `${v}px`)}
          />
          <TextRow
            label="صورة الخلفية"
            value={(style["background-image"] || "").replace(/^url\(["']?|["']?\)$/g, "")}
            placeholder="https://…"
            onChange={(v) => set("background-image", v ? `url(${v})` : "none")}
          />
          <SelectRow
            label="حجم الخلفية"
            value={style["background-size"] || "cover"}
            options={["cover", "contain", "auto", "100% 100%"]}
            onChange={(v) => set("background-size", v)}
          />
        </Panel>
      )}
      {tab === "layout" && (
        <Panel>
          <SelectRow
            label="العرض"
            value={style.width || "auto"}
            options={["auto", "100%", "75%", "50%", "fit-content"]}
            onChange={(v) => set("width", v)}
          />
          <TextRow
            label="أقصى عرض"
            value={style["max-width"] || ""}
            placeholder="1200px"
            onChange={(v) => set("max-width", v)}
          />
          <TextRow
            label="أقل ارتفاع"
            value={style["min-height"] || ""}
            placeholder="400px"
            onChange={(v) => set("min-height", v)}
          />
          <RangeRow
            label="المسافة الداخلية"
            value={style.padding}
            max={120}
            onChange={(v) => set("padding", `${v}px`)}
          />
          <RangeRow
            label="المسافة الخارجية"
            value={style.margin}
            max={120}
            onChange={(v) => set("margin", `${v}px`)}
          />
          <RangeRow
            label="الفجوات"
            value={style.gap}
            max={80}
            onChange={(v) => set("gap", `${v}px`)}
          />
          <SelectRow
            label="نوع العرض"
            value={style.display || getComputedStyle(el).display}
            options={["block", "flex", "grid", "inline-flex", "none"]}
            onChange={(v) => set("display", v)}
          />
          <SelectRow
            label="محاذاة العناصر"
            value={style["align-items"] || "stretch"}
            options={["stretch", "start", "center", "end"]}
            onChange={(v) => set("align-items", v)}
          />
          <SelectRow
            label="توزيع العناصر"
            value={style["justify-content"] || "start"}
            options={["start", "center", "end", "space-between", "space-around"]}
            onChange={(v) => set("justify-content", v)}
          />
        </Panel>
      )}
      {tab === "effects" && (
        <Panel>
          <RangeRow
            label="الشفافية"
            value={style.opacity ? String(Number(style.opacity) * 100) : "100"}
            max={100}
            onChange={(v) => set("opacity", String(v / 100))}
          />
          <RangeRow
            label="التمويه"
            value={(style.filter || "").match(/blur\((\d+)/)?.[1]}
            max={20}
            onChange={(v) => set("filter", `blur(${v}px)`)}
          />
          <RangeRow
            label="الدوران"
            value={(style.transform || "").match(/rotate\((-?\d+)/)?.[1]}
            min={-20}
            max={20}
            onChange={(v) => set("transform", `rotate(${v}deg)`)}
          />
          <SelectRow
            label="الظل"
            value={style["box-shadow"] || "none"}
            options={[
              "none",
              "0 10px 30px rgba(0,0,0,.10)",
              "0 20px 60px rgba(0,0,0,.18)",
              "0 0 0 1px rgba(0,0,0,.08)",
            ]}
            labels={["بدون", "ناعم", "عميق", "إطار خفيف"]}
            onChange={(v) => set("box-shadow", v)}
          />
          <SelectRow
            label="الانتقال"
            value={style.transition || "none"}
            options={["none", "all .2s ease", "all .4s ease", "all .7s cubic-bezier(.2,.8,.2,1)"]}
            labels={["بدون", "سريع", "ناعم", "سينمائي"]}
            onChange={(v) => set("transition", v)}
          />
          <SelectRow
            label="تجاوز المحتوى"
            value={style.overflow || "visible"}
            options={["visible", "hidden", "auto"]}
            onChange={(v) => set("overflow", v)}
          />
        </Panel>
      )}
    </aside>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3">{children}</div>;
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid grid-cols-[92px_1fr] items-center gap-2 text-[11px]">
      <span className="text-white/55">{label}</span>
      {children}
    </label>
  );
}
function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Row label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={toHex(value) || "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-12 rounded-lg border border-white/15 bg-transparent"
        />
        <code className="text-[10px] text-white/45">{toHex(value) || "mixed"}</code>
      </div>
    </Row>
  );
}
function RangeRow({
  label,
  value,
  onChange,
  min = 0,
  max = 64,
}: {
  label: string;
  value?: string;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const number = Math.min(max, Math.max(min, parseFloat(value || "0") || 0));
  return (
    <Row label={label}>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          value={number}
          onChange={(e) => onChange(Number(e.target.value))}
          className="min-w-0 flex-1 accent-[#d5a3b2]"
        />
        <span className="w-9 text-end text-[10px] text-white/45">{number}</span>
      </div>
    </Row>
  );
}
function SelectRow({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  labels?: string[];
  onChange: (v: string) => void;
}) {
  return (
    <Row label={label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 min-w-0 rounded-lg border border-white/10 bg-white/[.07] px-2 text-[11px] text-white"
      >
        {options.map((option, index) => (
          <option key={option} value={option} className="text-black">
            {labels?.[index] || option}
          </option>
        ))}
      </select>
    </Row>
  );
}
function TextRow({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <Row label={label}>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 min-w-0 rounded-lg border border-white/10 bg-white/[.07] px-2 text-[11px] text-white placeholder:text-white/25"
      />
    </Row>
  );
}
function toHex(value?: string): string | null {
  if (!value) return null;
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;
  return `#${[match[1], match[2], match[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`;
}
