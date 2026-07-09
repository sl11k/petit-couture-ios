import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Props = {
  url: string;
  fit: "cover" | "contain" | "fill";
  focalX: number; // 0-100
  focalY: number; // 0-100
  scale: number; // 0.5-3
  frameHeight?: number; // px (defaults to 240 for preview)
  onChange: (patch: Partial<{ focalX: number; focalY: number; scale: number }>) => void;
};

/**
 * Interactive visual editor for the ORIGINAL uploaded banner image.
 * - Drag the image to pan (updates focalX/focalY)
 * - Wheel or slider to zoom (updates scale)
 * - Side thumbnail shows the raw image with a rectangle indicating the visible crop
 */
export function BannerImageEditor({
  url,
  fit,
  focalX,
  focalY,
  scale,
  frameHeight = 240,
  onChange,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number; fx: number; fy: number } | null>(null);

  useEffect(() => {
    if (!url) return;
    const img = new Image();
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
  }, [url]);

  const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));

  const onPointerDown = (e: React.PointerEvent) => {
    if (fit === "fill") return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, fx: focalX, fy: focalY };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !dragStart.current || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    // Drag right → reveal LEFT of image → focalX decreases
    const nextFx = clamp(dragStart.current.fx - (dx / rect.width) * 100);
    const nextFy = clamp(dragStart.current.fy - (dy / rect.height) * 100);
    onChange({ focalX: Math.round(nextFx), focalY: Math.round(nextFy) });
  };
  const onPointerUp = () => {
    setDragging(false);
    dragStart.current = null;
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    const next = Math.max(0.5, Math.min(3, +(scale + delta).toFixed(2)));
    onChange({ scale: next });
  };

  // Compute the "visible rectangle" over the raw thumbnail to guide the user.
  // Only meaningful with cover + scale >= 1.
  const rectStyle = (() => {
    if (!natural || fit !== "cover") return null;
    const frameAspect = 16 / 6; // approximate; we don't know real width here
    const imgAspect = natural.w / natural.h;
    // Fraction of image width & height that fits inside the frame at scale=1
    let wFrac: number;
    let hFrac: number;
    if (imgAspect > frameAspect) {
      // image is wider — height fills, width crops
      hFrac = 1;
      wFrac = frameAspect / imgAspect;
    } else {
      wFrac = 1;
      hFrac = imgAspect / frameAspect;
    }
    // scale > 1 zooms in → visible fraction shrinks
    wFrac = Math.min(1, wFrac / scale);
    hFrac = Math.min(1, hFrac / scale);
    const left = clamp(((focalX / 100) * (1 - wFrac)) * 100, 0, 100 - wFrac * 100);
    const top = clamp(((focalY / 100) * (1 - hFrac)) * 100, 0, 100 - hFrac * 100);
    return {
      left: `${left}%`,
      top: `${top}%`,
      width: `${wFrac * 100}%`,
      height: `${hFrac * 100}%`,
    };
  })();

  if (!url) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">
          محرر الصورة الأصلية — اسحب الصورة لتحريكها، وعجلة الماوس للتكبير
        </Label>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-[11px]"
          onClick={() => onChange({ focalX: 50, focalY: 50, scale: 1 })}
        >
          توسيط
        </Button>
      </div>

      <div className="grid grid-cols-[1fr_120px] gap-3">
        {/* Live frame — same rendering as published banner */}
        <div
          ref={frameRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          className="relative overflow-hidden rounded-md border border-border bg-muted select-none"
          style={{
            height: frameHeight,
            cursor: fit === "fill" ? "default" : dragging ? "grabbing" : "grab",
            touchAction: "none",
          }}
          title="اسحب لتحريك الصورة الأصلية داخل إطار البانر"
        >
          <img
            src={url}
            alt=""
            draggable={false}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{
              objectFit: fit,
              objectPosition: `${focalX}% ${focalY}%`,
              transform: `scale(${scale})`,
              transformOrigin: `${focalX}% ${focalY}%`,
            }}
          />
          <div className="absolute bottom-1 start-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
            المعاينة الفعلية للبانر
          </div>
        </div>

        {/* Thumbnail of the RAW uploaded image with crop rectangle overlay */}
        <div className="space-y-1">
          <div className="relative rounded-md border border-border overflow-hidden bg-[repeating-conic-gradient(#eee_0deg_25%,transparent_0_50%)]">
            <img
              src={url}
              alt=""
              draggable={false}
              className="block w-full h-auto"
              style={{ maxHeight: 160, objectFit: "contain" }}
            />
            {rectStyle && (
              <div
                className="absolute border-2 border-primary/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] pointer-events-none"
                style={rectStyle}
              />
            )}
          </div>
          <div className="text-[10px] text-muted-foreground text-center">
            الصورة الأصلية — الإطار = الجزء الظاهر
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">تكبير</Label>
          <span className="text-xs text-muted-foreground">{scale.toFixed(2)}x</span>
        </div>
        <input
          type="range"
          min={0.5}
          max={3}
          step={0.05}
          value={scale}
          onChange={(e) => onChange({ scale: Number(e.target.value) })}
          className="w-full accent-primary"
        />
      </div>
    </div>
  );
}
