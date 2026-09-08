import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/i18n/LanguageContext";
import { Loader2, RotateCw, ZoomIn } from "lucide-react";

export type CroppedItem = { blob: Blob; name: string; type: string };

const ASPECTS: { value: string; label_ar: string; label_en: string; ratio: number }[] = [
  { value: "4:5", label_ar: "4:5 (موصى بها)", label_en: "4:5 (recommended)", ratio: 4 / 5 },
  { value: "1:1", label_ar: "1:1 مربع", label_en: "1:1 square", ratio: 1 },
  { value: "3:4", label_ar: "3:4", label_en: "3:4", ratio: 3 / 4 },
  { value: "16:9", label_ar: "16:9", label_en: "16:9", ratio: 16 / 9 },
  { value: "free", label_ar: "بدون قص", label_en: "Original", ratio: 0 },
];

async function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function getCroppedBlob(
  imageSrc: string,
  area: Area,
  rotation: number,
  mime: string,
): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = imageSrc;
  });
  const rad = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const bBoxW = img.width * cos + img.height * sin;
  const bBoxH = img.width * sin + img.height * cos;
  const canvas = document.createElement("canvas");
  canvas.width = bBoxW;
  canvas.height = bBoxH;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(bBoxW / 2, bBoxH / 2);
  ctx.rotate(rad);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  const data = ctx.getImageData(area.x, area.y, area.width, area.height);
  canvas.width = area.width;
  canvas.height = area.height;
  ctx.putImageData(data, 0, 0);
  const outMime = mime === "image/png" ? "image/png" : "image/jpeg";
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("blob failed"))),
      outMime,
      0.92,
    );
  });
}

type Props = {
  files: File[];
  open: boolean;
  onClose: () => void;
  onDone: (items: CroppedItem[]) => void;
  defaultAspect?: string;
};

export function ImageCropDialog({ files, open, onClose, onDone, defaultAspect = "4:5" }: Props) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [index, setIndex] = useState(0);
  const [src, setSrc] = useState<string>("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspectKey, setAspectKey] = useState(defaultAspect);
  const [area, setArea] = useState<Area | null>(null);
  const [results, setResults] = useState<CroppedItem[]>([]);
  const [busy, setBusy] = useState(false);

  const aspect = ASPECTS.find((a) => a.value === aspectKey)?.ratio || 4 / 5;
  const file = files[index];

  useEffect(() => {
    if (!open) return;
    setIndex(0);
    setResults([]);
    setAspectKey(defaultAspect);
  }, [open, defaultAspect]);

  useEffect(() => {
    let cancelled = false;
    if (!file) return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setArea(null);
    readFile(file).then((s) => { if (!cancelled) setSrc(s); });
    return () => { cancelled = true; };
  }, [file]);

  const onCropComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), []);

  const finishCurrent = async (skipCrop: boolean) => {
    if (!file) return null;
    if (skipCrop || !area) {
      return { blob: file, name: file.name, type: file.type } as CroppedItem;
    }
    const blob = await getCroppedBlob(src, area, rotation, file.type);
    const baseName = file.name.replace(/\.[^.]+$/, "");
    const ext = blob.type === "image/png" ? "png" : "jpg";
    return { blob, name: `${baseName}-cropped.${ext}`, type: blob.type } as CroppedItem;
  };

  const handleNext = async () => {
    setBusy(true);
    try {
      const item = await finishCurrent(aspectKey === "free");
      const next = item ? [...results, item] : results;
      setResults(next);
      if (index + 1 >= files.length) {
        onDone(next);
      } else {
        setIndex(index + 1);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSkip = async () => {
    setBusy(true);
    try {
      const item = await finishCurrent(true);
      const next = item ? [...results, item] : results;
      setResults(next);
      if (index + 1 >= files.length) onDone(next);
      else setIndex(index + 1);
    } finally { setBusy(false); }
  };

  const handleCancel = () => { onClose(); };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {ar ? "ضبط الصورة قبل الرفع" : "Adjust image before upload"}
            <span className="ms-2 text-xs text-muted-foreground font-normal">
              {index + 1} / {files.length}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="relative w-full h-[380px] sm:h-[440px] bg-muted rounded-md overflow-hidden">
          {src ? (
            aspectKey === "free" ? (
              <div className="w-full h-full flex items-center justify-center p-2">
                <img src={src} alt="" className="max-w-full max-h-full object-contain" />
              </div>
            ) : (
              <Cropper
                image={src}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={aspect}
                showGrid
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onRotationChange={setRotation}
                onCropComplete={onCropComplete}
                objectFit="contain"
              />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground min-w-16">
              {ar ? "النسبة" : "Aspect"}
            </label>
            <Select value={aspectKey} onValueChange={setAspectKey}>
              <SelectTrigger className="h-8 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASPECTS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {ar ? a.label_ar : a.label_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {aspectKey !== "free" && (
            <>
              <div className="flex items-center gap-3">
                <ZoomIn className="h-4 w-4 text-muted-foreground" />
                <Slider
                  value={[zoom]}
                  min={1}
                  max={4}
                  step={0.01}
                  onValueChange={(v) => setZoom(v[0])}
                  className="flex-1"
                />
                <span className="text-xs w-10 text-end">{zoom.toFixed(1)}x</span>
              </div>
              <div className="flex items-center gap-3">
                <RotateCw className="h-4 w-4 text-muted-foreground" />
                <Slider
                  value={[rotation]}
                  min={0}
                  max={360}
                  step={1}
                  onValueChange={(v) => setRotation(v[0])}
                  className="flex-1"
                />
                <span className="text-xs w-10 text-end">{rotation}°</span>
              </div>
            </>
          )}
          <p className="text-[11px] text-muted-foreground">
            {ar
              ? "اسحب داخل المربع لتحريك الصورة، واستخدم الزوم لتقريبها. اختر نسبة 4:5 للحصول على أفضل مظهر في صفحات المنتجات."
              : "Drag the image inside the frame and zoom to reposition. 4:5 is recommended for product pages."}
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="ghost" onClick={handleCancel} disabled={busy}>
            {ar ? "إلغاء" : "Cancel"}
          </Button>
          <Button type="button" variant="outline" onClick={handleSkip} disabled={busy}>
            {ar ? "استخدام الأصلية" : "Use original"}
          </Button>
          <Button type="button" onClick={handleNext} disabled={busy || !src}>
            {busy && <Loader2 className="h-4 w-4 animate-spin me-1" />}
            {index + 1 >= files.length
              ? (ar ? "حفظ ورفع" : "Save & upload")
              : (ar ? "التالي" : "Next")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
