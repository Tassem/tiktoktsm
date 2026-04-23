import { useQuery } from "@tanstack/react-query";
import { X, Info, AlertTriangle, CheckCircle, AlertCircle, Megaphone } from "lucide-react";
import { useState, useEffect, useRef } from "react";

export interface Announcement {
  id: number;
  title: string | null;
  content: string | null;
  variant: string;
  placement: string;
  size: string;
  buttonText: string | null;
  buttonUrl: string | null;
  imageUrl: string | null;
  active: boolean;
  showTo: string;
  sortOrder: number;
}

function useAnnouncements() {
  return useQuery<Announcement[]>({
    queryKey: ["announcements-active"],
    queryFn: async () => {
      const r = await fetch("/api/public/announcements");
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

function useSiteSettings() {
  return useQuery<{ announcementSliderDuration?: number }>({
    queryKey: ["site-settings-public"],
    queryFn: async () => {
      const r = await fetch("/api/public/site-settings");
      if (!r.ok) return {};
      return r.json();
    },
    staleTime: 30_000,
  });
}

const variantStyles: Record<string, { bar: string; icon: JSX.Element; dismiss: string }> = {
  info: {
    bar: "bg-blue-500/10 border-blue-500/20 text-blue-200",
    icon: <Info className="w-4 h-4 shrink-0 text-blue-400" />,
    dismiss: "hover:bg-blue-500/20 text-blue-400",
  },
  warning: {
    bar: "bg-amber-500/10 border-amber-500/20 text-amber-200",
    icon: <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />,
    dismiss: "hover:bg-amber-500/20 text-amber-400",
  },
  success: {
    bar: "bg-emerald-500/10 border-emerald-500/20 text-emerald-200",
    icon: <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />,
    dismiss: "hover:bg-emerald-500/20 text-emerald-400",
  },
  error: {
    bar: "bg-red-500/10 border-red-500/20 text-red-200",
    icon: <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />,
    dismiss: "hover:bg-red-500/20 text-red-400",
  },
  orange: {
    bar: "bg-orange-500/10 border-orange-500/20 text-orange-200",
    icon: <Megaphone className="w-4 h-4 shrink-0 text-orange-400" />,
    dismiss: "hover:bg-orange-500/20 text-orange-400",
  },
};

const sizeClasses: Record<string, string> = {
  sm: "text-xs py-1.5 px-4",
  md: "text-sm py-2.5 px-5",
  lg: "text-base py-4 px-6",
};

function isImageOnly(ann: Announcement) {
  const safeContent = ann.content && ann.content !== "null" ? ann.content : null;
  return !!(ann.imageUrl && !ann.title && !safeContent);
}

function TextBanner({ ann, onDismiss }: { ann: Announcement; onDismiss: (id: number) => void }) {
  const style = variantStyles[ann.variant] ?? variantStyles.info;
  const sizeClass = sizeClasses[ann.size] ?? sizeClasses.md;
  const safeContent = ann.content && ann.content !== "null" ? ann.content : null;

  return (
    <div className={`relative flex items-start gap-3 border-b ${style.bar} ${sizeClass} animate-in slide-in-from-top-1 duration-300`}>
      {ann.imageUrl ? (
        <img
          src={ann.imageUrl}
          alt=""
          className={`shrink-0 rounded object-cover ${ann.size === "lg" ? "w-14 h-14" : ann.size === "sm" ? "w-8 h-8" : "w-10 h-10"}`}
        />
      ) : (
        <span className="mt-0.5">{style.icon}</span>
      )}
      <div className="flex-1 min-w-0">
        {ann.title && <p className="font-semibold leading-tight mb-0.5">{ann.title}</p>}
        {safeContent && <p className="leading-snug opacity-90">{safeContent}</p>}
        {ann.buttonText && ann.buttonUrl && (
          <a
            href={ann.buttonUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 px-3 py-1 rounded-md text-xs font-semibold bg-white/10 hover:bg-white/20 transition-colors border border-white/10"
          >
            {ann.buttonText}
          </a>
        )}
      </div>
      <button
        onClick={() => onDismiss(ann.id)}
        className={`shrink-0 p-1 rounded-md transition-colors ${style.dismiss}`}
        title="إغلاق"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function ImageSlider({ banners, durationSec }: { banners: Announcement[]; durationSec: number }) {
  const [current, setCurrent] = useState(0);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = banners.length;

  const startCycle = (idx: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (progressRef.current) clearInterval(progressRef.current);

    setProgress(0);
    let elapsed = 0;
    const tick = 50;

    progressRef.current = setInterval(() => {
      elapsed += tick;
      setProgress(Math.min((elapsed / (durationSec * 1000)) * 100, 100));
    }, tick);

    intervalRef.current = setTimeout(() => {
      const next = (idx + 1) % total;
      setCurrent(next);
      startCycle(next);
    }, durationSec * 1000) as unknown as ReturnType<typeof setInterval>;
  };

  useEffect(() => {
    if (total > 1) startCycle(0);
    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current as unknown as ReturnType<typeof setTimeout>);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [total, durationSec]);

  const goTo = (idx: number) => {
    setCurrent(idx);
    if (total > 1) startCycle(idx);
  };

  const ann = banners[current];
  const sizeClass = sizeClasses[ann.size] ?? sizeClasses.md;

  return (
    <div className="relative border-b border-white/10 overflow-hidden bg-black/20">
      {total > 1 && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/10 z-20">
          <div
            className="h-full bg-orange-400/70 transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div
        key={ann.id}
        className="animate-in fade-in duration-500"
      >
        <img
          src={ann.imageUrl!}
          alt={ann.title ?? "إعلان"}
          className="w-full h-auto block"
        />
        {ann.buttonText && ann.buttonUrl && (
          <div className={`flex justify-center ${sizeClass}`}>
            <a
              href={ann.buttonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-1.5 rounded-md text-sm font-semibold bg-white/10 hover:bg-white/20 transition-colors border border-white/10"
            >
              {ann.buttonText}
            </a>
          </div>
        )}
      </div>

      {total > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${i === current ? "bg-orange-400 w-3" : "bg-white/40 hover:bg-white/60"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function AnnouncementBanners() {
  const { data: announcements } = useAnnouncements();
  const { data: settings } = useSiteSettings();
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const durationSec = settings?.announcementSliderDuration ?? 5;

  const topBanners = (announcements ?? []).filter(
    (a) => a.placement === "top" && !dismissed.has(a.id)
  );

  const imageBanners = topBanners.filter(isImageOnly);
  const textBanners = topBanners.filter((a) => !isImageOnly(a));

  if (!topBanners.length) return null;

  return (
    <div className="sticky top-0 z-40">
      {imageBanners.length > 0 && (
        <ImageSlider banners={imageBanners} durationSec={durationSec} />
      )}
      {textBanners.map((ann) => (
        <TextBanner
          key={ann.id}
          ann={ann}
          onDismiss={(id) => setDismissed((prev) => new Set([...prev, id]))}
        />
      ))}
    </div>
  );
}
