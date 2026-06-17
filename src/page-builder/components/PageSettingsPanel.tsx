import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MediaUploader } from "@/features/admin/components/MediaUploader";
import type { CmsPage } from "../schemas/pageSchema";

export function PageSettingsPanel({
  page,
  onChange,
}: {
  page: CmsPage;
  onChange: (patch: Partial<CmsPage>) => void;
}) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <Label className="text-xs">العنوان (عربي)</Label>
        <Input value={page.title_ar} onChange={(e) => onChange({ title_ar: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">العنوان (English)</Label>
        <Input value={page.title_en} onChange={(e) => onChange({ title_en: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">الرابط (Slug)</Label>
        <Input
          value={page.slug}
          disabled={page.is_system}
          onChange={(e) => onChange({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
        />
        {page.is_system && <p className="text-xs text-muted-foreground mt-1">صفحة نظام — لا يمكن تغيير الرابط</p>}
      </div>

      <div className="pt-3 border-t border-border">
        <h4 className="font-medium mb-2">SEO</h4>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">SEO Title (عربي)</Label>
            <Input value={page.seo_title_ar ?? ""} onChange={(e) => onChange({ seo_title_ar: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">SEO Title (English)</Label>
            <Input value={page.seo_title_en ?? ""} onChange={(e) => onChange({ seo_title_en: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">SEO Description (عربي)</Label>
            <Textarea rows={2} value={page.seo_description_ar ?? ""} onChange={(e) => onChange({ seo_description_ar: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">SEO Description (English)</Label>
            <Textarea rows={2} value={page.seo_description_en ?? ""} onChange={(e) => onChange({ seo_description_en: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">صورة المشاركة (OG)</Label>
            <MediaUploader
              value={page.og_image_url}
              onChange={(url) => onChange({ og_image_url: url })}
              bucket="public-assets"
              kind="image"
              folder="cms/og"
            />
          </div>
          <div>
            <Label className="text-xs">Canonical URL</Label>
            <Input value={page.canonical_url ?? ""} onChange={(e) => onChange({ canonical_url: e.target.value })} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">منع الفهرسة (noindex)</Label>
            <Switch checked={page.noindex} onCheckedChange={(v) => onChange({ noindex: v })} />
          </div>
        </div>
      </div>
    </div>
  );
}
