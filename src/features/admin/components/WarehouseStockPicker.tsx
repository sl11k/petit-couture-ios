import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Warehouse } from "lucide-react";

export type WarehouseStockEntry = {
  warehouse_id: string;
  quantity: number;
  enabled: boolean;
};

type WH = {
  id: string;
  code: string;
  name: string;
  name_en: string | null;
  country_code: string | null;
  city: string | null;
  status: string;
};

type Props = {
  value: WarehouseStockEntry[];
  onChange: (v: WarehouseStockEntry[]) => void;
  existing?: Record<string, number>; // warehouse_id -> current quantity (edit mode)
};

export function WarehouseStockPicker({ value, onChange, existing }: Props) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [warehouses, setWarehouses] = useState<WH[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("warehouses")
        .select("id, code, name, name_en, country_code, city, status")
        .eq("status", "active")
        .order("priority", { ascending: true })
        .order("name", { ascending: true });
      setWarehouses((data as WH[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const byId = new Map(value.map((v) => [v.warehouse_id, v]));

  const toggle = (id: string, on: boolean) => {
    const next = warehouses.map((w) => {
      const cur = byId.get(w.id);
      if (w.id !== id) {
        return cur ?? { warehouse_id: w.id, quantity: existing?.[w.id] ?? 0, enabled: false };
      }
      return {
        warehouse_id: id,
        quantity: cur?.quantity ?? existing?.[id] ?? 0,
        enabled: on,
      };
    });
    onChange(next.filter((n) => n.enabled || (existing && existing[n.warehouse_id] !== undefined)));
  };

  const setQty = (id: string, qty: number) => {
    const next = warehouses.map((w) => {
      const cur = byId.get(w.id);
      if (w.id !== id) return cur ?? { warehouse_id: w.id, quantity: 0, enabled: false };
      return { warehouse_id: id, quantity: qty, enabled: true };
    });
    onChange(next.filter((n) => n.enabled || (existing && existing[n.warehouse_id] !== undefined)));
  };

  if (loading) {
    return <p className="text-xs text-muted-foreground">{ar ? "جاري التحميل..." : "Loading..."}</p>;
  }

  if (warehouses.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {ar ? "لا توجد مستودعات نشطة. أضف مستودعاً من إعدادات المستودعات أولاً." : "No active warehouses. Add one in Warehouses first."}
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-2">
      {warehouses.map((w) => {
        const cur = byId.get(w.id);
        const enabled = cur?.enabled ?? false;
        const qty = cur?.quantity ?? existing?.[w.id] ?? 0;
        const existingQty = existing?.[w.id];
        return (
          <div key={w.id} className="flex items-center gap-2 text-xs">
            <Switch checked={enabled} onCheckedChange={(c) => toggle(w.id, c)} />
            <Warehouse className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="flex-1">
              <div className="font-medium">{ar ? w.name : (w.name_en || w.name)}</div>
              <div className="text-[10px] text-muted-foreground">
                {w.code}
                {w.country_code ? ` · ${w.country_code}` : ""}
                {w.city ? ` · ${w.city}` : ""}
                {existingQty !== undefined && (
                  <> · {ar ? "الحالي" : "current"}: {existingQty}</>
                )}
              </div>
            </div>
            <Input
              type="number"
              min={0}
              value={qty}
              onChange={(e) => setQty(w.id, Number(e.target.value || 0))}
              disabled={!enabled}
              className="h-8 w-24 text-xs"
            />
          </div>
        );
      })}
      <p className="text-[10px] text-muted-foreground">
        {ar
          ? "فعّل المستودعات التي تريد توزيع المخزون عليها وحدّد الكمية لكل منها."
          : "Enable warehouses to stock this product in and set the quantity for each."}
      </p>
    </div>
  );
}
