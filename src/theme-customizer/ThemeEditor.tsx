import { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { createSection, defaultThemeConfig } from "./defaults";
import { ThemeRenderer } from "./ThemeRenderer";
import { useThemeCustomizer } from "./ThemeProvider";
import type { GlobalThemeSettings, SectionType, ThemeConfig, ThemeSection } from "./types";

const catalog: { type: SectionType; label: string }[] = [
  { type: "hero", label: "Hero" },
  { type: "product_grid", label: "Product grid" },
  { type: "featured_products", label: "Featured products" },
  { type: "categories", label: "Categories" },
  { type: "banner", label: "Banner" },
  { type: "collection", label: "Collection" },
  { type: "text", label: "Text" },
  { type: "image", label: "Image" },
  { type: "cta", label: "Call to action" },
  { type: "footer", label: "Footer" },
];
const title = (type: string) => catalog.find((x) => x.type === type)?.label ?? type;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="theme-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="theme-color-field">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <input value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </Field>
  );
}

function GlobalPanel({
  config,
  change,
}: {
  config: ThemeConfig;
  change: (v: ThemeConfig) => void;
}) {
  const set = <K extends keyof GlobalThemeSettings>(key: K, value: GlobalThemeSettings[K]) =>
    change({ ...config, global: { ...config.global, [key]: value } });
  const g = config.global;
  return (
    <div className="theme-controls">
      <h2>Global theme</h2>
      <p className="theme-help">
        These settings apply to the live storefront, reusable cards, buttons, header, and spacing.
      </p>
      <div className="theme-two-col">
        <ColorField
          label="Primary"
          value={g.primaryColor}
          onChange={(v) => set("primaryColor", v)}
        />
        <ColorField
          label="Secondary"
          value={g.secondaryColor}
          onChange={(v) => set("secondaryColor", v)}
        />
        <ColorField
          label="Background"
          value={g.backgroundColor}
          onChange={(v) => set("backgroundColor", v)}
        />
        <ColorField label="Text" value={g.textColor} onChange={(v) => set("textColor", v)} />
        <ColorField label="Cards" value={g.cardColor} onChange={(v) => set("cardColor", v)} />
      </div>
      <Field label={`Corner radius · ${g.borderRadius}px`}>
        <input
          type="range"
          min="0"
          max="32"
          value={g.borderRadius}
          onChange={(e) => set("borderRadius", +e.target.value)}
        />
      </Field>
      <Field label={`Font scale · ${g.fontSizeScale.toFixed(2)}×`}>
        <input
          type="range"
          min="0.8"
          max="1.3"
          step="0.05"
          value={g.fontSizeScale}
          onChange={(e) => set("fontSizeScale", +e.target.value)}
        />
      </Field>
      <Field label={`Spacing scale · ${g.spacingScale.toFixed(2)}×`}>
        <input
          type="range"
          min="0.7"
          max="1.5"
          step="0.05"
          value={g.spacingScale}
          onChange={(e) => set("spacingScale", +e.target.value)}
        />
      </Field>
      <Field label="Default button style">
        <select
          value={g.buttonStyle}
          onChange={(e) => set("buttonStyle", e.target.value as GlobalThemeSettings["buttonStyle"])}
        >
          <option value="solid">Solid</option>
          <option value="outline">Outline</option>
          <option value="ghost">Ghost</option>
          <option value="glass">Glass</option>
        </select>
      </Field>
      <Field label="Header style">
        <select
          value={g.headerStyle}
          onChange={(e) => set("headerStyle", e.target.value as GlobalThemeSettings["headerStyle"])}
        >
          <option value="solid">Solid</option>
          <option value="transparent">Transparent</option>
          <option value="minimal">Minimal</option>
        </select>
      </Field>
      <Field label="Product cards">
        <select
          value={g.productCardStyle}
          onChange={(e) =>
            set("productCardStyle", e.target.value as GlobalThemeSettings["productCardStyle"])
          }
        >
          <option value="elevated">Elevated</option>
          <option value="flat">Flat</option>
          <option value="outlined">Outlined</option>
        </select>
      </Field>
      <Field label="App background">
        <select
          value={g.appBackgroundStyle}
          onChange={(e) =>
            set("appBackgroundStyle", e.target.value as GlobalThemeSettings["appBackgroundStyle"])
          }
        >
          <option value="solid">Solid</option>
          <option value="soft-gradient">Soft gradient</option>
        </select>
      </Field>
    </div>
  );
}

function SectionPanel({
  section,
  update,
}: {
  section: ThemeSection;
  update: (s: ThemeSection) => void;
}) {
  const s = section.settings;
  const settings = (patch: Partial<typeof s>) =>
    update({ ...section, settings: { ...s, ...patch } });
  const b = s.button;
  const button = (patch: Partial<typeof b>) => settings({ button: { ...b, ...patch } });
  return (
    <div className="theme-controls">
      <h2>{title(section.type)} settings</h2>
      <Field label="Title">
        <input value={s.title} onChange={(e) => settings({ title: e.target.value })} />
      </Field>
      <Field label="Subtitle">
        <input value={s.subtitle} onChange={(e) => settings({ subtitle: e.target.value })} />
      </Field>
      <Field label="Description">
        <textarea
          rows={3}
          value={s.description}
          onChange={(e) => settings({ description: e.target.value })}
        />
      </Field>
      <Field label="Image URL">
        <input
          type="url"
          value={s.imageUrl}
          placeholder="https://…"
          onChange={(e) => settings({ imageUrl: e.target.value })}
        />
      </Field>
      <div className="theme-two-col">
        <ColorField
          label="Background"
          value={s.backgroundColor}
          onChange={(v) => settings({ backgroundColor: v })}
        />
        <ColorField label="Text" value={s.textColor} onChange={(v) => settings({ textColor: v })} />
      </div>
      {(section.type.includes("product") || section.type === "categories") && (
        <>
          <Field label="Columns">
            <select
              value={s.columns}
              onChange={(e) => settings({ columns: +e.target.value as 2 | 3 | 4 })}
            >
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </Field>
          <Field label={`Placeholder items · ${s.itemCount}`}>
            <input
              type="range"
              min="2"
              max="8"
              value={s.itemCount}
              onChange={(e) => settings({ itemCount: +e.target.value })}
            />
          </Field>
        </>
      )}
      {["hero", "banner", "collection", "cta"].includes(section.type) && (
        <div className="theme-subpanel">
          <h3>Button</h3>
          <Field label="Text">
            <input value={b.text} onChange={(e) => button({ text: e.target.value })} />
          </Field>
          <Field label="Link">
            <input value={b.url} onChange={(e) => button({ url: e.target.value })} />
          </Field>
          <div className="theme-two-col">
            <ColorField
              label="Background"
              value={b.backgroundColor}
              onChange={(v) => button({ backgroundColor: v })}
            />
            <ColorField
              label="Text color"
              value={b.textColor}
              onChange={(v) => button({ textColor: v })}
            />
            <ColorField
              label="Border"
              value={b.borderColor}
              onChange={(v) => button({ borderColor: v })}
            />
          </div>
          <Field label={`Radius · ${b.borderRadius}px`}>
            <input
              type="range"
              min="0"
              max="40"
              value={b.borderRadius}
              onChange={(e) => button({ borderRadius: +e.target.value })}
            />
          </Field>
          <Field label={`Border width · ${b.borderWidth}px`}>
            <input
              type="range"
              min="0"
              max="5"
              value={b.borderWidth}
              onChange={(e) => button({ borderWidth: +e.target.value })}
            />
          </Field>
          <Field label="Variant">
            <select
              value={b.variant}
              onChange={(e) => button({ variant: e.target.value as typeof b.variant })}
            >
              <option value="solid">Solid</option>
              <option value="outline">Outline</option>
              <option value="ghost">Ghost</option>
              <option value="glass">Glass</option>
            </select>
          </Field>
          <Field label="Size">
            <select
              value={b.size}
              onChange={(e) => button({ size: e.target.value as typeof b.size })}
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </Field>
          <label className="theme-check">
            <input
              type="checkbox"
              checked={b.shadow}
              onChange={(e) => button({ shadow: e.target.checked })}
            />{" "}
            Shadow
          </label>
          <label className="theme-check">
            <input
              type="checkbox"
              checked={b.fullWidth}
              onChange={(e) => button({ fullWidth: e.target.checked })}
            />{" "}
            Full width
          </label>
        </div>
      )}
    </div>
  );
}

export function ThemeEditor() {
  const persisted = useThemeCustomizer();
  const [draft, setDraft] = useState(persisted.config);
  const [selected, setSelected] = useState<string | "global">("global");
  const [adding, setAdding] = useState(false);
  const index = selected === "global" ? -1 : draft.sections.findIndex((s) => s.id === selected);
  const selectedSection = index >= 0 ? draft.sections[index] : null;
  const updateSection = (value: ThemeSection) =>
    setDraft({ ...draft, sections: draft.sections.map((s) => (s.id === value.id ? value : s)) });
  const move = (i: number, delta: number) => {
    const next = [...draft.sections];
    const target = i + delta;
    if (target < 0 || target >= next.length) return;
    [next[i], next[target]] = [next[target], next[i]];
    setDraft({ ...draft, sections: next });
  };
  return (
    <div className="theme-editor" dir="ltr">
      <header className="theme-editor-top">
        <div>
          <small>STOREFRONT</small>
          <h1>Visual theme builder</h1>
        </div>
        <div className="theme-editor-actions">
          <button
            onClick={() => {
              setDraft(defaultThemeConfig);
              persisted.reset();
              setSelected("global");
              toast.success("Customization reset");
            }}
          >
            <RotateCcw size={16} /> Reset
          </button>
          <button
            className="primary"
            onClick={() => {
              persisted.save(draft);
              toast.success("Theme saved and applied to the storefront");
            }}
          >
            <Save size={16} /> Save
          </button>
        </div>
      </header>
      <div className="theme-editor-layout">
        <aside className="theme-section-list">
          <button
            className={selected === "global" ? "active" : ""}
            onClick={() => setSelected("global")}
          >
            <span>◐</span>
            <b>Global theme</b>
          </button>
          <div className="theme-list-title">
            <span>Sections</span>
            <button title="Add section" onClick={() => setAdding(!adding)}>
              <Plus size={16} />
            </button>
          </div>
          {adding && (
            <div className="theme-add-menu">
              {catalog.map((x) => (
                <button
                  key={x.type}
                  onClick={() => {
                    const s = createSection(x.type);
                    setDraft({ ...draft, sections: [...draft.sections, s] });
                    setSelected(s.id);
                    setAdding(false);
                  }}
                >
                  {x.label}
                </button>
              ))}
            </div>
          )}
          {draft.sections.map((s, i) => (
            <div className={`theme-section-row ${selected === s.id ? "active" : ""}`} key={s.id}>
              <button className="theme-section-select" onClick={() => setSelected(s.id)}>
                <span>{i + 1}</span>
                <b>{title(s.type)}</b>
              </button>
              <div className="theme-row-actions">
                <button
                  title={s.enabled ? "Hide" : "Show"}
                  onClick={() => updateSection({ ...s, enabled: !s.enabled })}
                >
                  {s.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button title="Move up" onClick={() => move(i, -1)}>
                  <ChevronUp size={14} />
                </button>
                <button title="Move down" onClick={() => move(i, 1)}>
                  <ChevronDown size={14} />
                </button>
                <button
                  title="Duplicate"
                  onClick={() => {
                    const clone = {
                      ...s,
                      id: `${s.type}-${Date.now()}`,
                      settings: { ...s.settings, button: { ...s.settings.button } },
                    };
                    const next = [...draft.sections];
                    next.splice(i + 1, 0, clone);
                    setDraft({ ...draft, sections: next });
                    setSelected(clone.id);
                  }}
                >
                  <Copy size={14} />
                </button>
                <button
                  title="Delete"
                  onClick={() => {
                    setDraft({ ...draft, sections: draft.sections.filter((x) => x.id !== s.id) });
                    setSelected("global");
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {draft.sections.length === 0 && (
            <div className="theme-list-empty">Your page is empty. Add a section to begin.</div>
          )}
          <button className="theme-add-button" onClick={() => setAdding(!adding)}>
            <Plus size={16} /> Add section
          </button>
        </aside>
        <main className="theme-preview-wrap">
          <div className="theme-preview-label">
            <span>
              <Check size={14} /> Live preview
            </span>
            <span>Changes appear instantly · Save to publish</span>
          </div>
          <div className="theme-preview-frame">
            <ThemeRenderer config={draft} preview />
          </div>
        </main>
        <aside className="theme-settings-panel">
          {selected === "global" ? (
            <GlobalPanel config={draft} change={setDraft} />
          ) : selectedSection ? (
            <SectionPanel section={selectedSection} update={updateSection} />
          ) : (
            <div className="theme-list-empty">Select a section to edit it.</div>
          )}
        </aside>
      </div>
    </div>
  );
}
