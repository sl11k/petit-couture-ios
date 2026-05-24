import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { listWarehouseInventory, transferStock, updateInventoryRow, listWarehousesLite } from "@/lib/inventory.functions";

export const Route = createFileRoute("/admin/warehouses/$id")({
  component: WarehouseDetail,
});

function WarehouseDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const listFn = useServerFn(listWarehouseInventory);
  const whFn = useServerFn(listWarehousesLite);
  const transferFn = useServerFn(transferStock);
  const updateFn = useServerFn(updateInventoryRow);

  const inv = useQuery({ queryKey: ["wh-inv", id], queryFn: () => listFn({ data: { warehouseId: id } }) });
  const whs = useQuery({ queryKey: ["wh-lite"], queryFn: () => whFn() });

  const [tx, setTx] = useState<{ productId: string; variantId: string | null; qty: number; to: string } | null>(null);

  const transfer = useMutation({
    mutationFn: () => transferFn({ data: { productId: tx!.productId, variantId: tx!.variantId, fromWarehouse: id, toWarehouse: tx!.to, qty: tx!.qty } }),
    onSuccess: () => { toast.success("تم النقل"); setTx(null); qc.invalidateQueries({ queryKey: ["wh-inv", id] }); },
    onError: (e: any) => toast.error(e?.message || "فشل النقل"),
  });

  const updateQty = useMutation({
    mutationFn: (v: { rowId: string; quantity: number }) => updateFn({ data: { id: v.rowId, quantity: v.quantity } }),
    onSuccess: () => { toast.success("تم التحديث"); qc.invalidateQueries({ queryKey: ["wh-inv", id] }); },
    onError: (e: any) => toast.error(e?.message || "فشل التحديث"),
  });

  const rows = inv.data?.rows ?? [];
  const otherWhs = (whs.data?.warehouses ?? []).filter((w: any) => w.id !== id);

  return (
    <div className="p-6 space-y-4" dir="rtl">
      <div className="flex items-center gap-3">
        <Link to="/admin/warehouses" className="text-sm text-muted-foreground hover:underline">← المستودعات</Link>
        <h1 className="text-xl font-semibold">مخزون المستودع</h1>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="p-2 text-right">المنتج</th>
              <th className="p-2">SKU</th>
              <th className="p-2">الكمية</th>
              <th className="p-2">محجوز</th>
              <th className="p-2">المتاح</th>
              <th className="p-2">الحد الأدنى</th>
              <th className="p-2">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => {
              const p = r.products;
              const avail = (r.quantity ?? 0) - (r.reserved_quantity ?? 0);
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-2">
                    <div className="font-medium">{p?.name_ar || p?.name || p?.name_en || "—"}</div>
                    <div className="text-xs text-muted-foreground">{p?.slug}</div>
                  </td>
                  <td className="p-2 text-center">{r.product_variants?.sku || r.sku || p?.sku || "—"}</td>
                  <td className="p-2 text-center">
                    <input
                      type="number"
                      min={0}
                      defaultValue={r.quantity}
                      className="w-20 rounded border border-border bg-background px-2 py-1 text-center"
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== r.quantity && Number.isFinite(v)) updateQty.mutate({ rowId: r.id, quantity: v });
                      }}
                    />
                  </td>
                  <td className="p-2 text-center">{r.reserved_quantity}</td>
                  <td className={`p-2 text-center font-medium ${avail <= 0 ? "text-destructive" : avail <= (r.low_stock_threshold ?? 5) ? "text-amber-600" : ""}`}>{avail}</td>
                  <td className="p-2 text-center">{r.low_stock_threshold}</td>
                  <td className="p-2 text-center">
                    <button
                      className="text-xs rounded bg-primary/10 px-2 py-1 hover:bg-primary/20"
                      onClick={() => setTx({ productId: r.product_id, variantId: r.variant_id, qty: 1, to: otherWhs[0]?.id ?? "" })}
                      disabled={!otherWhs.length || avail <= 0}
                    >
                      نقل
                    </button>
                  </td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">لا يوجد مخزون</td></tr>}
          </tbody>
        </table>
      </div>

      {tx && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-50" onClick={() => setTx(null)}>
          <div className="bg-background rounded-lg p-4 w-[90%] max-w-sm space-y-3" onClick={(e) => e.stopPropagation()} dir="rtl">
            <h3 className="font-semibold">نقل مخزون إلى مستودع آخر</h3>
            <label className="block text-sm">المستودع الوجهة
              <select value={tx.to} onChange={(e) => setTx({ ...tx, to: e.target.value })} className="mt-1 w-full rounded border border-border bg-background px-2 py-1">
                {otherWhs.map((w: any) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
              </select>
            </label>
            <label className="block text-sm">الكمية
              <input type="number" min={1} value={tx.qty} onChange={(e) => setTx({ ...tx, qty: Math.max(1, Number(e.target.value) || 1) })} className="mt-1 w-full rounded border border-border bg-background px-2 py-1" />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setTx(null)} className="px-3 py-1.5 text-sm rounded border border-border">إلغاء</button>
              <button onClick={() => transfer.mutate()} disabled={!tx.to || transfer.isPending} className="px-3 py-1.5 text-sm rounded bg-foreground text-background disabled:opacity-50">
                {transfer.isPending ? "..." : "نقل"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
