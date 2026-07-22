import { useCallback, useId, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Star, Trash2, GripVertical, Loader2, ImagePlus, Film, AlertTriangle, RotateCcw, CheckCircle2, XCircle, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { IMAGE_MAX_BYTES, VIDEO_MAX_BYTES } from "./MediaUploader";
import { cn } from "@/lib/utils";
import { ImageCropDialog, type CroppedItem } from "./ImageCropDialog";

type Props = {
  /** Array of media URLs. First item is the "main" media. */
  value: string[];
  onChange: (urls: string[]) => void;
  bucket?: string;
  folder?: string;
  /** Max number of items */
  max?: number;
  /** Media kind. Defaults to "image". */
  kind?: "image" | "video";
};

function SortableThumb({
  url,
  isMain,
  onMakeMain,
  onRemove,
  ar,
  kind,
}: {
  url: string;
  isMain: boolean;
  onMakeMain: () => void;
  onRemove: () => void;
  ar: boolean;
  kind: "image" | "video";
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: url });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  } as React.CSSProperties;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group rounded-md overflow-hidden border bg-muted/30",
        isMain && "ring-2 ring-primary",
      )}
    >
      {kind === "video" ? (
        <video src={url} className="w-full h-28 object-cover bg-black" muted playsInline preload="metadata" />
      ) : (
        <img src={url} alt="" className="w-full h-28 object-cover" />
      )}
      <div className="absolute top-1 start-1 flex gap-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="p-1 rounded bg-background/80 hover:bg-background cursor-grab active:cursor-grabbing"
          aria-label={ar ? "إعادة الترتيب" : "Reorder"}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="absolute top-1 end-1 flex gap-1">
        {!isMain && (
          <button
            type="button"
            onClick={onMakeMain}
            className="p-1 rounded bg-background/80 hover:bg-primary hover:text-primary-foreground"
            aria-label={ar ? "تعيين كصورة رئيسية" : "Set as main"}
            title={ar ? "تعيين كرئيسية" : "Set as main"}
          >
            <Star className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="p-1 rounded bg-background/80 hover:bg-destructive hover:text-destructive-foreground"
          aria-label={ar ? "حذف" : "Remove"}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {isMain && (
        <div className="absolute bottom-1 start-1 text-[10px] font-medium bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
          {ar ? "رئيسية" : "Main"}
        </div>
      )}
    </div>
  );
}

export function ProductMediaGallery({
  value,
  onChange,
  bucket = "product-media",
  folder = "gallery",
  max = 20,
  kind = "image",
}: Props) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [cropOpen, setCropOpen] = useState(false);
  const [lastError, setLastError] = useState<{ title: string; lines: string[] } | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const dragDepthRef = useRef(0);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const urls = Array.isArray(value) ? value.filter(Boolean) : [];
  const isVideo = kind === "video";

  const uploadItems = useCallback(async (items: { blob: Blob; name: string; type: string }[]) => {
    setUploading(true);
    const next = [...urls];
    const maxBytes = isVideo ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES;
    for (const it of items) {
      if (it.blob.size > maxBytes) {
        toast.error(ar ? `${it.name}: حجم كبير` : `${it.name}: too large`);
        continue;
      }
      const ext = it.name.split(".").pop()?.toLowerCase() || (isVideo ? "mp4" : "jpg");
      const safe = it.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 40) || (isVideo ? "vid" : "img");
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2,8)}-${safe}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, it.blob, {
        cacheControl: "3600",
        upsert: false,
        contentType: it.type,
      });
      if (error) { toast.error(error.message); continue; }
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      next.push(data.publicUrl);
    }
    onChange(next);
    setUploading(false);
  }, [urls, bucket, folder, ar, onChange, isVideo]);

  const readImageMeta = (file: File) =>
    new Promise<{ w: number; h: number } | null>((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve({ w: img.naturalWidth, h: img.naturalHeight }); };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });

  const handleFilesSelected = useCallback(async (files: FileList | null) => {
    setLastError(null);
    if (!files || files.length === 0) return;
    const remaining = max - urls.length;
    const list = Array.from(files).slice(0, remaining);
    if (list.length === 0) {
      const title = ar ? `الحد الأقصى ${max} ${isVideo ? "فيديو" : "صورة"}` : `Max ${max} ${isVideo ? "videos" : "images"}`;
      setLastError({ title, lines: [] });
      return;
    }
    const typePrefix = isVideo ? "video/" : "image/";
    const valid: File[] = [];
    const rejected: { name: string; reason: string }[] = [];
    for (const f of list) {
      if (!f.type.startsWith(typePrefix)) {
        rejected.push({ name: f.name, reason: ar ? (isVideo ? "يجب اختيار فيديوهات فقط" : "يجب اختيار صور فقط") : (isVideo ? "Videos only" : "Images only") });
        continue;
      }
      if (!isVideo) {
        // Format: JPG or WebP only
        const allowed = ["image/jpeg", "image/jpg", "image/webp", "image/pjpeg"];
        if (!allowed.includes(f.type.toLowerCase())) {
          rejected.push({ name: f.name, reason: ar ? "يُقبل JPG أو WebP فقط" : "Only JPG or WebP allowed" });
          continue;
        }
        // Size: max 5MB before crop
        if (f.size > 5 * 1024 * 1024) {
          rejected.push({ name: f.name, reason: ar ? `الحجم أكبر من 5MB (${(f.size / (1024 * 1024)).toFixed(1)}MB)` : `Exceeds 5MB (${(f.size / (1024 * 1024)).toFixed(1)}MB)` });
          continue;
        }
        const meta = await readImageMeta(f);
        if (!meta) {
          rejected.push({ name: f.name, reason: ar ? "تعذّر قراءة أبعاد الصورة" : "Could not read image dimensions" });
          continue;
        }
        // Min dimensions
        if (meta.w < 1000 || meta.h < 1000) {
          rejected.push({ name: f.name, reason: ar ? `أبعاد صغيرة جدًا (${meta.w}×${meta.h}). الحد الأدنى 1000×1000px` : `Too small (${meta.w}×${meta.h}). Minimum 1000×1000px` });
          continue;
        }
        // Max dimensions (prevent oversized uploads)
        if (meta.w > 4000 || meta.h > 4000) {
          rejected.push({ name: f.name, reason: ar ? `أبعاد كبيرة جدًا (${meta.w}×${meta.h}). الحد الأقصى 4000×4000px` : `Too large (${meta.w}×${meta.h}). Maximum 4000×4000px` });
          continue;
        }
        // Aspect ratio advisory (4:5 or 1:1)
        const ratio = meta.w / meta.h;
        const okAspect = Math.abs(ratio - 0.8) < 0.06 || Math.abs(ratio - 1) < 0.06;
        if (!okAspect) {
          toast.warning(ar ? `${f.name}: النسبة ${ratio.toFixed(2)} ليست مثالية — استخدم القاصّ لضبطها إلى 4:5 أو 1:1` : `${f.name}: aspect ${ratio.toFixed(2)} not ideal — use the cropper (4:5 or 1:1)`);
        }
      }
      valid.push(f);
    }
    if (valid.length === 0) {
      if (rejected.length > 0) {
        const title = ar ? `لم يتم رفع أي صورة` : "No images uploaded";
        const lines = rejected.map((r) => `${r.name}: ${r.reason}`);
        setLastError({ title, lines });
      }
      return;
    }
    if (isVideo) {
      await uploadItems(valid.map((f) => ({ blob: f, name: f.name, type: f.type })));
    } else {
      setPendingFiles(valid);
      setCropOpen(true);
    }
  }, [urls.length, max, ar, isVideo, uploadItems]);

  const handleCropDone = useCallback(async (items: CroppedItem[]) => {
    setCropOpen(false);
    setPendingFiles([]);
    if (items.length > 0) await uploadItems(items);
  }, [uploadItems]);

  const handleRemove = async (url: string) => {
    try {
      const marker = `/storage/v1/object/public/${bucket}/`;
      const idx = url.indexOf(marker);
      if (idx !== -1) {
        await supabase.storage.from(bucket).remove([url.slice(idx + marker.length)]);
      }
    } catch { /* ignore */ }
    onChange(urls.filter((u) => u !== url));
  };

  const handleMakeMain = (url: string) => {
    onChange([url, ...urls.filter((u) => u !== url)]);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = urls.indexOf(String(active.id));
    const newIndex = urls.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(urls, oldIndex, newIndex));
  };

  const retryUpload = () => {
    setLastError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.click();
    }
  };

  const specs = isVideo
    ? (ar ? [
      { icon: Film, ok: true, text: "الصيغة: MP4 أو WebM" },
      { icon: CheckCircle2, ok: true, text: "الحد الأقصى للحجم: 50MB" },
      { icon: CheckCircle2, ok: true, text: "أول فيديو يُعرض كرئيسي" },
    ] : [
      { icon: Film, ok: true, text: "Format: MP4 or WebM" },
      { icon: CheckCircle2, ok: true, text: "Max size: 50MB" },
      { icon: CheckCircle2, ok: true, text: "First video is the main one" },
    ])
    : (ar ? [
      { icon: CheckCircle2, ok: true, text: "الصيغة: JPG أو WebP فقط" },
      { icon: CheckCircle2, ok: true, text: "الحجم الأقصى: 5MB لكل صورة" },
      { icon: CheckCircle2, ok: true, text: "الأبعاد: 1000–4000px" },
      { icon: CheckCircle2, ok: true, text: "المقاس المثالي: 1200×1500px (4:5) أو 1200×1200px (1:1)" },
      { icon: CheckCircle2, ok: true, text: "يمكن التعديل بالقاصّ قبل الحفظ" },
    ] : [
      { icon: CheckCircle2, ok: true, text: "Format: JPG or WebP only" },
      { icon: CheckCircle2, ok: true, text: "Max size: 5MB per image" },
      { icon: CheckCircle2, ok: true, text: "Dimensions: 1000–4000px" },
      { icon: CheckCircle2, ok: true, text: "Ideal size: 1200×1500px (4:5) or 1200×1200px (1:1)" },
      { icon: CheckCircle2, ok: true, text: "You can adjust cropping before saving" },
    ]);

  return (
    <div className="space-y-3">
      {/* Instruction card */}
      <div className="rounded-lg border bg-muted/20 p-3 text-sm">
        <div className="flex items-center gap-2 mb-2">
          <Upload className="h-4 w-4 text-primary" />
          <span className="font-medium">
            {ar ? "مواصفات الصور المطلوبة" : "Required image specifications"}
          </span>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {specs.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-muted-foreground">
              <s.icon className={cn("h-4 w-4 mt-0.5 shrink-0", s.ok ? "text-emerald-500" : "text-amber-500")} />
              <span className="text-xs leading-5">{s.text}</span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-muted-foreground mt-2">
          {ar
            ? "أي صورة لا تطابق المواصفات لن تُرفع. استخدم زر إعادة المحاولة لاختيار صورة أخرى."
            : "Any image that does not match the specifications will not be uploaded. Use the retry button to pick another image."}
        </p>
      </div>

      {/* Error alert */}
      {lastError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" />
                <span className="font-medium text-sm">{lastError.title}</span>
              </div>
              {lastError.lines.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-destructive/90">
                  {lastError.lines.map((line, i) => (
                    <li key={i} className="break-words">• {line}</li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={retryUpload}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {ar ? "إعادة المحاولة" : "Retry"}
            </button>
          </div>
        </div>
      )}

      <div
        onDragEnter={(e) => {
          if (!e.dataTransfer?.types?.includes("Files")) return;
          e.preventDefault();
          dragDepthRef.current += 1;
          setIsDraggingFiles(true);
        }}
        onDragOver={(e) => {
          if (!e.dataTransfer?.types?.includes("Files")) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={() => {
          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
          if (dragDepthRef.current === 0) setIsDraggingFiles(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragDepthRef.current = 0;
          setIsDraggingFiles(false);
          if (e.dataTransfer?.files?.length) handleFilesSelected(e.dataTransfer.files);
        }}
        className={cn(
          "relative rounded-lg border-2 border-dashed border-transparent p-2 transition",
          isDraggingFiles && "border-primary bg-primary/5",
        )}
      >
        {isDraggingFiles && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-primary/10 backdrop-blur-[1px]">
            <Upload className="h-8 w-8 text-primary" />
            <span className="mt-2 text-sm font-medium text-primary">
              {ar ? `أفلت الصور هنا لرفعها (${max - urls.length} متبقٍ)` : `Drop images to upload (${max - urls.length} left)`}
            </span>
          </div>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={urls} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {urls.map((url, i) => (
                <SortableThumb
                  key={url}
                  url={url}
                  isMain={i === 0}
                  onMakeMain={() => handleMakeMain(url)}
                  onRemove={() => handleRemove(url)}
                  ar={ar}
                  kind={kind}
                />
              ))}
              {urls.length < max && (
                <label
                  htmlFor={inputId}
                  className={cn(
                    "flex flex-col items-center justify-center h-28 rounded-md border-2 border-dashed cursor-pointer text-center px-2",
                    "bg-muted/20 hover:bg-muted/40 hover:border-primary/50 transition",
                    uploading && "pointer-events-none opacity-70",
                  )}
                >
                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : isVideo ? (
                    <>
                      <Film className="h-5 w-5 text-muted-foreground" />
                      <span className="text-[10px] mt-1 text-muted-foreground">
                        {ar ? "إضافة أو إفلات فيديوهات" : "Add or drop videos"}
                      </span>
                    </>
                  ) : (
                    <>
                      <ImagePlus className="h-5 w-5 text-muted-foreground" />
                      <span className="text-[10px] mt-1 text-muted-foreground leading-tight">
                        {ar ? "اسحب وأفلت عدة صور هنا أو انقر للاختيار" : "Drag & drop multiple images or click to browse"}
                      </span>
                    </>
                  )}
                  <input
                    id={inputId}
                    ref={inputRef}
                    type="file"
                    accept={isVideo ? "video/*" : "image/jpeg,image/webp"}
                    multiple
                    className="sr-only"
                    onChange={(e) => { handleFilesSelected(e.target.files); if (inputRef.current) inputRef.current.value = ""; }}
                    disabled={uploading}
                  />
                </label>
              )}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <p className="text-[10px] text-muted-foreground">
        {ar
          ? isVideo
            ? `أول فيديو هو الرئيسي. اسحب لإعادة الترتيب. (${urls.length}/${max})`
            : `أول صورة هي الرئيسية. JPG أو WebP فقط، الحد 5MB، الأبعاد ≥ 1000px، الموصى 1200×1500 أو 1200×1200. (${urls.length}/${max})`
          : isVideo
            ? `First video is the main. Drag to reorder. (${urls.length}/${max})`
            : `First image is the main. JPG or WebP only, max 5MB, ≥ 1000px, recommended 1200×1500 or 1200×1200. (${urls.length}/${max})`}
      </p>
      {!isVideo && (
        <ImageCropDialog
          files={pendingFiles}
          open={cropOpen}
          onClose={() => { setCropOpen(false); setPendingFiles([]); }}
          onDone={handleCropDone}
        />
      )}
    </div>
  );
}
