import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  LoadingState,
  EmptyState,
  ErrorState,
  SuccessState,
  NoSearchResults,
  OfflineState,
  StateBoundary,
  Truncate,
  ConnectivityBadge,
} from "@/components/states/StateViews";
import { Package, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/admin/states")({
  component: StatesGalleryPage,
});

const LONG_TEXT =
  "هذا نص طويل جدًا لاختبار حالة Long Text وضمان عدم كسر التخطيط أو تجاوز الحاويات. " +
  "يجب أن يُقصّ بشكل أنيق مع توفير tooltip أو السماح للسطر بالالتفاف بدون أن يخرج عن المساحة المتاحة. ".repeat(
    3,
  );

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {title}
        </CardTitle>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function StatesGalleryPage() {
  const [demo, setDemo] = useState<
    "default" | "loading" | "empty" | "error" | "success"
  >("default");

  const items =
    demo === "default"
      ? [{ id: 1, name: "منتج تجريبي" }]
      : demo === "empty"
        ? []
        : [{ id: 1, name: "منتج تجريبي" }];

  return (
    <AdminShell>
      <ConnectivityBadge />
      <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="text-2xl font-semibold">دليل حالات الشاشات</h1>
          <p className="text-sm text-muted-foreground mt-1">
            مكتبة موحدة لكل الحالات المطلوبة: Default, Loading, Empty, Error,
            Success, Disabled, Hover/Active, Mobile, RTL, Long Text، وحالات
            البيانات الكثيرة/القليلة. استخدم{" "}
            <code className="text-xs bg-muted px-1 rounded">
              &lt;StateBoundary&gt;
            </code>{" "}
            لتغليف أي شاشة.
          </p>
        </div>

        {/* Interactive demo */}
        <Section
          title="معاينة StateBoundary التفاعلية"
          description="بدّل الحالة لرؤية كيف يتصرف نفس المكوّن في كل حالة."
        >
          <div className="flex flex-wrap gap-2 mb-4">
            {(["default", "loading", "empty", "error", "success"] as const).map(
              (s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={demo === s ? "default" : "outline"}
                  onClick={() => setDemo(s)}
                >
                  {s}
                </Button>
              ),
            )}
          </div>
          <div className="border rounded-lg p-4 min-h-[260px]">
            {demo === "success" ? (
              <SuccessState
                title="تمّت العملية بنجاح"
                description="تم حفظ التغييرات."
                action={{ label: "متابعة", onClick: () => setDemo("default") }}
              />
            ) : (
              <StateBoundary
                loading={demo === "loading"}
                error={demo === "error" ? new Error("فشل تحميل البيانات") : null}
                isEmpty={items.length === 0}
                onRetry={() => setDemo("default")}
                loadingVariant="list"
                emptyIcon={Package}
                emptyTitle="لا توجد منتجات بعد"
                emptyDescription="ابدأ بإضافة أول منتج إلى المتجر."
                emptyAction={{
                  label: "إضافة منتج",
                  onClick: () => setDemo("default"),
                }}
              >
                <ul className="space-y-2">
                  {items.map((it) => (
                    <li
                      key={it.id}
                      className="border rounded p-3 hover:bg-accent active:bg-accent/70 transition-colors cursor-pointer"
                    >
                      {it.name}
                    </li>
                  ))}
                </ul>
              </StateBoundary>
            )}
          </div>
        </Section>

        {/* Loading variants */}
        <Section
          title="Loading State — Skeletons"
          description="هياكل تحميل مخصّصة لكل تخطيط (قائمة، شبكة، جدول، بطاقة، صفحة)."
        >
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-2">list</p>
              <LoadingState variant="list" rows={3} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">grid</p>
              <LoadingState variant="grid" rows={4} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">table</p>
              <LoadingState variant="table" rows={3} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">card</p>
              <LoadingState variant="card" />
            </div>
          </div>
        </Section>

        {/* Empty variants */}
        <Section title="Empty State">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="border rounded-lg">
              <EmptyState
                icon={ShoppingBag}
                title="سلتك فارغة"
                description="أضف منتجات لإكمال طلبك."
                action={{ label: "تصفح المنتجات", onClick: () => {} }}
              />
            </div>
            <div className="border rounded-lg">
              <NoSearchResults query="فستان أحمر" onClear={() => {}} />
            </div>
          </div>
        </Section>

        {/* Error variants */}
        <Section title="Error State">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="border rounded-lg">
              <ErrorState
                onRetry={() => {}}
                technicalDetails="TypeError: Cannot read properties of undefined"
              />
            </div>
            <div className="space-y-3">
              <ErrorState
                variant="inline"
                title="فشل الحفظ"
                description="تحقق من الحقول وحاول مجددًا."
                onRetry={() => {}}
              />
              <div className="border rounded-lg">
                <OfflineState onRetry={() => {}} />
              </div>
            </div>
          </div>
        </Section>

        {/* Success */}
        <Section title="Success State">
          <div className="border rounded-lg">
            <SuccessState
              title="تم إرسال طلبك بنجاح"
              description="رقم الطلب #1024 — سنرسل لك تحديثات الشحن."
              action={{ label: "تتبّع الطلب", onClick: () => {} }}
            />
          </div>
        </Section>

        {/* Buttons states */}
        <Section
          title="Disabled / Hover / Active / Focus"
          description="حالات الأزرار والروابط — مشتقة من Design Tokens."
        >
          <div className="flex flex-wrap gap-3 items-center">
            <Button>Default</Button>
            <Button className="hover:bg-primary/90">Hover (مرّر فوقه)</Button>
            <Button className="bg-primary/80">Active</Button>
            <Button disabled>Disabled</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="destructive">Destructive</Button>
          </div>
          <div className="mt-4 max-w-sm space-y-2">
            <Input placeholder="Default input" />
            <Input placeholder="Disabled input" disabled />
            <Input placeholder="Focus عليه" autoFocus />
          </div>
        </Section>

        {/* Long text */}
        <Section
          title="Long Text State"
          description="تأكد من قص النصوص الطويلة بدون كسر التخطيط."
        >
          <div className="grid md:grid-cols-3 gap-3">
            <div className="border rounded p-3">
              <p className="text-xs text-muted-foreground mb-1">truncate (سطر)</p>
              <Truncate lines={1}>{LONG_TEXT}</Truncate>
            </div>
            <div className="border rounded p-3">
              <p className="text-xs text-muted-foreground mb-1">line-clamp-2</p>
              <Truncate lines={2}>{LONG_TEXT}</Truncate>
            </div>
            <div className="border rounded p-3">
              <p className="text-xs text-muted-foreground mb-1">break-words</p>
              <p className="break-words text-sm">{LONG_TEXT}</p>
            </div>
          </div>
        </Section>

        {/* Data volume */}
        <Section
          title="بيانات قليلة جدًا / كثيرة جدًا"
          description="استخدم EmptyState عند ندرة البيانات، و virtualization/pagination عند كثرتها."
        >
          <div className="grid md:grid-cols-2 gap-4">
            <div className="border rounded-lg">
              <EmptyState
                title="لا توجد طلبات بعد"
                description="ستظهر الطلبات هنا حال إتمام أول عملية بيع."
                compact
              />
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-2">
                قائمة كثيفة (مع قص + scroll محدود)
              </p>
              <div className="max-h-56 overflow-y-auto divide-y">
                {Array.from({ length: 200 }).map((_, i) => (
                  <div
                    key={i}
                    className="py-2 px-2 text-sm flex justify-between hover:bg-accent"
                  >
                    <Truncate lines={1} className="flex-1">
                      عنصر رقم {i + 1} — {LONG_TEXT}
                    </Truncate>
                    <Badge variant="secondary" className="ms-2 shrink-0">
                      #{i + 1}
                    </Badge>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                لجداول ضخمة استخدم Pagination أو Infinite Scroll.
              </p>
            </div>
          </div>
        </Section>

        {/* Mobile + RTL */}
        <Section
          title="Mobile & RTL"
          description="جميع المكونات مبنية mobile-first وتدعم RTL تلقائيًا. عاين بالتبديل بين العربية والإنجليزية أو تصغير النافذة."
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4 max-w-[360px]" dir="rtl">
              <p className="text-xs text-muted-foreground mb-2">RTL</p>
              <Button className="w-full">زر عربي بعرض كامل</Button>
              <p className="mt-3 text-sm">
                <Truncate lines={2}>{LONG_TEXT}</Truncate>
              </p>
            </div>
            <div className="border rounded-lg p-4 max-w-[360px]" dir="ltr">
              <p className="text-xs text-muted-foreground mb-2">LTR</p>
              <Button className="w-full">Full-width English Button</Button>
              <p className="mt-3 text-sm">
                <Truncate lines={2}>
                  This is a very long English text used to demonstrate that the
                  same components work flawlessly in LTR and adapt to narrow
                  mobile viewports without breaking layout.
                </Truncate>
              </p>
            </div>
          </div>
        </Section>

        <Section title="كيف تستخدمها في شاشاتك">
          <pre className="text-xs bg-muted p-3 rounded overflow-x-auto" dir="ltr">{`import { StateBoundary } from "@/components/states/StateViews";

<StateBoundary
  loading={isLoading}
  error={error}
  isEmpty={items.length === 0}
  onRetry={refetch}
  loadingVariant="grid"
  emptyTitle="لا توجد منتجات"
  emptyAction={{ label: "إضافة منتج", onClick: openCreate }}
>
  {items.map(...)}
</StateBoundary>`}</pre>
        </Section>
      </div>
    </AdminShell>
  );
}
