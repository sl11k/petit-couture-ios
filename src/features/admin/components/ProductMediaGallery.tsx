import { useCallback, useId, useState } from "react";
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
import { Star, Trash2, GripVertical, Loader2, ImagePlus, Film } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { IMAGE_MAX_BYTES, VIDEO_MAX_BYTES } from "./MediaUploader";
import { cn } from "@/lib/utils";

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
}: Props) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const inputId = useId();
  const [uploading, setUploading] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const urls = Array.isArray(value) ? value.filter(Boolean) : [];

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = max - urls.length;
    const list = Array.from(files).slice(0, remaining);
    if (list.length === 0) {
      toast.error(ar ? `الحد الأقصى ${max} صورة` : `Max ${max} images`);
      return;
    }
    setUploading(true);
    const next = [...urls];
    for (const file of list) {
      if (!file.type.startsWith("image/")) {
        toast.error(ar ? "يجب اختيار صور فقط" : "Images only");
        continue;
      }
      if (file.size > IMAGE_MAX_BYTES) {
        toast.error(ar ? `${file.name}: حجم كبير` : `${file.name}: too large`);
        continue;
      }
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const safe = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 40) || "img";
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2,8)}-${safe}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (error) {
        toast.error(error.message);
        continue;
      }
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      next.push(data.publicUrl);
    }
    onChange(next);
    setUploading(false);
  }, [urls, max, bucket, folder, ar, onChange]);

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

  return (
    <div className="space-y-2">
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
              />
            ))}
            {urls.length < max && (
              <label
                htmlFor={inputId}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleUpload(e.dataTransfer.files); }}
                className={cn(
                  "flex flex-col items-center justify-center h-28 rounded-md border-2 border-dashed cursor-pointer",
                  "bg-muted/20 hover:bg-muted/40 hover:border-primary/50 transition",
                  uploading && "pointer-events-none opacity-70",
                )}
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  <>
                    <ImagePlus className="h-5 w-5 text-muted-foreground" />
                    <span className="text-[10px] mt-1 text-muted-foreground">
                      {ar ? "إضافة صور" : "Add images"}
                    </span>
                  </>
                )}
                <input
                  id={inputId}
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => handleUpload(e.target.files)}
                  disabled={uploading}
                />
              </label>
            )}
          </div>
        </SortableContext>
      </DndContext>
      <p className="text-[10px] text-muted-foreground">
        {ar
          ? `أول صورة هي الرئيسية. اسحب لإعادة الترتيب. (${urls.length}/${max})`
          : `First image is the main. Drag to reorder. (${urls.length}/${max})`}
      </p>
    </div>
  );
}
