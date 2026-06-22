import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Layers3,
  Monitor,
  Plus,
  RotateCcw,
  Save,
  Smartphone,
  Tablet,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createSection, defaultThemeConfig } from "./defaults";
import { ThemeRenderer } from "./ThemeRenderer";
import { useThemeCustomizer } from "./ThemeProvider";
import type { GlobalThemeSettings, SectionType, ThemeConfig, ThemeSection } from "./types";
import "./theme-editor.css";

type BlockCategory =
  | "Campaigns"
  | "Commerce"
  | "Content"
  | "Social proof"
  | "Engagement"
  | "Layout";
type CatalogItem = {
  id: string;
  type: SectionType;
  label: string;
  category: BlockCategory;
  description: string;
  preset?: Partial<ThemeSection["settings"]>;
};
const baseCatalog: Omit<CatalogItem, "id">[] = [
  {
    type: "announcement",
    label: "Announcement bar",
    category: "Campaigns",
    description: "Shipping, offers and important news",
  },
  {
    type: "marquee",
    label: "Moving marquee",
    category: "Campaigns",
    description: "Animated campaign message",
  },
  {
    type: "hero",
    label: "Editorial hero",
    category: "Campaigns",
    description: "Large cinematic introduction",
  },
  {
    type: "slideshow",
    label: "Campaign slideshow",
    category: "Campaigns",
    description: "Rotating seasonal stories",
  },
  {
    type: "banner",
    label: "Image banner",
    category: "Campaigns",
    description: "Full-width promotional banner",
  },
  {
    type: "collection",
    label: "Collection spotlight",
    category: "Campaigns",
    description: "Feature one curated collection",
  },
  {
    type: "countdown",
    label: "Launch countdown",
    category: "Campaigns",
    description: "Create urgency for a launch",
  },
  {
    type: "hero",
    label: "Split hero",
    category: "Campaigns",
    description: "Image and copy side-by-side",
    preset: { layout: "split", imagePosition: "right", minHeight: 480 },
  },
  {
    type: "banner",
    label: "Sale banner",
    category: "Campaigns",
    description: "High-impact sale promotion",
    preset: { title: "The private sale", subtitle: "Limited time", accentColor: "#b42318" },
  },
  {
    type: "cta",
    label: "Floating promotion",
    category: "Campaigns",
    description: "Compact conversion panel",
    preset: { layout: "boxed", title: "A little something special" },
  },
  {
    type: "product_grid",
    label: "Product grid",
    category: "Commerce",
    description: "Flexible live product catalogue",
  },
  {
    type: "featured_products",
    label: "Featured products",
    category: "Commerce",
    description: "Hand-picked best products",
  },
  {
    type: "product_grid",
    label: "New arrivals",
    category: "Commerce",
    description: "Show the newest pieces",
    preset: { title: "Just arrived", subtitle: "New this week", itemCount: 8 },
  },
  {
    type: "featured_products",
    label: "Best sellers",
    category: "Commerce",
    description: "Your most-loved products",
    preset: { title: "Most loved", subtitle: "Customer favourites" },
  },
  {
    type: "product_grid",
    label: "Sale products",
    category: "Commerce",
    description: "A dedicated offer grid",
    preset: { title: "The sale edit", accentColor: "#b42318" },
  },
  {
    type: "categories",
    label: "Category cards",
    category: "Commerce",
    description: "Visual shopping shortcuts",
  },
  {
    type: "categories",
    label: "Shop by age",
    category: "Commerce",
    description: "Age-based navigation",
    preset: {
      title: "Shop by age",
      itemsText: "Newborn\n0–2 years\n3–5 years\n6–8 years\n9–12 years",
    },
  },
  {
    type: "categories",
    label: "Shop the occasion",
    category: "Commerce",
    description: "Occasion-based collections",
    preset: {
      title: "Made for every moment",
      itemsText: "Everyday\nBirthday\nEid\nWedding\nGifting\nHoliday",
    },
  },
  {
    type: "collection",
    label: "Gift guide",
    category: "Commerce",
    description: "Curated gifting destination",
    preset: { title: "The gift guide", subtitle: "Beautifully chosen" },
  },
  {
    type: "features",
    label: "Shopping benefits",
    category: "Commerce",
    description: "Delivery, returns and service",
    preset: { title: "Shop with confidence" },
  },
  {
    type: "text",
    label: "Rich text",
    category: "Content",
    description: "Story, heading and body copy",
  },
  {
    type: "image",
    label: "Full image",
    category: "Content",
    description: "Editorial photography block",
  },
  {
    type: "image_text",
    label: "Image with text",
    category: "Content",
    description: "Classic editorial composition",
  },
  {
    type: "image_text",
    label: "Brand story",
    category: "Content",
    description: "Tell the story behind the shop",
    preset: { title: "Our story", subtitle: "Made with care", layout: "split" },
  },
  {
    type: "image_text",
    label: "Founder note",
    category: "Content",
    description: "A personal message",
    preset: { title: "A note from our founder", subtitle: "Welcome to our world" },
  },
  {
    type: "video",
    label: "Campaign video",
    category: "Content",
    description: "Immersive motion content",
  },
  {
    type: "gallery",
    label: "Lookbook gallery",
    category: "Content",
    description: "Flexible visual grid",
  },
  {
    type: "gallery",
    label: "Editorial mosaic",
    category: "Content",
    description: "Dense magazine-style gallery",
    preset: { columns: 3, gap: 8, borderRadius: 2 },
  },
  {
    type: "gallery",
    label: "Before & after",
    category: "Content",
    description: "Two-image comparison",
    preset: { columns: 2, itemCount: 2, title: "See the difference" },
  },
  {
    type: "features",
    label: "Icon features",
    category: "Content",
    description: "Explain services and values",
  },
  {
    type: "stats",
    label: "Impact numbers",
    category: "Content",
    description: "Animated-looking key metrics",
  },
  {
    type: "faq",
    label: "Accordion / FAQ",
    category: "Content",
    description: "Expandable questions and answers",
  },
  {
    type: "testimonials",
    label: "Testimonials",
    category: "Social proof",
    description: "Customer stories and quotes",
  },
  {
    type: "reviews",
    label: "Review cards",
    category: "Social proof",
    description: "Ratings and recent feedback",
  },
  {
    type: "logo_cloud",
    label: "Brand logo cloud",
    category: "Social proof",
    description: "Partners, press and stockists",
  },
  {
    type: "logo_cloud",
    label: "As seen in",
    category: "Social proof",
    description: "Press recognition strip",
    preset: { title: "As seen in", subtitle: "Press & media" },
  },
  {
    type: "stats",
    label: "Trust counter",
    category: "Social proof",
    description: "Orders, ratings and customers",
    preset: { title: "Trusted by families" },
  },
  {
    type: "instagram",
    label: "Instagram feed",
    category: "Social proof",
    description: "Social content gallery",
  },
  {
    type: "gallery",
    label: "Customer photos",
    category: "Social proof",
    description: "User-generated content wall",
    preset: { title: "Styled by you", subtitle: "Our community" },
  },
  {
    type: "newsletter",
    label: "Newsletter signup",
    category: "Engagement",
    description: "Grow your subscriber list",
  },
  {
    type: "cta",
    label: "Call to action",
    category: "Engagement",
    description: "Focused conversion section",
  },
  {
    type: "cta",
    label: "WhatsApp concierge",
    category: "Engagement",
    description: "Personal shopping contact",
    preset: {
      title: "Need a little help?",
      subtitle: "Personal shopping",
      description: "Our team is ready to help you choose.",
      accentColor: "#128c7e",
    },
  },
  {
    type: "cta",
    label: "Book an appointment",
    category: "Engagement",
    description: "Private consultation prompt",
    preset: { title: "Book a private appointment", subtitle: "One-to-one styling" },
  },
  {
    type: "faq",
    label: "Size guide",
    category: "Engagement",
    description: "Helpful sizing accordion",
    preset: { title: "Find the perfect fit", subtitle: "Size guide" },
  },
  {
    type: "text",
    label: "Store locations",
    category: "Engagement",
    description: "Addresses and opening hours",
    preset: { title: "Visit us", subtitle: "Our boutiques" },
  },
  {
    type: "divider",
    label: "Divider",
    category: "Layout",
    description: "A refined visual separator",
  },
  {
    type: "spacer",
    label: "Spacer",
    category: "Layout",
    description: "Precise vertical breathing room",
  },
  {
    type: "text",
    label: "Section heading",
    category: "Layout",
    description: "Standalone title and introduction",
    preset: { paddingY: 36 },
  },
  {
    type: "announcement",
    label: "Trust bar",
    category: "Layout",
    description: "Compact benefits strip",
    preset: { title: "Secure payment  ·  Fast delivery  ·  Easy returns" },
  },
  {
    type: "footer",
    label: "Store footer",
    category: "Layout",
    description: "Brand, navigation and contact",
  },
];
const catalog: CatalogItem[] = baseCatalog.map((item, index) => ({
  ...item,
  id: `${item.type}-${index}`,
}));
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
      <Field label="Badge / label">
        <input value={s.badge} onChange={(e) => settings({ badge: e.target.value })} />
      </Field>
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
      <Field label="Primary image URL">
        <input
          type="url"
          value={s.imageUrl}
          placeholder="https://…"
          onChange={(e) => settings({ imageUrl: e.target.value })}
        />
      </Field>
      {section.type === "video" && (
        <Field label="Video URL">
          <input
            type="url"
            value={s.videoUrl}
            onChange={(e) => settings({ videoUrl: e.target.value })}
          />
        </Field>
      )}
      {[
        "gallery",
        "instagram",
        "features",
        "stats",
        "testimonials",
        "reviews",
        "logo_cloud",
        "faq",
        "categories",
      ].includes(section.type) && (
        <Field label="Items — one per line">
          <textarea
            rows={7}
            value={s.itemsText}
            onChange={(e) => settings({ itemsText: e.target.value })}
          />
        </Field>
      )}
      <div className="theme-two-col">
        <ColorField
          label="Background"
          value={s.backgroundColor}
          onChange={(v) => settings({ backgroundColor: v })}
        />
        <ColorField label="Text" value={s.textColor} onChange={(v) => settings({ textColor: v })} />
        <ColorField
          label="Accent"
          value={s.accentColor}
          onChange={(v) => settings({ accentColor: v })}
        />
      </div>
      <div className="theme-two-col">
        <Field label="Alignment">
          <select
            value={s.alignment}
            onChange={(e) => settings({ alignment: e.target.value as typeof s.alignment })}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </Field>
        <Field label="Layout">
          <select
            value={s.layout}
            onChange={(e) => settings({ layout: e.target.value as typeof s.layout })}
          >
            <option value="classic">Classic</option>
            <option value="split">Split</option>
            <option value="boxed">Boxed</option>
            <option value="full">Full width</option>
            <option value="cards">Cards</option>
          </select>
        </Field>
      </div>
      <Field label={`Vertical padding · ${s.paddingY}px`}>
        <input
          type="range"
          min="0"
          max="180"
          value={s.paddingY}
          onChange={(e) => settings({ paddingY: +e.target.value })}
        />
      </Field>
      <Field label={`Minimum height · ${s.minHeight}px`}>
        <input
          type="range"
          min="0"
          max="900"
          step="20"
          value={s.minHeight}
          onChange={(e) => settings({ minHeight: +e.target.value })}
        />
      </Field>
      <Field label={`Section radius · ${s.borderRadius}px`}>
        <input
          type="range"
          min="0"
          max="48"
          value={s.borderRadius}
          onChange={(e) => settings({ borderRadius: +e.target.value })}
        />
      </Field>
      {["hero", "banner", "collection", "slideshow"].includes(section.type) && (
        <Field label={`Image overlay · ${s.overlayOpacity}%`}>
          <input
            type="range"
            min="0"
            max="80"
            value={s.overlayOpacity}
            onChange={(e) => settings({ overlayOpacity: +e.target.value })}
          />
        </Field>
      )}
      {(section.type.includes("product") ||
        [
          "categories",
          "gallery",
          "instagram",
          "features",
          "stats",
          "testimonials",
          "reviews",
          "logo_cloud",
        ].includes(section.type)) && (
        <>
          <Field label="Columns">
            <select
              value={s.columns}
              onChange={(e) => settings({ columns: +e.target.value as 2 | 3 | 4 | 5 })}
            >
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </Field>
          <Field label={`Placeholder items · ${s.itemCount}`}>
            <input
              type="range"
              min="2"
              max="12"
              value={s.itemCount}
              onChange={(e) => settings({ itemCount: +e.target.value })}
            />
          </Field>
          <Field label={`Grid gap · ${s.gap}px`}>
            <input
              type="range"
              min="0"
              max="48"
              value={s.gap}
              onChange={(e) => settings({ gap: +e.target.value })}
            />
          </Field>
          {section.type.includes("product") && (
            <label className="theme-check">
              <input
                type="checkbox"
                checked={s.showPrice}
                onChange={(e) => settings({ showPrice: e.target.checked })}
              />{" "}
              Show prices
            </label>
          )}
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

export function ThemeEditor({ onClose }: { onClose?: () => void } = {}) {
  const persisted = useThemeCustomizer();
  const [draft, setDraft] = useState(persisted.config);
  const [selected, setSelected] = useState<string | "global">("global");
  const [adding, setAdding] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<BlockCategory | "All">("All");
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const visibleCatalog = useMemo(
    () =>
      catalog.filter(
        (x) =>
          (category === "All" || x.category === category) &&
          `${x.label} ${x.description}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [query, category],
  );
  useEffect(() => {
    if (!onClose) return;
    const prior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prior;
    };
  }, [onClose]);
  const index = selected === "global" ? -1 : draft.sections.findIndex((s) => s.id === selected);
  const selectedSection = index >= 0 ? draft.sections[index] : null;
  const updateSection = (value: ThemeSection) =>
    setDraft({ ...draft, sections: draft.sections.map((s) => (s.id === value.id ? value : s)) });
  const move = (i: number, delta: number) => {
    const next = [...draft.sections];
    const target = i + delta;
    if (target < 0 || target >= next.length) return;
    const [moved] = next.splice(i, 1);
    next.splice(target, 0, moved);
    setDraft({ ...draft, sections: next });
  };
  return (
    <div
      className={`theme-editor ${onClose ? "theme-editor-overlay" : ""}`}
      dir="ltr"
      data-theme-studio
    >
      <header className="theme-editor-top">
        <div>
          <small>STOREFRONT</small>
          <h1>Visual theme builder</h1>
        </div>
        <div className="theme-editor-actions">
          {onClose && (
            <button onClick={onClose}>
              <X size={16} /> Exit
            </button>
          )}
          <button
            onClick={async () => {
              setDraft(defaultThemeConfig);
              try {
                await persisted.reset();
                setSelected("global");
                toast.success("Customization reset everywhere");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not reset theme");
              }
            }}
          >
            <RotateCcw size={16} /> Reset
          </button>
          <button
            className="primary"
            onClick={async () => {
              try {
                await persisted.save(draft);
                toast.success("Theme published to the storefront");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not publish theme");
              }
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
              <input
                className="theme-block-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search 27 blocks…"
                autoFocus
              />
              {visibleCatalog.map((x) => (
                <button
                  key={x.id}
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
            <div
              className={`theme-section-row ${selected === s.id ? "active" : ""} ${dragging === i ? "dragging" : ""}`}
              key={s.id}
              draggable
              onDragStart={() => setDragging(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragging !== null && dragging !== i) move(dragging, i - dragging);
                setDragging(null);
              }}
              onDragEnd={() => setDragging(null)}
            >
              <button className="theme-section-select" onClick={() => setSelected(s.id)}>
                <GripVertical size={14} className="theme-drag-handle" />
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
          <button
            className="theme-add-button"
            data-testid="block-library-button"
            onClick={() => setAdding(true)}
          >
            <Layers3 size={16} /> Add from block library
          </button>
        </aside>
        <main className="theme-preview-wrap">
          <div className="theme-preview-label">
            <span>
              <Check size={14} /> Live preview
            </span>
            <div className="theme-device-switcher">
              <button
                className={device === "desktop" ? "active" : ""}
                onClick={() => setDevice("desktop")}
                title="Desktop"
              >
                <Monitor size={14} />
              </button>
              <button
                className={device === "tablet" ? "active" : ""}
                onClick={() => setDevice("tablet")}
                title="Tablet"
              >
                <Tablet size={14} />
              </button>
              <button
                className={device === "mobile" ? "active" : ""}
                onClick={() => setDevice("mobile")}
                title="Mobile"
              >
                <Smartphone size={14} />
              </button>
            </div>
          </div>
          <div
            className="theme-preview-frame"
            style={{ width: device === "mobile" ? 390 : device === "tablet" ? 768 : "100%" }}
          >
            <ThemeRenderer
              config={draft}
              preview
              selectedSectionId={selected === "global" ? null : selected}
              onSelectSection={setSelected}
            />
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
      {adding && (
        <div
          className="theme-library-backdrop"
          data-testid="block-library"
          onMouseDown={() => setAdding(false)}
        >
          <section className="theme-library" onMouseDown={(event) => event.stopPropagation()}>
            <header className="theme-library-head">
              <div>
                <small>SECTION LIBRARY</small>
                <h2>Build something beautiful</h2>
                <p>{catalog.length} ready-made blocks, all fully customizable.</p>
              </div>
              <button
                className="theme-icon-button"
                onClick={() => setAdding(false)}
                aria-label="Close library"
              >
                <X size={19} />
              </button>
            </header>
            <div className="theme-library-tools">
              <input
                className="theme-block-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search blocks, layouts and ideas…"
                autoFocus
              />
              <nav>
                {(
                  [
                    "All",
                    "Campaigns",
                    "Commerce",
                    "Content",
                    "Social proof",
                    "Engagement",
                    "Layout",
                  ] as const
                ).map((item) => (
                  <button
                    key={item}
                    className={category === item ? "active" : ""}
                    onClick={() => setCategory(item)}
                  >
                    {item}
                  </button>
                ))}
              </nav>
            </div>
            <div className="theme-library-grid">
              {visibleCatalog.map((x) => (
                <button
                  key={x.id}
                  className="theme-block-card"
                  onClick={() => {
                    const base = createSection(x.type);
                    const s = { ...base, settings: { ...base.settings, ...x.preset } };
                    setDraft({ ...draft, sections: [...draft.sections, s] });
                    setSelected(s.id);
                    setAdding(false);
                  }}
                >
                  <span className={`theme-block-art art-${x.type}`}>
                    <Layers3 size={22} />
                  </span>
                  <span>
                    <b>{x.label}</b>
                    <small>{x.description}</small>
                  </span>
                  <Plus size={17} />
                </button>
              ))}
              {!visibleCatalog.length && (
                <div className="theme-library-empty">No blocks match your search.</div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
