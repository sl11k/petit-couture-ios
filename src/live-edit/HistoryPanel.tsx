import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, FileText, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

type HistoryRow = {
  id: string;
  selector: string;
  prop: string;
  lang: string;
  change_kind: "draft" | "publish";
  old_value: any;
  new_value: any;
  actor_email: string | null;
  created_at: string;
};

type PendingRow = {
  selector: string;
  prop: string;
  lang: string;
  draft_value: any;
  published_value: any;
  updated_at: string;
};

function fmtVal(v: any): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  try { return JSON.stringify(v); } catch { return String(v); }
}

function DiffRow({ before, after }: { before: any; after: any }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-[12px]">
      <div className="rounded border border-destructive/30 bg-destructive/5 p-2">
        <div className="text-[10px] text-muted-foreground mb-1">قبل</div>
        <div className="whitespace-pre-wrap break-words line-through opacity-80">{fmtVal(before)}</div>
      </div>
      <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-2">
        <div className="text-[10px] text-muted-foreground mb-1">بعد</div>
        <div className="whitespace-pre-wrap break-words">{fmtVal(after)}</div>
      </div>
    </div>
  );
}

export function HistoryPanel({
  open,
  onOpenChange,
  pagePath,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pagePath: string;
}) {
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [h, p] = await Promise.all([
        supabase
          .from("live_overrides_history")
          .select("id,selector,prop,lang,change_kind,old_value,new_value,actor_email,created_at")
          .eq("page_path", pagePath)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("live_overrides")
          .select("selector,prop,lang,draft_value,published_value,updated_at")
          .eq("page_path", pagePath),
      ]);
      if (cancelled) return;
      setHistory((h.data as any) ?? []);
      const allPending = ((p.data as any[]) ?? []).filter(
        (r) =>
          r.draft_value !== null &&
          r.draft_value !== undefined &&
          JSON.stringify(r.draft_value) !== JSON.stringify(r.published_value),
      );
      setPending(allPending);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, pagePath]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="p-5 border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" /> سجل التعديلات
          </SheetTitle>
          <SheetDescription className="text-xs">
            {pagePath} — كل من قام بتعديل أو نشر، ومتى، وماذا تغيّر.
          </SheetDescription>
          <div className="flex gap-1 mt-2">
            <Button
              size="sm"
              variant={tab === "pending" ? "default" : "outline"}
              onClick={() => setTab("pending")}
              className="h-8"
            >
              <Eye className="h-3.5 w-3.5 me-1" /> غير منشور ({pending.length})
            </Button>
            <Button
              size="sm"
              variant={tab === "history" ? "default" : "outline"}
              onClick={() => setTab("history")}
              className="h-8"
            >
              <FileText className="h-3.5 w-3.5 me-1" /> السجل ({history.length})
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-5 space-y-4">
            {loading && <div className="text-xs text-muted-foreground">جاري التحميل…</div>}

            {tab === "pending" && !loading && (
              pending.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-8">
                  لا توجد تغييرات بانتظار النشر.
                </div>
              ) : (
                pending.map((r) => (
                  <div key={`${r.selector}|${r.prop}|${r.lang}`} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <code className="truncate max-w-[60%]" title={r.selector}>{r.selector.split(">").slice(-2).join(">")}</code>
                      <div className="flex gap-1">
                        <Badge variant="outline" className="h-5 text-[10px]">{r.prop}</Badge>
                        <Badge variant="outline" className="h-5 text-[10px]">{r.lang}</Badge>
                      </div>
                    </div>
                    <DiffRow before={r.published_value} after={r.draft_value} />
                  </div>
                ))
              )
            )}

            {tab === "history" && !loading && (
              history.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-8">لا يوجد سجل بعد.</div>
              ) : (
                history.map((h) => (
                  <div key={h.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="text-muted-foreground">
                        <span className="font-medium text-foreground">{h.actor_email ?? "—"}</span>
                        {" • "}
                        {formatDistanceToNow(new Date(h.created_at), { addSuffix: true, locale: ar })}
                      </div>
                      <div className="flex gap-1">
                        <Badge
                          variant={h.change_kind === "publish" ? "default" : "secondary"}
                          className="h-5 text-[10px]"
                        >
                          {h.change_kind === "publish" ? "نشر" : "مسودة"}
                        </Badge>
                        <Badge variant="outline" className="h-5 text-[10px]">{h.prop}</Badge>
                        <Badge variant="outline" className="h-5 text-[10px]">{h.lang}</Badge>
                      </div>
                    </div>
                    <code className="block text-[10px] text-muted-foreground truncate" title={h.selector}>
                      {h.selector.split(">").slice(-2).join(">")}
                    </code>
                    <DiffRow before={h.old_value} after={h.new_value} />
                  </div>
                ))
              )
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
