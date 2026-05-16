import { useCallback, useId, useRef, useState } from "react";
import { Upload, X, Link as LinkIcon, Image as ImageIcon, Film, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

export type MediaKind = "image" | "video" | "any";

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;   // 10MB
export const VIDEO_MAX_BYTES = 200 * 1024 * 1024;  // 200MB

const IMAGE_MIME = ["image/jpeg","image/png","image/webp","image/gif","image/avif","image/svg+xml"];
const VIDEO_MIME = ["video/mp4","video/webm","video/quicktime"];

export function isVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

export type MediaUploaderProps = {
  value?: string | null;
  onChange: (url: string | null) => void;
  bucket: string;
  kind?: MediaKind;
  folder?: string;
  allowExternalUrl?: boolean;
  className?: string;
};

export function MediaUploader({
  value,
  onChange,
  bucket,
  kind = "image",
  folder,
  allowExternalUrl = true,
  className,
}: MediaUploaderProps) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [showUrl, setShowUrl] = useState(false);

  const accept = kind === "video"
    ? VIDEO_MIME.join(",")
    : kind === "any"
      ? [...IMAGE_MIME, ...VIDEO_MIME].join(",")
      : IMAGE_MIME.join(",");

  const validate = (file: File): string | null => {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (kind === "image" && !isImage) return ar ? "يجب اختيار ملف صورة" : "Please choose an image file";
    if (kind === "video" && !isVideo) return ar ? "يجب اختيار ملف فيديو" : "Please choose a video file";
    if (kind === "any" && !isImage && !isVideo) return ar ? "نوع ملف غير مدعوم" : "Unsupported file type";
    const max = isVideo ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES;
    if (file.size > max) {
      const mb = Math.round(max / 1024 / 1024);
      return ar
        ? `حجم الملف يتجاوز الحد (${mb} ميجابايت)`
        : `File exceeds max size (${mb}MB)`;
    }
    return null;
  };

  const uploadFile = useCallback(async (file: File) => {
    const err = validate(file);
    if (err) { toast.error(err); return; }
    setUploading(true);
    setProgress(10);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const safeBase = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 40) || "file";
      const path = `${folder ? folder.replace(/^\/+|\/+$/g, "") + "/" : ""}${Date.now()}-${Math.random().toString(36).slice(2,8)}-${safeBase}.${ext}`;
      setProgress(40);
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (upErr) throw upErr;
      setProgress(80);
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      setProgress(100);
      onChange(data.publicUrl);
      toast.success(ar ? "تم الرفع" : "Uploaded");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || (ar ? "فشل الرفع" : "Upload failed"));
    } finally {
      setTimeout(() => { setUploading(false); setProgress(0); }, 400);
    }
  }, [bucket, folder, kind, onChange, ar]);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    uploadFile(files[0]);
  };

  const handleRemove = async () => {
    if (!value) return;
    // try to delete from same bucket if URL matches
    try {
      const marker = `/storage/v1/object/public/${bucket}/`;
      const idx = value.indexOf(marker);
      if (idx !== -1) {
        const path = value.slice(idx + marker.length);
        await supabase.storage.from(bucket).remove([path]);
      }
    } catch { /* ignore */ }
    onChange(null);
  };

  const isVid = isVideoUrl(value);

  return (
    <div className={cn("space-y-2", className)}>
      {value ? (
        <div className="relative group rounded-md overflow-hidden border bg-muted/30">
          {isVid ? (
            <video src={value} controls className="w-full max-h-64 object-contain bg-black" />
          ) : (
            <img src={value} alt="" className="w-full max-h-64 object-contain bg-white" />
          )}
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 end-2 p-1.5 rounded-full bg-background/80 hover:bg-destructive hover:text-destructive-foreground transition"
            aria-label={ar ? "حذف" : "Remove"}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 cursor-pointer transition",
            "bg-muted/20 hover:bg-muted/40 hover:border-primary/50",
            dragOver && "border-primary bg-primary/5",
            uploading && "pointer-events-none opacity-70",
          )}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : kind === "video" ? (
            <Film className="h-6 w-6 text-muted-foreground" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          )}
          <div className="text-xs text-center text-muted-foreground">
            {uploading
              ? (ar ? "جاري الرفع..." : "Uploading...")
              : (
                <>
                  <span className="font-medium text-foreground">{ar ? "اضغط للاختيار" : "Click to choose"}</span>
                  {" "}{ar ? "أو اسحب الملف هنا" : "or drag a file here"}
                </>
              )}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {kind === "video"
              ? (ar ? "MP4 / WebM — حتى 200MB" : "MP4 / WebM — up to 200MB")
              : kind === "any"
                ? (ar ? "صورة حتى 10MB أو فيديو حتى 200MB" : "Image up to 10MB or video up to 200MB")
                : (ar ? "JPG / PNG / WebP — حتى 10MB" : "JPG / PNG / WebP — up to 10MB")}
          </div>
          <input
            id={inputId}
            ref={inputRef}
            type="file"
            accept={accept}
            className="sr-only"
            onChange={(e) => handleFiles(e.target.files)}
            disabled={uploading}
          />
        </label>
      )}

      {uploading && <Progress value={progress} className="h-1.5" />}

      {allowExternalUrl && !value && (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setShowUrl((v) => !v)}
            className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <LinkIcon className="h-3 w-3" />
            {ar ? "أو لصق رابط خارجي" : "Or paste external URL"}
          </button>
          {showUrl && (
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const v = (e.target as HTMLInputElement).value.trim();
                    if (v) onChange(v);
                  }
                }}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v) onChange(v);
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
