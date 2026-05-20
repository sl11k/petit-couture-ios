import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { productsConfig } from "@/features/admin/configs/products.config";
import { ProductImportDialog } from "@/features/admin/components/ProductImportDialog";
import { useLanguage } from "@/i18n/LanguageContext";
import { FileUp } from "lucide-react";

function ProductsRoute() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [open, setOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted"
        >
          <FileUp className="h-3 w-3" /> {ar ? "استيراد من Excel" : "Import from Excel"}
        </button>
      </div>
      <AdminPage key={reloadKey} config={productsConfig} />
      <ProductImportDialog
        open={open}
        onClose={() => setOpen(false)}
        onDone={() => setReloadKey((k) => k + 1)}
      />
    </div>
  );
}

export const Route = createFileRoute("/admin/products/")({
  component: ProductsRoute,
});
