import { useGetPromptPack, getGetPromptPackQueryKey, useRemixPromptPack, getListPromptPacksQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Copy, CheckCircle2, Image as ImageIcon, Video, Mic, Music,
  LayoutList, Calendar, Wand2, Shuffle, BookOpen, ChevronDown, ChevronUp,
  FileText, Sparkles, Film, Play, Loader2,
  type LucideIcon
} from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useState, useCallback } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type GetPromptPackScene = {
  id: number;
  sceneNumber: number;
  sceneType: string;
  title: string;
  imagePrompt: string;
  animationPrompt: string;
  voiceOverDarija: string;
  soundEffectsPrompt: string;
  sceneFrameUrl?: string | null;
};

type GetPromptPackResponse = {
  id: number;
  title: string;
  concept: string;
  nicheName: string;
  sceneCount: number;
  createdAt: string;
  summaryPrompt?: string | null;
  scenes: GetPromptPackScene[];
};

const IMAGE_MODELS = [
  { value: "flux-demo", label: "🍌 FLUX Nano (تجريبي — مجاني)" },
  { value: "flux-schnell", label: "FLUX Schnell (سريع — BFL)" },
  { value: "flux-dev", label: "FLUX Dev (جودة عالية)" },
  { value: "flux-pro", label: "FLUX Pro / BFL" },
  { value: "dalle3", label: "DALL-E 3" },
  { value: "custom", label: "Custom" },
];

const VIDEO_MODELS = [
  { value: "veo-3-demo", label: "🎬 Veo 3 (تجريبي — مجاني)" },
  { value: "veo-3", label: "Veo 3 — Google DeepMind" },
  { value: "kling-1.6", label: "Kling 1.6 (fal.ai)" },
  { value: "runway-gen4", label: "Runway Gen-4" },
  { value: "pika-2", label: "Pika 2.0" },
  { value: "custom", label: "Custom" },
];

function useGenerationSettings() {
  const [settings, setSettings] = useState<{
    imageModel: string;
    videoModel: string;
  }>(() => {
    try {
      return JSON.parse(localStorage.getItem("reel-gen-settings") || "null") || {
        imageModel: "flux-demo",
        videoModel: "veo-3-demo",
      };
    } catch {
      return { imageModel: "flux-demo", videoModel: "veo-3-demo" };
    }
  });

  const update = useCallback((updates: Partial<typeof settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      localStorage.setItem("reel-gen-settings", JSON.stringify(next));
      return next;
    });
  }, []);

  return [settings, update] as const;
}

export default function PackDetail() {
  const params = useParams();
  const packId = parseInt(params.id || "0");
  const { data: pack, isLoading } = useGetPromptPack(packId, {
    query: { enabled: !!packId, queryKey: getGetPromptPackQueryKey(packId) },
  });
  const remixMutation = useRemixPromptPack();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [remixOpen, setRemixOpen] = useState(false);
  const [storyIdea, setStoryIdea] = useState("");
  const [remixConcept, setRemixConcept] = useState("");
  const [sceneSummaries, setSceneSummaries] = useState<Record<number, string>>({});

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  function handleRemix() {
    if (!storyIdea.trim() || storyIdea.trim().length < 10) return;
    remixMutation.mutate(
      { promptPackId: packId, data: { storyIdea: storyIdea.trim(), concept: remixConcept.trim() || undefined } },
      {
        onSuccess: (newPack) => {
          queryClient.invalidateQueries({ queryKey: getListPromptPacksQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          toast({ title: "Remix created!", description: (newPack as { title?: string }).title ?? "" });
          setRemixOpen(false);
          setStoryIdea("");
          setRemixConcept("");
          navigate(`/packs/${(newPack as { id: number }).id}`);
        },
        onError: (err) => {
          toast({ title: "Remix failed", description: err.message, variant: "destructive" });
        },
      }
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in">
        <div>
          <Skeleton className="h-6 w-24 mb-6" />
          <Skeleton className="h-10 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="space-y-6 mt-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-72 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!pack) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <h2 className="text-2xl font-bold mb-2">Prompt Pack Not Found</h2>
        <p className="text-muted-foreground mb-6">This prompt pack may have been deleted or does not exist.</p>
        <Button asChild>
          <Link href="/packs">
            <ArrowLeft className="mr-2 size-4" /> Back to Packs
          </Link>
        </Button>
      </div>
    );
  }

  const typedPack = pack as unknown as GetPromptPackResponse;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-6xl mx-auto w-full pb-16">
      <div>
        <Button variant="ghost" size="sm" className="mb-4 text-muted-foreground hover:text-foreground" asChild>
          <Link href="/packs">
            <ArrowLeft className="mr-2 size-4" /> Back to Packs
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge className="bg-primary/10 text-primary hover:bg-primary/20">{typedPack.nicheName}</Badge>
          <Badge variant="outline" className="text-muted-foreground border-border/50">
            <LayoutList className="size-3 mr-1 inline" /> {typedPack.sceneCount} Scenes
          </Badge>
          <Badge variant="outline" className="text-muted-foreground border-border/50">
            <Calendar className="size-3 mr-1 inline" /> {format(new Date(typedPack.createdAt), "MMM d, yyyy")}
          </Badge>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground leading-tight">{typedPack.title}</h1>
          <Button
            onClick={() => setRemixOpen(true)}
            className="shrink-0 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-md"
          >
            <Shuffle className="mr-2 size-4" />
            Remix This Pack
          </Button>
        </div>
        <p className="text-muted-foreground mt-2 text-lg">{typedPack.concept}</p>
      </div>

      <Dialog
        open={remixOpen}
        onOpenChange={(o) => {
          if (!remixMutation.isPending) setRemixOpen(o);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shuffle className="size-5 text-primary" />
              Remix This Pack
            </DialogTitle>
            <DialogDescription>
              Keep the same visual style and art direction from <strong>{typedPack.title}</strong>, but write a brand new story.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="storyIdea">
                New story / scenario idea <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="storyIdea"
                placeholder="مثلاً: فريزيتا تخون زوجها مع بنانة، تحمل معه، وزوجها يكتشف الحقيقة..."
                value={storyIdea}
                onChange={(e) => setStoryIdea(e.target.value)}
                disabled={remixMutation.isPending}
                rows={4}
                className="resize-none font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">اكتب الفكرة بأي لغة — الذكاء الاصطناعي سيفهمها</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="remixConcept">Pack title (optional)</Label>
              <Input
                id="remixConcept"
                placeholder="e.g. Frizita's Betrayal — a Strawberry Drama"
                value={remixConcept}
                onChange={(e) => setRemixConcept(e.target.value)}
                disabled={remixMutation.isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemixOpen(false)} disabled={remixMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleRemix}
              disabled={remixMutation.isPending || storyIdea.trim().length < 10}
              className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white"
            >
              {remixMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Generating remix...
                </>
              ) : (
                <>
                  <Shuffle className="mr-2 size-4" />
                  Generate Remix
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ArabicStorySummary packId={packId} onSceneSummaries={setSceneSummaries} />

      <div className="space-y-5">
        {typedPack.scenes.map((scene) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            pack={typedPack}
            copiedId={copiedId}
            copyToClipboard={copyToClipboard}
            sceneSummary={sceneSummaries[scene.sceneNumber] ?? null}
          />
        ))}
      </div>
    </div>
  );
}

function SceneCard({
  scene,
  pack,
  copiedId,
  copyToClipboard,
  sceneSummary,
}: {
  scene: GetPromptPackScene;
  pack: GetPromptPackResponse;
  copiedId: string | null;
  copyToClipboard: (text: string, id: string) => void;
  sceneSummary: string | null;
}) {
  const { toast } = useToast();
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [genSettings, updateGenSettings] = useGenerationSettings();

  const [imageCount, setImageCount] = useState<1 | 2 | 4>(1);
  const [imageModel, setImageModel] = useState(genSettings.imageModel);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [selectedImageIdx, setSelectedImageIdx] = useState<number | null>(null);

  const [videoModel, setVideoModel] = useState(genSettings.videoModel);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoCopied, setVideoCopied] = useState(false);

  const imagePromptFull = buildCopyReadyImagePrompt(pack.summaryPrompt, scene.imagePrompt);
  const videoPromptFull = buildSceneVideoPrompt({
    summaryPrompt: pack.summaryPrompt,
    imagePrompt: scene.imagePrompt,
    animationPrompt: scene.animationPrompt,
    dialogueDarija: scene.voiceOverDarija,
    soundEffectsPrompt: scene.soundEffectsPrompt,
  });

  function copyVideoPrompt() {
    navigator.clipboard.writeText(videoPromptFull);
    setVideoCopied(true);
    setTimeout(() => setVideoCopied(false), 2000);
  }

  async function handleGenerateImages() {
    setIsGeneratingImages(true);
    try {
      // Demo mode: pollinations.ai — free, no API key needed
      if (imageModel === "flux-demo") {
        await new Promise((r) => setTimeout(r, 1200));
        const baseSeed = Math.floor(Math.random() * 900000) + 10000;
        const safePrompt = encodeURIComponent(imagePromptFull.slice(0, 300));
        const imgs = Array.from({ length: imageCount }, (_, i) =>
          `https://image.pollinations.ai/prompt/${safePrompt}?model=flux&width=576&height=1024&nologo=true&seed=${baseSeed + i * 37}`
        );
        setGeneratedImages(imgs);
        setSelectedImageIdx(0);
        return;
      }

      const stored = (() => { try { return JSON.parse(localStorage.getItem("reel-gen-settings") || "{}"); } catch { return {}; } })();
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: imagePromptFull,
          model: imageModel,
          count: imageCount,
          apiKey: stored.imageApiKey ?? "",
          provider: stored.imageProvider ?? "fal",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "فشل توليد الصور");
      }
      const data = await res.json() as { images: string[] };
      setGeneratedImages(data.images ?? []);
      if ((data.images ?? []).length > 0) setSelectedImageIdx(0);
    } catch (err) {
      toast({
        title: "توليد الصور غير متاح",
        description: err instanceof Error ? err.message : "اضف مفتاح API في الإعدادات",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingImages(false);
    }
  }

  async function handleGenerateVideo() {
    const selectedImageUrl = selectedImageIdx !== null ? generatedImages[selectedImageIdx] : scene.sceneFrameUrl;
    setIsGeneratingVideo(true);
    try {
      // Demo mode: show full prompt + placeholder
      if (videoModel === "veo-3-demo") {
        await new Promise((r) => setTimeout(r, 1800));
        toast({
          title: "Veo 3 تجريبي — الـ Prompt جاهز",
          description: "لتفعيل التوليد الحقيقي، أضف مفتاح Google AI أو fal.ai في الإعدادات",
        });
        setIsGeneratingVideo(false);
        return;
      }

      const stored = (() => { try { return JSON.parse(localStorage.getItem("reel-gen-settings") || "{}"); } catch { return {}; } })();
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: videoPromptFull,
          model: videoModel,
          imageUrl: selectedImageUrl,
          apiKey: stored.videoApiKey ?? "",
          provider: stored.videoProvider ?? "fal",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "فشل توليد الفيديو");
      }
      const data = await res.json() as { videoUrl: string };
      setGeneratedVideoUrl(data.videoUrl);
    } catch (err) {
      toast({
        title: "توليد الفيديو غير متاح",
        description: err instanceof Error ? err.message : "اضف مفتاح API في الإعدادات",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingVideo(false);
    }
  }

  return (
    <div className="relative">
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-border rounded-full" />
      <div className="absolute left-[-11px] top-5 w-6 h-6 rounded-full bg-background border-4 border-primary z-10 flex items-center justify-center">
        <span className="text-[10px] font-bold text-primary">{scene.sceneNumber}</span>
      </div>

      <div className="ml-8 border border-border/60 rounded-xl overflow-hidden bg-card shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr_1fr] divide-y lg:divide-y-0 lg:divide-x divide-border/40">

          {/* ── Section 1: Info + Prompts ── */}
          <div className="flex flex-col min-w-0">
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Badge
                  variant={scene.sceneType === "hook" ? "default" : "secondary"}
                  className="text-[10px] uppercase tracking-wider font-bold shrink-0"
                >
                  {scene.sceneType}
                </Badge>
                <span className="text-xs text-muted-foreground font-medium">Scene {scene.sceneNumber}</span>
              </div>
              <h3 className="font-bold text-base leading-snug mb-2">{scene.title}</h3>
              {sceneSummary && (
                <div className="flex items-start gap-1.5 mb-2" dir="rtl">
                  <FileText className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800/80 dark:text-amber-300/80 leading-relaxed">{sceneSummary}</p>
                </div>
              )}
            </div>

            {/* ── Quick Copy Buttons (always visible) ── */}
            <div className="flex items-center gap-1.5 px-3 py-2 border-t border-border/30 bg-muted/10">
              <button
                onClick={() => copyToClipboard(imagePromptFull, `img-quick-${scene.id}`)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all border shrink-0 ${
                  copiedId === `img-quick-${scene.id}`
                    ? "bg-emerald-500/10 border-emerald-400/40 text-emerald-700 dark:text-emerald-400"
                    : "bg-background border-border/50 text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/40"
                }`}
              >
                {copiedId === `img-quick-${scene.id}` ? (
                  <CheckCircle2 className="size-3 text-emerald-500" />
                ) : (
                  <ImageIcon className="size-3" />
                )}
                نسخ Image
              </button>
              <button
                onClick={() => copyToClipboard(videoPromptFull, `motion-quick-${scene.id}`)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all border flex-1 min-w-0 ${
                  copiedId === `motion-quick-${scene.id}`
                    ? "bg-emerald-500/10 border-emerald-400/40 text-emerald-700 dark:text-emerald-400"
                    : "bg-background border-border/50 text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/40"
                }`}
              >
                {copiedId === `motion-quick-${scene.id}` ? (
                  <CheckCircle2 className="size-3 text-emerald-500" />
                ) : (
                  <Wand2 className="size-3" />
                )}
                <span className="truncate">نسخ Motion</span>
              </button>
            </div>

            {/* Prompts accordion */}
            <button
              onClick={() => setPromptsOpen((v) => !v)}
              className="flex items-center justify-between px-4 py-2 bg-muted/30 border-t border-border/30 hover:bg-muted/50 transition-colors text-left w-full"
            >
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">البرومتات</span>
              {promptsOpen ? (
                <ChevronUp className="size-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="size-3.5 text-muted-foreground" />
              )}
            </button>

            {promptsOpen && (
              <div className="divide-y divide-border/20 border-t border-border/20">
                <PromptRow
                  title="Image Prompt"
                  icon={ImageIcon}
                  content={imagePromptFull}
                  id={`img-${scene.id}`}
                  copiedId={copiedId}
                  onCopy={copyToClipboard}
                />
                <PromptRow
                  title="Animation"
                  icon={Video}
                  content={scene.animationPrompt}
                  id={`anim-${scene.id}`}
                  copiedId={copiedId}
                  onCopy={copyToClipboard}
                />
                <PromptRow
                  title="Dialogue (Darija)"
                  icon={Mic}
                  content={scene.voiceOverDarija}
                  id={`vo-${scene.id}`}
                  copiedId={copiedId}
                  onCopy={copyToClipboard}
                />
                <PromptRow
                  title="Sound Effects"
                  icon={Music}
                  content={scene.soundEffectsPrompt}
                  id={`sfx-${scene.id}`}
                  copiedId={copiedId}
                  onCopy={copyToClipboard}
                />
                <div className="p-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-8"
                    onClick={() =>
                      copyToClipboard(videoPromptFull, `motion-${scene.id}`)
                    }
                  >
                    {copiedId === `motion-${scene.id}` ? (
                      <CheckCircle2 className="mr-1.5 size-3.5 text-emerald-500" />
                    ) : (
                      <Wand2 className="mr-1.5 size-3.5" />
                    )}
                    Copy Full Motion Prompt
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* ── Section 2: Original Frame ── */}
          <div className="relative overflow-hidden bg-black min-w-[160px] w-[160px] min-h-[200px]">
            {scene.sceneFrameUrl ? (
              <img
                src={scene.sceneFrameUrl}
                alt={`Frame — Scene ${scene.sceneNumber}`}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-muted/20">
                <ImageIcon className="size-5 text-muted-foreground/30" />
              </div>
            )}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent pt-4 pb-1 text-center">
              <p className="text-[9px] text-white/70 font-medium">الفريم</p>
            </div>
          </div>

          {/* ── Section 3: Image Generation ── */}
          <div className="flex flex-col p-3 gap-3">
            <div className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-violet-500 shrink-0" />
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">توليد صور</p>
            </div>

            <div className="space-y-2">
              <Select
                value={imageModel}
                onValueChange={(v) => {
                  setImageModel(v);
                  updateGenSettings({ imageModel: v });
                }}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMAGE_MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value} className="text-xs">
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-1">
                {([1, 2, 4] as const).map((n) => (
                  <button
                    key={n}
                    onClick={() => setImageCount(n)}
                    className={`flex-1 h-7 rounded text-xs font-semibold border transition-colors ${
                      imageCount === n
                        ? "bg-violet-600 text-white border-violet-600"
                        : "border-border/50 text-muted-foreground hover:border-violet-400"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <Button
                size="sm"
                className="w-full h-8 text-xs bg-violet-600 hover:bg-violet-700 text-white"
                onClick={handleGenerateImages}
                disabled={isGeneratingImages}
              >
                {isGeneratingImages ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 size-3.5" />
                )}
                {isGeneratingImages ? "جاري التوليد..." : "توليد"}
              </Button>
            </div>

            {/* Generated images grid */}
            {generatedImages.length > 0 ? (
              <div className={`grid gap-1.5 ${imageCount === 1 ? "grid-cols-1" : imageCount === 2 ? "grid-cols-2" : "grid-cols-2"}`}>
                {generatedImages.map((src, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIdx(idx === selectedImageIdx ? null : idx)}
                    className={`relative rounded overflow-hidden border-2 transition-all ${
                      selectedImageIdx === idx
                        ? "border-violet-500 shadow-md shadow-violet-500/20"
                        : "border-transparent hover:border-border"
                    }`}
                  >
                    <img src={src} alt={`Generated ${idx + 1}`} className="w-full aspect-[9/16] object-cover" />
                    {selectedImageIdx === idx && (
                      <div className="absolute inset-0 bg-violet-500/10 flex items-end justify-center pb-1">
                        <span className="text-[10px] bg-violet-600 text-white px-1.5 py-0.5 rounded-full font-bold">✓</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex-1 rounded-lg border border-dashed border-border/40 bg-muted/10 flex flex-col items-center justify-center py-5 gap-2 min-h-[100px]">
                <ImageIcon className="size-5 text-muted-foreground/30" />
                <p className="text-[10px] text-muted-foreground/50 text-center px-2">اضغط توليد لإنشاء الصور</p>
              </div>
            )}
          </div>

          {/* ── Section 4: Video Generation ── */}
          <div className="flex flex-col p-3 gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Film className="size-3.5 text-rose-500 shrink-0" />
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">توليد فيديو</p>
              </div>
              <button
                onClick={copyVideoPrompt}
                title="نسخ Motion Prompt الكامل"
                className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors bg-muted/40 hover:bg-muted/70 border border-border/40 rounded px-1.5 py-0.5"
              >
                {videoCopied ? (
                  <CheckCircle2 className="size-2.5 text-emerald-500" />
                ) : (
                  <Wand2 className="size-2.5" />
                )}
                {videoCopied ? "تم النسخ" : "نسخ Motion"}
              </button>
            </div>

            <div className="space-y-2">
              <Select
                value={videoModel}
                onValueChange={(v) => {
                  setVideoModel(v);
                  updateGenSettings({ videoModel: v });
                }}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIDEO_MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value} className="text-xs">
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Image selector for video — always visible (original frame + generated) */}
              <div className="space-y-1">
                <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">صورة مرجع</p>
                <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                  {/* Original frame button */}
                  {scene.sceneFrameUrl && (
                    <button
                      onClick={() => setSelectedImageIdx(null)}
                      className={`shrink-0 rounded overflow-hidden border-2 transition-all relative ${
                        selectedImageIdx === null
                          ? "border-rose-500 shadow-sm shadow-rose-500/20"
                          : "border-border/40 hover:border-border"
                      }`}
                      title="فريم أصلي من الفيديو"
                    >
                      <img src={scene.sceneFrameUrl} className="w-9 h-16 object-cover" alt="original" />
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 text-center">
                        <span className="text-[8px] text-white">أصل</span>
                      </div>
                    </button>
                  )}
                  {/* Generated images */}
                  {generatedImages.map((src, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImageIdx(idx)}
                      className={`shrink-0 rounded overflow-hidden border-2 transition-all relative ${
                        selectedImageIdx === idx
                          ? "border-rose-500 shadow-sm shadow-rose-500/20"
                          : "border-border/40 hover:border-border"
                      }`}
                    >
                      <img src={src} className="w-9 h-16 object-cover" alt={`صورة ${idx + 1}`} />
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 text-center">
                        <span className="text-[8px] text-white">{idx + 1}</span>
                      </div>
                    </button>
                  ))}
                  {!scene.sceneFrameUrl && generatedImages.length === 0 && (
                    <p className="text-[9px] text-muted-foreground/60 italic">ولّد صوراً أولاً</p>
                  )}
                </div>
              </div>

              <Button
                size="sm"
                className={`w-full h-8 text-xs text-white ${
                  videoModel === "veo-3-demo"
                    ? "bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
                onClick={handleGenerateVideo}
                disabled={isGeneratingVideo}
              >
                {isGeneratingVideo ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <Play className="mr-1.5 size-3.5" />
                )}
                {isGeneratingVideo
                  ? "جاري التوليد..."
                  : videoModel === "veo-3-demo"
                  ? "🎬 تجربة Veo 3"
                  : "توليد الفيديو"}
              </Button>
            </div>

            {/* Generated video */}
            {generatedVideoUrl ? (
              <div className="rounded-lg overflow-hidden border border-border/60 bg-black">
                <video src={generatedVideoUrl} controls className="w-full aspect-[9/16] object-cover" />
              </div>
            ) : (
              <div className="flex-1 rounded-lg border border-dashed border-border/40 bg-muted/10 flex flex-col items-center justify-center py-4 gap-1.5 min-h-[80px]">
                <Film className="size-4 text-muted-foreground/25" />
                <p className="text-[9px] text-muted-foreground/40 text-center px-2">
                  {videoModel === "veo-3-demo" ? "اضغط لتجربة Veo 3 وعرض الـ Prompt" : "اختر صورة وولّد الفيديو"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PromptRow({
  title,
  icon: Icon,
  content,
  id,
  copiedId,
  onCopy,
}: {
  title: string;
  icon: LucideIcon;
  content: string;
  id: string;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
}) {
  if (!content) return null;
  const isCopied = copiedId === id;
  const preview = content.length > 120 ? content.slice(0, 120) + "…" : content;

  return (
    <div className="group px-3 py-2.5 flex items-start gap-2 hover:bg-muted/10 transition-colors relative">
      <div className="p-1 rounded bg-background border border-border/40 shadow-sm text-muted-foreground shrink-0 mt-0.5">
        <Icon className="size-3" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">{title}</p>
        <p className="text-xs text-muted-foreground/80 leading-relaxed font-mono whitespace-pre-wrap break-words">{preview}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        onClick={() => onCopy(content, id)}
      >
        {isCopied ? <CheckCircle2 className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
      </Button>
    </div>
  );
}

function buildCopyReadyImagePrompt(summaryPrompt: string | null | undefined, imagePrompt: string) {
  const styleContext = summaryPrompt?.trim();
  if (!styleContext) return imagePrompt;
  return `Use this global visual direction from the analyzed video:\n${styleContext}\n\nGenerate this exact scene as a vertical 9:16 image:\n${imagePrompt}`;
}

function buildSceneVideoPrompt({
  summaryPrompt,
  imagePrompt,
  animationPrompt,
  dialogueDarija,
  soundEffectsPrompt,
}: {
  summaryPrompt: string | null | undefined;
  imagePrompt: string;
  animationPrompt: string;
  dialogueDarija: string;
  soundEffectsPrompt: string;
}) {
  const hasSpeakers = /\w+.*:/.test(dialogueDarija);
  const speakerNames = hasSpeakers
    ? [...new Set(dialogueDarija.split("\n").map((l) => l.split(":")[0]?.trim()).filter(Boolean))]
    : [];

  return `════════════════════════════════════════════
SCENE VIDEO PROMPT — Copy-ready for Kling / Sora / Runway / Pika
════════════════════════════════════════════

▸ FORMAT: Vertical 9:16 video scene

══════════════════════
GLOBAL VISUAL STYLE
══════════════════════
${summaryPrompt?.trim() || "Preserve the visual texture, lighting, color palette, framing, and mood described in the Scene Frame below."}

══════════════════════
SCENE FRAME (Image Reference)
══════════════════════
${imagePrompt}

══════════════════════
CHARACTER IDENTITY LOCK ⚠️ CRITICAL
══════════════════════
${
    speakerNames.length > 0
      ? speakerNames
          .map(
            (name) =>
              `• ${name}: This character's gender, age, clothing, hair, skin tone, size, and position in frame are FIXED as described in the Scene Frame above.`
          )
          .join("\n")
      : "• All characters: gender, clothing, position, and appearance are fixed exactly as described in the Scene Frame above."
  }

══════════════════════
DIALOGUE SPEAKER LOCK ⚠️ FATAL IF VIOLATED
══════════════════════
${
    hasSpeakers
      ? `Each line below is spoken ONLY by the character whose name appears before the colon.\n\nDIALOGUE LINES:\n${dialogueDarija}`
      : dialogueDarija
  }

══════════════════════
ANIMATION INSTRUCTIONS
══════════════════════
${animationPrompt}

══════════════════════
SOUND DESIGN
══════════════════════
${soundEffectsPrompt}

════════════════════════════════════════════
END OF SCENE PROMPT
════════════════════════════════════════════`;
}

function ArabicStorySummary({
  packId,
  onSceneSummaries,
}: {
  packId: number;
  onSceneSummaries: (s: Record<number, string>) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const [refetchKey, setRefetchKey] = useState(0);

  const { data, isLoading, isError, error } = useQuery<
    {
      summary: string;
      sceneSummaries: Array<{ sceneNumber: number; summary: string }>;
      cached?: boolean;
    },
    Error
  >({
    queryKey: ["story-summary", packId, refetchKey],
    queryFn: async () => {
      const url =
        refetchKey > 0
          ? `/api/prompt-packs/${packId}/story-summary?force=true`
          : `/api/prompt-packs/${packId}/story-summary`;
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "فشل توليد الملخص" }));
        throw new Error((body as { error?: string }).error ?? "فشل توليد الملخص");
      }
      const json = (await res.json()) as {
        summary: string;
        sceneSummaries?: Array<{ sceneNumber: number; summary: string }>;
        cached?: boolean;
      };
      if (Array.isArray(json.sceneSummaries)) {
        const map: Record<number, string> = {};
        for (const s of json.sceneSummaries) map[s.sceneNumber] = s.summary;
        onSceneSummaries(map);
      }
      return json as {
        summary: string;
        sceneSummaries: Array<{ sceneNumber: number; summary: string }>;
        cached?: boolean;
      };
    },
    enabled: true,
    staleTime: Infinity,
    retry: false,
  });

  function handleCopy() {
    if (!data?.summary) return;
    navigator.clipboard.writeText(data.summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleRegenerate() {
    onSceneSummaries({});
    setRefetchKey((k) => k + 1);
  }

  const hasSummary = !!data?.summary;

  return (
    <div
      className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/80 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/10 dark:border-amber-800/40 shadow-sm overflow-hidden"
      dir="rtl"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-amber-200/70 dark:border-amber-800/40">
        <button onClick={() => setExpanded((v) => !v)} className="flex items-center gap-2.5 group">
          <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700">
            <BookOpen className="size-4 text-amber-700 dark:text-amber-400" />
          </div>
          <span className="font-bold text-base text-amber-900 dark:text-amber-200 group-hover:text-amber-700 transition-colors">
            خلاصة القصة بالعربية
          </span>
          <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 dark:text-amber-400 dark:border-amber-700">
            AI
          </Badge>
          {data?.cached && !isLoading && (
            <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700 bg-emerald-50">
              محفوظ
            </Badge>
          )}
        </button>

        <div className="flex items-center gap-2">
          {hasSummary && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-amber-700 hover:bg-amber-100 hover:text-amber-900"
                onClick={handleCopy}
              >
                {copied ? <CheckCircle2 className="ml-1.5 size-3.5 text-emerald-500" /> : <Copy className="ml-1.5 size-3.5" />}
                {copied ? "تم النسخ" : "نسخ"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-amber-700 hover:bg-amber-100 hover:text-amber-900"
                onClick={handleRegenerate}
                disabled={isLoading}
              >
                <ChevronDown className="ml-1.5 size-3.5 rotate-180" />
                إعادة التوليد
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-amber-600 hover:bg-amber-100"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="px-5 py-5">
          {isLoading && (
            <div className="flex flex-col items-center gap-3 py-6" dir="rtl">
              <div className="flex items-center gap-2 text-amber-700">
                <div className="size-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                <span className="text-sm font-medium">الذكاء الاصطناعي يقرأ المشاهد ويكتب الملخص...</span>
              </div>
              <div className="space-y-2 w-full mt-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-4 bg-amber-200/60 rounded animate-pulse" style={{ width: `${[100, 83, 80, 100, 75][i - 1]}%` }} />
                ))}
              </div>
            </div>
          )}
          {isError && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <p className="text-sm text-red-600 dark:text-red-400">{error?.message}</p>
              <Button variant="outline" size="sm" onClick={handleRegenerate} className="border-amber-300 text-amber-700">
                حاول مجدداً
              </Button>
            </div>
          )}
          {hasSummary && !isLoading && (
            <div
              className="text-base text-amber-900 dark:text-amber-100 leading-loose whitespace-pre-wrap font-medium"
              style={{ lineHeight: "2", fontFamily: "'Georgia', 'Amiri', serif" }}
            >
              {data!.summary}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
