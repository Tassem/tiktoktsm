import { useState, useRef, useCallback, useEffect } from "react";
import {
  Film, Download, Trash2, ImageDown, Loader2, Upload,
  Settings2, ChevronDown, ChevronUp, Save, FolderOpen,
  X, ChevronLeft, ChevronRight, Clock, RotateCcw, Cloud, CloudOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  useListFrameSessions,
  useCreateFrameSession,
  useDeleteFrameSession,
  getFrameSession,
  getListFrameSessionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import JSZip from "jszip";

type ExtractedFrame = {
  index: number;
  dataUrl: string;
  timestampMs: number;
};

type ExtractionMode = "count" | "interval";

export default function FrameExtractor() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoWidth, setVideoWidth] = useState(0);
  const [videoHeight, setVideoHeight] = useState(0);
  const [frames, setFrames] = useState<ExtractedFrame[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [frameCount, setFrameCount] = useState(24);
  const [intervalSec, setIntervalSec] = useState(1);
  const [mode, setMode] = useState<ExtractionMode>("count");
  const [quality, setQuality] = useState(0.92);

  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [showSessions, setShowSessions] = useState(false);
  const [saveLabel, setSaveLabel] = useState<string | null>(null);
  const [loadingSessionId, setLoadingSessionId] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();
  const { data: savedSessions = [], isLoading: sessionsLoading } = useListFrameSessions();
  const createSession = useCreateFrameSession();
  const deleteSession = useDeleteFrameSession();

  useEffect(() => {
    return () => { if (videoSrc) URL.revokeObjectURL(videoSrc); };
  }, [videoSrc]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (previewIndex === null) return;
      if (e.key === "Escape") setPreviewIndex(null);
      if (e.key === "ArrowRight") setPreviewIndex(i => i !== null ? Math.min(i + 1, frames.length - 1) : null);
      if (e.key === "ArrowLeft") setPreviewIndex(i => i !== null ? Math.max(i - 1, 0) : null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewIndex, frames.length]);

  function handleFileSelect(file: File) {
    if (!file.type.startsWith("video/")) return;
    if (videoSrc) URL.revokeObjectURL(videoSrc);
    setFrames([]);
    setProgress(0);
    setVideoFile(file);
    setVideoSrc(URL.createObjectURL(file));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }

  const computeTimestamps = useCallback((duration: number): number[] => {
    const timestamps: number[] = [];
    if (mode === "count") {
      const count = Math.max(1, frameCount);
      for (let i = 0; i < count; i++) timestamps.push((i / count) * duration * 1000);
    } else {
      const step = intervalSec * 1000;
      let t = 0;
      while (t < duration * 1000) { timestamps.push(t); t += step; }
    }
    return timestamps;
  }, [mode, frameCount, intervalSec]);

  async function extractFrames() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !videoFile) return;
    setIsExtracting(true);
    setFrames([]);
    setProgress(0);
    const duration = video.duration;
    const timestamps = computeTimestamps(duration);
    const ctx = canvas.getContext("2d")!;
    const extracted: ExtractedFrame[] = [];
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i];
      await seekTo(video, ts / 1000);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      extracted.push({ index: i + 1, dataUrl: canvas.toDataURL("image/jpeg", quality), timestampMs: ts });
      setProgress(Math.round(((i + 1) / timestamps.length) * 100));
    }
    setFrames(extracted);
    setIsExtracting(false);
  }

  function seekTo(video: HTMLVideoElement, timeSec: number): Promise<void> {
    return new Promise((resolve) => {
      const onSeeked = () => { video.removeEventListener("seeked", onSeeked); resolve(); };
      video.addEventListener("seeked", onSeeked);
      video.currentTime = timeSec;
    });
  }

  function downloadFrame(frame: ExtractedFrame) {
    const a = document.createElement("a");
    a.href = frame.dataUrl;
    a.download = `frame_${String(frame.index).padStart(4, "0")}_${Math.round(frame.timestampMs)}ms.jpg`;
    a.click();
  }

  async function downloadAllAsZip() {
    if (frames.length === 0) return;
    const zip = new JSZip();
    const folder = zip.folder("frames")!;
    const baseName = videoFile?.name.replace(/\.[^/.]+$/, "") ?? "video";
    for (const frame of frames) {
      const base64 = frame.dataUrl.split(",")[1];
      folder.file(`${baseName}_frame_${String(frame.index).padStart(4, "0")}.jpg`, base64, { base64: true });
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}_frames.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function saveSession() {
    if (!videoFile || frames.length === 0) return;
    createSession.mutate(
      {
        data: {
          videoName: videoFile.name,
          videoDurationMs: Math.round(videoDuration * 1000),
          videoWidth,
          videoHeight,
          frameCount: frames.length,
          frames,
          mode,
          quality,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListFrameSessionsQueryKey() });
          setSaveLabel("تم الحفظ في السيرفر!");
          setTimeout(() => setSaveLabel(null), 3000);
        },
        onError: () => {
          setSaveLabel("فشل الحفظ");
          setTimeout(() => setSaveLabel(null), 3000);
        },
      },
    );
  }

  async function loadSession(id: number) {
    setLoadingSessionId(id);
    try {
      const session = await getFrameSession(id);
      if (videoSrc) URL.revokeObjectURL(videoSrc);
      setVideoFile(null);
      setVideoSrc(null);
      setVideoDuration(session.videoDurationMs / 1000);
      setVideoWidth(session.videoWidth);
      setVideoHeight(session.videoHeight);
      setFrames(session.frames);
      setMode(session.mode as ExtractionMode);
      setQuality(session.quality);
      setShowSessions(false);
    } catch {
      // ignore
    } finally {
      setLoadingSessionId(null);
    }
  }

  function handleDeleteSession(id: number) {
    deleteSession.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListFrameSessionsQueryKey() });
        },
      },
    );
  }

  function reset() {
    setVideoFile(null);
    setVideoSrc(null);
    setFrames([]);
    setProgress(0);
    setVideoDuration(0);
    setVideoWidth(0);
    setVideoHeight(0);
  }

  function formatTime(ms: number) {
    const total = ms / 1000;
    const m = Math.floor(total / 60);
    const s = (total % 60).toFixed(2).padStart(5, "0");
    return `${m}:${s}`;
  }

  function formatDate(str: string) {
    return new Date(str).toLocaleString("ar-MA", { dateStyle: "short", timeStyle: "short" });
  }

  const estimatedFrames = videoDuration > 0
    ? mode === "count" ? frameCount : Math.floor(videoDuration / intervalSec)
    : null;

  const previewFrame = previewIndex !== null ? frames[previewIndex] : null;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <canvas ref={canvasRef} className="hidden" />

      {/* Lightbox */}
      <Dialog open={previewIndex !== null} onOpenChange={(open) => !open && setPreviewIndex(null)}>
        <DialogContent className="max-w-screen-lg w-full p-0 bg-black/95 border-border overflow-hidden">
          {previewFrame && (
            <div className="relative flex flex-col items-center justify-center min-h-[60vh]">
              <button
                onClick={() => setPreviewIndex(null)}
                className="absolute top-3 right-3 z-20 size-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <X className="size-4" />
              </button>

              <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
                <Badge className="bg-black/60 text-white border-white/20 font-mono text-xs">
                  {previewFrame.index} / {frames.length}
                </Badge>
                <Badge className="bg-black/60 text-white border-white/20 font-mono text-xs">
                  {formatTime(previewFrame.timestampMs)}
                </Badge>
              </div>

              <img
                src={previewFrame.dataUrl}
                alt={`Frame ${previewFrame.index}`}
                className="max-h-[80vh] max-w-full object-contain select-none"
              />

              <div className="absolute inset-y-0 left-0 flex items-center pl-2">
                <button
                  onClick={() => setPreviewIndex(i => i !== null ? Math.max(i - 1, 0) : null)}
                  disabled={previewIndex === 0}
                  className="size-10 rounded-full bg-white/10 hover:bg-white/25 disabled:opacity-30 flex items-center justify-center text-white transition-colors"
                >
                  <ChevronLeft className="size-5" />
                </button>
              </div>

              <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                <button
                  onClick={() => setPreviewIndex(i => i !== null ? Math.min(i + 1, frames.length - 1) : null)}
                  disabled={previewIndex === frames.length - 1}
                  className="size-10 rounded-full bg-white/10 hover:bg-white/25 disabled:opacity-30 flex items-center justify-center text-white transition-colors"
                >
                  <ChevronRight className="size-5" />
                </button>
              </div>

              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1.5 bg-white/10 hover:bg-white/20 text-white border-white/20"
                  onClick={() => downloadFrame(previewFrame)}
                >
                  <Download className="size-3.5" />
                  تحميل
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Film className="size-8 text-primary" />
            استخراج الفريمات
          </h1>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setShowSessions(!showSessions)}
          >
            <Cloud className="size-4" />
            الجلسات المحفوظة
            {savedSessions.length > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0">{savedSessions.length}</Badge>
            )}
          </Button>
        </div>
        <p className="text-muted-foreground">
          استخرج صور من الفيديو مباشرة في المتصفح — الجلسات تُحفظ في السيرفر ويمكن استرجاعها من أي جهاز.
        </p>
      </div>

      {/* Saved Sessions Panel */}
      {showSessions && (
        <div className="rounded-xl border border-border bg-card overflow-hidden animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <span className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              الجلسات المحفوظة في السيرفر ({savedSessions.length})
            </span>
            <button onClick={() => setShowSessions(false)} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
          {sessionsLoading ? (
            <div className="px-4 py-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> جاري التحميل...
            </div>
          ) : savedSessions.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground flex flex-col gap-2 items-center">
              <CloudOff className="size-8 text-muted-foreground/40" />
              <span>لا توجد جلسات محفوظة بعد — احفظ جلستك الحالية بعد استخراج الفريمات.</span>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {savedSessions.map(session => (
                <div key={session.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-medium text-foreground truncate">{session.videoName}</span>
                    <span className="text-xs text-muted-foreground">
                      {session.frameCount} فريم · {session.videoWidth}×{session.videoHeight} · {formatDate(session.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-7 text-xs"
                      onClick={() => loadSession(session.id)}
                      disabled={loadingSessionId === session.id}
                    >
                      {loadingSessionId === session.id
                        ? <Loader2 className="size-3 animate-spin" />
                        : <RotateCcw className="size-3" />
                      }
                      استرجاع
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteSession(session.id)}
                      disabled={deleteSession.isPending}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!videoFile && frames.length === 0 ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-200
            flex flex-col items-center gap-4
            ${isDragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border hover:border-primary/50 hover:bg-muted/30"
            }
          `}
        >
          <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Upload className="size-8 text-primary" />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">اسحب الفيديو هنا، أو انقر للاختيار</p>
            <p className="text-sm text-muted-foreground mt-1">MP4, MOV, AVI, WebM — الفيديو يبقى في المتصفح فقط</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleInputChange}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {videoFile && videoSrc ? (
              <div className="flex-1 rounded-xl overflow-hidden border border-border bg-card">
                <video
                  ref={videoRef}
                  src={videoSrc}
                  className="w-full max-h-[320px] object-contain bg-black"
                  onLoadedMetadata={(e) => {
                    setVideoDuration(e.currentTarget.duration);
                    setVideoWidth(e.currentTarget.videoWidth);
                    setVideoHeight(e.currentTarget.videoHeight);
                  }}
                  controls
                  preload="auto"
                />
              </div>
            ) : (
              <div className="flex-1 rounded-xl border border-border bg-card flex items-center justify-center p-6">
                <div className="text-center flex flex-col gap-2">
                  <Film className="size-10 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">جلسة مستعادة من السيرفر</p>
                  <p className="text-xs text-muted-foreground">{videoWidth}×{videoHeight} · {formatTime(videoDuration * 1000)}</p>
                </div>
              </div>
            )}

            <div className="lg:w-72 flex flex-col gap-3">
              <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground truncate">{videoFile?.name ?? "جلسة مستعادة"}</span>
                  <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive shrink-0" onClick={reset}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                {videoDuration > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="secondary">{formatTime(videoDuration * 1000)} مدة</Badge>
                    {videoFile && <Badge variant="secondary">{(videoFile.size / 1024 / 1024).toFixed(1)} MB</Badge>}
                    {estimatedFrames !== null && videoFile && (
                      <Badge variant="outline" className="text-primary border-primary/30">~{estimatedFrames} فريم</Badge>
                    )}
                    {frames.length > 0 && (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-500/30">{frames.length} مستخرج</Badge>
                    )}
                  </div>
                )}
              </div>

              {videoFile && (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="w-full flex items-center justify-between p-4 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors"
                  >
                    <span className="flex items-center gap-2"><Settings2 className="size-4 text-primary" /> إعدادات الاستخراج</span>
                    {showSettings ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </button>

                  {showSettings && (
                    <div className="px-4 pb-4 flex flex-col gap-4 border-t border-border pt-3">
                      <div className="flex gap-2">
                        {(["count", "interval"] as ExtractionMode[]).map((m) => (
                          <button
                            key={m}
                            onClick={() => setMode(m)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              mode === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {m === "count" ? "عدد محدد" : "كل X ثانية"}
                          </button>
                        ))}
                      </div>

                      {mode === "count" ? (
                        <div className="flex flex-col gap-2">
                          <Label className="text-xs text-muted-foreground flex justify-between">
                            عدد الفريمات <span className="text-foreground font-semibold">{frameCount}</span>
                          </Label>
                          <Slider min={1} max={120} step={1} value={[frameCount]} onValueChange={([v]) => setFrameCount(v)} />
                          <div className="flex justify-between text-xs text-muted-foreground"><span>1</span><span>120</span></div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <Label className="text-xs text-muted-foreground flex justify-between">
                            فريم كل <span className="text-foreground font-semibold">{intervalSec} ثانية</span>
                          </Label>
                          <Slider min={0.25} max={10} step={0.25} value={[intervalSec]} onValueChange={([v]) => setIntervalSec(v)} />
                          <div className="flex justify-between text-xs text-muted-foreground"><span>0.25s</span><span>10s</span></div>
                        </div>
                      )}

                      <div className="flex flex-col gap-2">
                        <Label className="text-xs text-muted-foreground flex justify-between">
                          جودة JPEG <span className="text-foreground font-semibold">{Math.round(quality * 100)}%</span>
                        </Label>
                        <Slider min={0.5} max={1} step={0.01} value={[quality]} onValueChange={([v]) => setQuality(v)} />
                        <div className="flex justify-between text-xs text-muted-foreground"><span>50%</span><span>100%</span></div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {videoFile && (
                <Button
                  onClick={extractFrames}
                  disabled={isExtracting || !videoDuration}
                  className="w-full gap-2"
                  size="lg"
                >
                  {isExtracting ? (
                    <><Loader2 className="size-4 animate-spin" /> جاري الاستخراج... {progress}%</>
                  ) : (
                    <><ImageDown className="size-4" /> استخرج الفريمات</>
                  )}
                </Button>
              )}

              {frames.length > 0 && (
                <>
                  <Button onClick={downloadAllAsZip} variant="outline" className="w-full gap-2" size="lg">
                    <Download className="size-4" />
                    تحميل الكل ZIP ({frames.length} صورة)
                  </Button>
                  <Button
                    onClick={saveSession}
                    disabled={createSession.isPending}
                    variant="secondary"
                    className="w-full gap-2"
                    size="lg"
                  >
                    {createSession.isPending ? (
                      <><Loader2 className="size-4 animate-spin" /> جاري الحفظ في السيرفر...</>
                    ) : saveLabel ? (
                      <><Cloud className="size-4 text-emerald-500" /> {saveLabel}</>
                    ) : (
                      <><Save className="size-4" /> حفظ في السيرفر</>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>

          {isExtracting && (
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {frames.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{frames.length} فريم مستخرج</span>
                <span className="text-xs text-muted-foreground">
                  {videoWidth > 0 ? `${videoWidth}×${videoHeight}` : ""}
                  <span className="text-muted-foreground/50 ml-2">انقر للمعاينة</span>
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-2">
                {frames.map((frame, i) => (
                  <div
                    key={frame.index}
                    className="group relative rounded-lg overflow-hidden border border-border bg-card aspect-square cursor-pointer hover:border-primary/60 hover:scale-[1.03] transition-all duration-150"
                    onClick={() => setPreviewIndex(i)}
                    title={`فريم ${frame.index} — ${formatTime(frame.timestampMs)}`}
                  >
                    <img
                      src={frame.dataUrl}
                      alt={`Frame ${frame.index}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-[10px] font-semibold tracking-wide">معاينة</span>
                    </div>
                    <button
                      className="absolute top-1 right-1 size-5 rounded bg-black/60 hover:bg-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      onClick={(e) => { e.stopPropagation(); downloadFrame(frame); }}
                      title="تحميل"
                    >
                      <Download className="size-3 text-white" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                      <span className="text-[9px] text-white/90 font-mono leading-none block text-center">
                        {formatTime(frame.timestampMs)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
