import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Loader2, MapPin } from "lucide-react";

// Lazy-load Leaflet only on the client (avoids SSR "window is not defined").
type LatLng = { lat: number; lng: number };

export type ResolvedLocation = LatLng & {
  address?: string;
  city?: string;
  district?: string;
  street?: string;
  postalCode?: string;
  country?: string;
};

type Props = {
  value?: LatLng | null;
  onChange: (loc: ResolvedLocation) => void;
  isRTL?: boolean;
  // Default: Riyadh
  fallback?: LatLng;
};

// Saudi Arabia bounding box (approx) — used to flag out-of-coverage pins.
const SA_BOUNDS = { minLat: 16.0, maxLat: 32.5, minLng: 34.5, maxLng: 55.7 };

function inSaudi({ lat, lng }: LatLng) {
  return (
    lat >= SA_BOUNDS.minLat &&
    lat <= SA_BOUNDS.maxLat &&
    lng >= SA_BOUNDS.minLng &&
    lng <= SA_BOUNDS.maxLng
  );
}

async function reverseGeocode(
  { lat, lng }: LatLng,
  lang: "ar" | "en",
): Promise<ResolvedLocation> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=${lang}&zoom=18`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) throw new Error("geocode failed");
    const data: any = await res.json();
    const a = data.address ?? {};
    return {
      lat,
      lng,
      address: data.display_name,
      city: a.city || a.town || a.village || a.municipality,
      district: a.suburb || a.neighbourhood || a.quarter,
      street: a.road,
      postalCode: a.postcode,
      country: a.country,
    };
  } catch {
    return { lat, lng };
  }
}

export default function LocationPicker({
  value,
  onChange,
  isRTL,
  fallback = { lat: 24.7136, lng: 46.6753 },
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outOfArea, setOutOfArea] = useState(false);
  const [pretty, setPretty] = useState<string | null>(null);

  const initial = useMemo<LatLng>(() => value ?? fallback, []); // eslint-disable-line

  // Initialize Leaflet map
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      // Inject CSS once
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([initial.lat, initial.lng], 14);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);
      L.control.zoom({ position: isRTL ? "topleft" : "topright" }).addTo(map);

      const icon = L.divIcon({
        className: "lp-pin",
        html: `<div style="transform:translate(-50%,-100%);">
          <svg width="34" height="44" viewBox="0 0 34 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17 43s14-13.5 14-25A14 14 0 1 0 3 18c0 11.5 14 25 14 25z" fill="#a07c5b" stroke="#fff" stroke-width="2"/>
            <circle cx="17" cy="17" r="5" fill="#fff"/>
          </svg>
        </div>`,
        iconSize: [34, 44],
        iconAnchor: [17, 44],
      });

      const marker = L.marker([initial.lat, initial.lng], {
        draggable: true,
        icon,
      }).addTo(map);

      const handle = async (lat: number, lng: number) => {
        marker.setLatLng([lat, lng]);
        const ok = inSaudi({ lat, lng });
        setOutOfArea(!ok);
        setBusy(true);
        const loc = await reverseGeocode({ lat, lng }, isRTL ? "ar" : "en");
        setBusy(false);
        setPretty(loc.address ?? null);
        onChange(loc);
      };

      marker.on("dragend", () => {
        const { lat, lng } = marker.getLatLng();
        void handle(lat, lng);
      });
      map.on("click", (e: any) => {
        void handle(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = map;
      markerRef.current = marker;
      setReady(true);

      // Initial reverse geocode
      void handle(initial.lat, initial.lng);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (mapRef.current && markerRef.current) {
          mapRef.current.setView([lat, lng], 16);
          markerRef.current.setLatLng([lat, lng]);
        }
        const ok = inSaudi({ lat, lng });
        setOutOfArea(!ok);
        const loc = await reverseGeocode({ lat, lng }, isRTL ? "ar" : "en");
        setBusy(false);
        setPretty(loc.address ?? null);
        onChange(loc);
      },
      () => setBusy(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-2">
      <div className="relative rounded-[18px] overflow-hidden border border-border bg-cream-warm/40">
        <div ref={containerRef} className="h-[260px] w-full" />
        {!ready && (
          <div className="absolute inset-0 grid place-items-center bg-cream-warm/60">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <button
          type="button"
          onClick={useMyLocation}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000] inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-foreground text-background text-[12px] tracking-soft shadow-md active:scale-95 transition"
        >
          <Crosshair className="h-4 w-4" />
          {isRTL ? "استخدم موقعي الحالي" : "Use my current location"}
        </button>
      </div>

      <div className="flex items-start gap-2 px-1">
        <MapPin className="h-4 w-4 text-gold mt-0.5 shrink-0" />
        <p className="text-[12px] text-foreground/80 leading-snug flex-1">
          {busy
            ? isRTL ? "جاري تحديد العنوان…" : "Locating address…"
            : pretty
              ? pretty
              : isRTL
                ? "اضغط على الخريطة أو اسحب الدبوس لتحديد موقع التوصيل"
                : "Tap the map or drag the pin to set delivery location"}
        </p>
      </div>

      {outOfArea && (
        <div className="text-[11.5px] text-destructive bg-destructive/5 border border-destructive/20 rounded-[12px] px-3 py-2">
          {isRTL
            ? "هذا الموقع خارج نطاق التوصيل المدعوم حالياً (المملكة العربية السعودية)."
            : "This location is outside our supported delivery area (Saudi Arabia)."}
        </div>
      )}
    </div>
  );
}
