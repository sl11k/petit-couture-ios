import type { ColumnDef } from "../types";

/** Coerce a cell to a plain string for export (mirrors DataTable formatting). */
export function exportCellValue(value: any, type?: ColumnDef["type"], lang: "ar" | "en" = "en"): string {
  if (value === null || value === undefined || value === "") return "";
  switch (type) {
    case "currency":
      return `${Number(value).toLocaleString(lang === "ar" ? "ar" : "en")} ${lang === "ar" ? "ر.س" : "SAR"}`;
    case "number":
      return Number(value).toLocaleString(lang === "ar" ? "ar" : "en");
    case "date":
      return new Date(value).toLocaleDateString(lang === "ar" ? "ar" : "en");
    case "datetime":
      return new Date(value).toLocaleString(lang === "ar" ? "ar" : "en");
    case "boolean":
      return value ? (lang === "ar" ? "نعم" : "Yes") : (lang === "ar" ? "لا" : "No");
    case "image":
      return String(value);
    default:
      if (typeof value === "object") {
        try { return JSON.stringify(value); } catch { return String(value); }
      }
      return String(value);
  }
}

/** Build header labels + body rows from columns. Skips image columns. */
export function buildExportData<T extends Record<string, any>>(
  rows: T[],
  columns: ColumnDef<T>[],
  lang: "ar" | "en" = "en",
) {
  const cols = columns.filter((c) => c.type !== "image");
  const headers = cols.map((c) => c.label[lang] || c.key);
  const body = rows.map((r) => cols.map((c) => exportCellValue(r[c.key], c.type, lang)));
  return { headers, body };
}

export function exportTableToCSV<T extends Record<string, any>>(
  rows: T[],
  columns: ColumnDef<T>[],
  filename: string,
  lang: "ar" | "en" = "en",
) {
  if (!rows.length) return;
  const { headers, body } = buildExportData(rows, columns, lang);
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(","), ...body.map((r) => r.map(escape).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, `${filename}-${Date.now()}.csv`);
}

let arabicFontPromise: Promise<string | null> | null = null;
async function loadArabicFontBase64(): Promise<string | null> {
  if (arabicFontPromise) return arabicFontPromise;
  arabicFontPromise = (async () => {
    try {
      const url = "https://cdn.jsdelivr.net/npm/@fontsource/amiri@5.0.0/files/amiri-arabic-400-normal.woff";
      // jsPDF needs TTF — fall back to a TTF mirror
      const ttfUrl = "https://raw.githubusercontent.com/aliftype/amiri/1.000/Amiri-Regular.ttf";
      const res = await fetch(ttfUrl);
      if (!res.ok) return null;
      const buf = new Uint8Array(await res.arrayBuffer());
      let binary = "";
      for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _ = url; // hint kept
      return btoa(binary);
    } catch {
      return null;
    }
  })();
  return arabicFontPromise;
}

export async function exportTableToPDF<T extends Record<string, any>>(
  rows: T[],
  columns: ColumnDef<T>[],
  filename: string,
  title: string,
  lang: "ar" | "en" = "en",
) {
  if (!rows.length) return;
  const [{ default: jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = (autoTableModule as any).default || (autoTableModule as any);

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const isAr = lang === "ar";

  let fontName = "helvetica";
  if (isAr) {
    const b64 = await loadArabicFontBase64();
    if (b64) {
      doc.addFileToVFS("Amiri-Regular.ttf", b64);
      doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
      fontName = "Amiri";
      doc.setFont("Amiri", "normal");
      (doc as any).setR2L?.(true);
    }
  }

  doc.setFontSize(14);
  doc.text(title, isAr ? doc.internal.pageSize.getWidth() - 40 : 40, 30, { align: isAr ? "right" : "left" });
  doc.setFontSize(9);
  doc.text(new Date().toLocaleString(isAr ? "ar" : "en"),
    isAr ? doc.internal.pageSize.getWidth() - 40 : 40, 46,
    { align: isAr ? "right" : "left" });

  const { headers, body } = buildExportData(rows, columns, lang);

  autoTable(doc, {
    head: [headers],
    body,
    startY: 60,
    margin: { left: 20, right: 20 },
    styles: { font: fontName, fontSize: 8, cellPadding: 4, halign: isAr ? "right" : "left" },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, halign: isAr ? "right" : "left" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    theme: "grid",
  });

  const blob = doc.output("blob");
  triggerDownload(blob, `${filename}-${Date.now()}.pdf`);
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
