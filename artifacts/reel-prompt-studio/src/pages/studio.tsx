import { useEffect, useMemo, useRef, useState } from "react";
import {
  getGetDashboardSummaryQueryKey,
  getGetPromptPackQueryKey,
  getListAnalysesQueryKey,
  getListNichesQueryKey,
  getListPromptPacksQueryKey,
  getListRecentActivityQueryKey,
  type PromptPackDetail,
  useCreateAnalysis,
  useCreateNiche,
  useDeletePromptPack,
  useGetPromptPack,
  useGetProviderSettings,
  useListNiches,
  useListPromptPacks,
  useUpdatePromptPack,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Copy,
  Download,
  FileVideo,
  FolderInput,
  FolderPlus,
  History,
  Link2,
  Loader2,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
  Instagram,
  Youtube,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";

const studioSchema = z.object({
  nicheId: z.number().min(1, "Please select a base niche"),
  reelUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  reelNotes: z.string().min(10, "Please add context, transcript, or notes from the reel"),
  concept: z.string().min(5, "Please provide a concept for the new prompt pack"),
  demoMode: z.boolean().default(true),
  videoFrames: z.array(z.string()).min(1, "Upload a video file so the app can analyze real frames"),
  videoDataUrl: z.string().min(1, "Upload a video file so the app can analyze audio"),
});

type IntakeMode = "link" | "upload";

type NicheCreateOptions = {
  openToast?: boolean;
  selectAfterCreate?: boolean;
};

export default function Studio() {
  const { data: niches, isLoading: nichesLoading } = useListNiches();
  const { data: settings } = useGetProviderSettings();
  const { data: packs, isLoading: packsLoading } = useListPromptPacks();
  const createAnalysisMutation = useCreateAnalysis();
  const createNicheMutation = useCreateNiche();
  const updatePromptPackMutation = useUpdatePromptPack();
  const deletePromptPackMutation = useDeletePromptPack();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const realAnalysisEnabled = settings?.realAnalysisEnabled === true;
  const demoMode = !realAnalysisEnabled;

  const [mode, setMode] = useState<IntakeMode>("upload");
  const [nicheId, setNicheId] = useState<number>(0);
  const [reelUrl, setReelUrl] = useState("");
  const [reelNotes, setReelNotes] = useState("");
  const [concept, setConcept] = useState("Cinematic reel prompt pack");
  const [targetNicheId, setTargetNicheId] = useState<number>(0);
  const [search, setSearch] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [isExtractingFrames, setIsExtractingFrames] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);
  const [activePack, setActivePack] = useState<PromptPackDetail | null>(null);
  const [resultOpen, setResultOpen] = useState(false);

  const { data: historyPack } = useGetPromptPack(selectedHistoryId ?? 0, {
    query: { enabled: selectedHistoryId !== null, queryKey: getGetPromptPackQueryKey(selectedHistoryId ?? 0) },
  });

  useEffect(() => {
    if (historyPack) {
      setActivePack(historyPack);
      setResultOpen(true);
    }
  }, [historyPack]);

  useEffect(() => {
    if (!nicheId && niches?.length) {
      setNicheId(niches[0].id);
    }
  }, [nicheId, niches]);

  useEffect(() => {
    if (activePack) {
      setTargetNicheId(activePack.nicheId ?? 0);
    } else if (!targetNicheId && niches?.length) {
      setTargetNicheId(niches[0].id);
    }
  }, [activePack, niches, targetNicheId]);

  useEffect(() => {
    return () => {
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
    };
  }, [videoPreviewUrl]);

  const promptText = activePack ? formatPromptPack(activePack) : "";
  const isWorking =
    createAnalysisMutation.isPending ||
    createNicheMutation.isPending ||
    updatePromptPackMutation.isPending ||
    deletePromptPackMutation.isPending ||
    isExtractingFrames;

  const filteredPacks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!packs) return [];
    if (!query) return packs;
    return packs.filter((pack) =>
      [pack.title, pack.concept, pack.nicheName].some((value) => value.toLowerCase().includes(query)),
    );
  }, [packs, search]);

  function invalidateStudioData() {
    queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListPromptPacksQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListNichesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListRecentActivityQueryKey() });
  }

  function handleFileChange(file: File | undefined) {
    if (!file) return;
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }
    setSelectedFileName(file.name);
    setSelectedVideoFile(file);
    setVideoPreviewUrl(URL.createObjectURL(file));
    setMode("upload");
    if (!concept.trim() || concept === "Cinematic reel prompt pack") {
      setConcept(file.name.replace(/\.[^/.]+$/, ""));
    }
  }

  function createNicheFromPrompt(pack: PromptPackDetail, options: NicheCreateOptions = {}) {
    const payload = buildNicheFromPromptPack(pack);
    createNicheMutation.mutate(
      { data: payload },
      {
        onSuccess: (createdNiche) => {
          invalidateStudioData();
          if (options.selectAfterCreate) {
            setNicheId(createdNiche.id);
          }
          if (options.openToast !== false) {
            toast({ title: "Niche created", description: `${createdNiche.name} was created from the generated prompt.` });
          }
        },
        onError: (err) => {
          toast({ title: "Could not create niche", description: err.message || "Try again after generation.", variant: "destructive" });
        },
      },
    );
  }

  async function handleGenerate() {
    if (mode === "link") {
      if (!reelUrl.trim()) {
        toast({ title: "أضف رابط الفيديو", description: "ضع رابط TikTok أو Instagram أو YouTube للمتابعة.", variant: "destructive" });
        return;
      }
      if (!nicheId) {
        toast({ title: "اختر Niche", description: "اختر مجال العمل قبل توليد الـ prompt.", variant: "destructive" });
        return;
      }
      const generatedConcept = concept.trim() && concept !== "Cinematic reel prompt pack" ? concept.trim() : "Reel prompt from link";
      const generatedNotes = reelNotes.trim() || "Generate a complete production prompt pack based on the provided video link. Create a coherent Moroccan social media reel concept with proper narrative arc.";
      createAnalysisMutation.mutate(
        {
          data: {
            nicheId,
            reelUrl: reelUrl.trim(),
            reelNotes: generatedNotes,
            concept: generatedConcept,
            demoMode,
            videoFrames: [],
          },
        },
        {
          onSuccess: (result) => {
            invalidateStudioData();
            setActivePack(result.promptPack);
            setResultOpen(true);
            toast({ title: "تم توليد الـ Prompt", description: "تم إنشاء الـ prompt بناءً على الرابط." });
          },
          onError: (err) => {
            toast({ title: "فشل التحليل", description: err.message || "حدث خطأ ما", variant: "destructive" });
          },
        },
      );
      return;
    }

    if (!selectedVideoFile) {
      toast({
        title: "ارفع فيديو أولاً",
        description: "لتحليل الفيديو بالذكاء الاصطناعي يجب رفع ملف الفيديو. أو انتقل لـ Add Link لاستخدام الرابط فقط.",
        variant: "destructive",
      });
      return;
    }

    let videoFrames: string[];
    let videoDurationSeconds = 0;
    let videoDataUrl: string;
    try {
      setIsExtractingFrames(true);
      if (selectedVideoFile.size > 55 * 1024 * 1024) {
        throw new Error("This video is too large for full audio analysis. Please use a shorter or compressed version under 55MB.");
      }
      const extraction = await extractVideoFrames(selectedVideoFile);
      videoFrames = extraction.frames;
      videoDurationSeconds = extraction.durationSeconds;
      videoDataUrl = await readFileAsDataUrl(selectedVideoFile);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not read frames from the video.";
      toast({ title: "تعذر قراءة الفيديو", description: message, variant: "destructive" });
      return;
    } finally {
      setIsExtractingFrames(false);
    }

    const generatedConcept = concept.trim() && concept !== "Cinematic reel prompt pack" ? concept.trim() : "Uploaded reel visual prompt";
    const generatedNotes =
      reelNotes.trim() ||
      `Convert the uploaded video into a reusable prompt for generating a similar video later. The output should match a professional video-to-prompt brief with Style, Cinematography, Scene Breakdown, Actions, Dialogue in Moroccan Darija, and Background Sound. Video duration is about ${Math.round(videoDurationSeconds)} seconds, the frames are sampled across the full video, and the original video audio is included for transcription. Do not force a fixed scene count; use the number of scene blocks required by the visible and audible content.`;
    const parsed = studioSchema.safeParse({
      nicheId,
      reelUrl: "",
      reelNotes: generatedNotes,
      concept: generatedConcept,
      demoMode,
      videoFrames,
      videoDataUrl,
    });

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      toast({ title: "معلومات ناقصة", description: firstIssue?.message ?? "أكمل النموذج قبل التوليد.", variant: "destructive" });
      return;
    }

    createAnalysisMutation.mutate(
      { data: parsed.data },
      {
        onSuccess: (result) => {
          invalidateStudioData();
          setActivePack(result.promptPack);
          setResultOpen(true);
          toast({ title: "تم توليد الـ Prompt", description: "تم حفظ الـ brief وجاهز للاستخدام." });
        },
        onError: (err) => {
          toast({ title: "فشل تحليل الفيديو", description: err.message || "حدث خطأ ما", variant: "destructive" });
        },
      },
    );
  }

  function copyPrompt() {
    if (!promptText) return;
    navigator.clipboard.writeText(promptText);
    toast({ title: "Copied", description: "Prompt text copied to clipboard." });
  }

  function downloadPrompt() {
    if (!activePack || !promptText) return;
    const blob = new Blob([promptText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slugify(activePack.title)}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function addPromptPackToNiche(pack: PromptPackDetail) {
    if (!targetNicheId) {
      toast({ title: "Select a niche", description: "Choose an existing niche first.", variant: "destructive" });
      return;
    }

    updatePromptPackMutation.mutate(
      { promptPackId: pack.id, data: { nicheId: targetNicheId } },
      {
        onSuccess: (updatedPack) => {
          invalidateStudioData();
          setActivePack(updatedPack);
          setNicheId(updatedPack.nicheId ?? 0);
          toast({ title: "Added to niche", description: `Prompt pack is now saved under ${updatedPack.nicheName}.` });
        },
        onError: (err) => {
          toast({ title: "Could not add to niche", description: err.message || "Please try again.", variant: "destructive" });
        },
      },
    );
  }

  function deletePromptPackById(promptPackId: number) {
    const confirmed = window.confirm("Delete this prompt pack?");
    if (!confirmed) return;

    deletePromptPackMutation.mutate(
      { promptPackId },
      {
        onSuccess: () => {
          invalidateStudioData();
          if (activePack?.id === promptPackId) {
            setActivePack(null);
            setResultOpen(false);
          }
          if (selectedHistoryId === promptPackId) {
            setSelectedHistoryId(null);
          }
          toast({ title: "Deleted", description: "Prompt pack deleted from history." });
        },
        onError: (err) => {
          toast({ title: "Could not delete", description: err.message || "Please try again.", variant: "destructive" });
        },
      },
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant="secondary" className="mb-3 bg-primary/10 text-primary hover:bg-primary/10">
            <Sparkles className="mr-1 size-3" /> Studio workflow
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Video to Prompt</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">Upload a reel and convert the full video into a reusable prompt brief for generating a similar video later.</p>
        </div>
        <Button onClick={handleGenerate} disabled={isWorking || (!realAnalysisEnabled && !demoMode)} className="h-11 px-6 shadow-md shadow-primary/20">
          {isWorking ? <Loader2 className="mr-2 size-4 animate-spin" /> : <WandSparkles className="mr-2 size-4" />}
          {isExtractingFrames ? "Reading Video" : createAnalysisMutation.isPending ? (mode === "link" ? "Downloading & Analyzing..." : "Analyzing Video") : "Generate Prompt"}
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <div className="grid gap-6">
          <Card className="overflow-hidden border-primary/10 bg-card/90 shadow-sm">
            <CardHeader className="border-b border-border/70 bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileVideo className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-xl">1. Reel source</CardTitle>
                  <CardDescription>Choose a file or paste the reel URL.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-5">
              <div className="grid grid-cols-2 rounded-xl border border-border bg-muted/30 p-1">
                <button
                  type="button"
                  onClick={() => setMode("link")}
                  className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${mode === "link" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Link2 className="size-4" /> Add Link
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${mode === "upload" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Upload className="size-4" /> Upload File
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(event) => handleFileChange(event.target.files?.[0])}
                />
              </div>

              {mode === "link" && (
                <div className="space-y-3">
                  <Label>رابط الفيديو</Label>
                  <Input
                    value={reelUrl}
                    onChange={(event) => setReelUrl(event.target.value)}
                    placeholder="https://www.tiktok.com/@user/video/... أو يوتيوب أو انستقرام"
                    disabled={isWorking}
                    dir="ltr"
                  />
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Instagram className="size-3.5" /> Instagram Reels</span>
                    <span className="text-border">·</span>
                    <span className="flex items-center gap-1"><Youtube className="size-3.5 text-red-500" /> YouTube Shorts</span>
                    <span className="text-border">·</span>
                    <span className="flex items-center gap-1 font-bold text-[10px]">TikTok</span>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">وصف الفيديو / ملاحظات <span className="text-muted-foreground font-normal">(اختياري)</span></Label>
                    <textarea
                      value={reelNotes}
                      onChange={(e) => setReelNotes(e.target.value)}
                      placeholder="اشرح محتوى الفيديو، الشخصيات، القصة، الأسلوب... كلما زادت التفاصيل كان الـ prompt أدق."
                      disabled={isWorking}
                      rows={4}
                      dir="rtl"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    />
                  </div>
                  <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-start gap-2" dir="rtl">
                    <span className="shrink-0 mt-0.5">✓</span>
                    <span>سيتم تحميل الفيديو تلقائياً وتحليله بالكامل — نفس جودة رفع الفيديو يدوياً. للفيديوهات الخاصة أو المحمية، أضف وصفاً في الملاحظات.</span>
                  </p>
                </div>
              )}

              {mode === "upload" && (
              <div className="space-y-2">
                <Label>رفع الفيديو</Label>
                <div className="overflow-hidden rounded-2xl border border-border bg-muted/20">
                  {videoPreviewUrl ? (
                    <div>
                      <video className="aspect-video w-full bg-black object-contain" src={videoPreviewUrl} controls />
                      <div className="flex items-center justify-between gap-3 border-t border-border bg-background/70 px-4 py-3 text-sm">
                        <span className="truncate font-medium text-foreground">{selectedFileName}</span>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="shrink-0 text-xs text-primary hover:underline"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex w-full flex-col items-center gap-4 p-10 text-center transition hover:bg-muted/30 group"
                      disabled={isWorking}
                    >
                      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 border-2 border-dashed border-primary/30 group-hover:border-primary/60 group-hover:bg-primary/15 transition-colors">
                        <Upload className="size-7 text-primary/60 group-hover:text-primary transition-colors" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">ارفع الفيديو هنا أو انقر للاختيار</p>
                        <p className="mt-1 text-xs text-muted-foreground">MP4, MOV, WebM · Max 55 MB</p>
                        <p className="mt-1 text-xs text-muted-foreground">TikTok · Instagram · YouTube Shorts</p>
                      </div>
                    </button>
                  )}
                </div>
              </div>
              )}

              <div className="space-y-2">
                <Label>Concept / Pack title</Label>
                <Input
                  value={concept}
                  onChange={(event) => setConcept(event.target.value)}
                  placeholder="Cinematic lifestyle reel, Fitness transformation..."
                  disabled={isWorking}
                />
              </div>

              <div className="space-y-2">
                <Label>Niche</Label>
                <Select
                  value={nicheId ? String(nicheId) : ""}
                  onValueChange={(value) => setNicheId(Number(value))}
                  disabled={nichesLoading || isWorking}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a niche workspace" />
                  </SelectTrigger>
                  <SelectContent>
                    {niches?.map((niche) => (
                      <SelectItem key={niche.id} value={String(niche.id)}>{niche.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 self-start">
          <Card className="overflow-hidden border-primary/10 bg-card/90 shadow-sm">
            <CardHeader className="border-b border-border/70 bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <History className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-xl">2. History</CardTitle>
                  <CardDescription>Previously generated prompt packs.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search packs..."
                  className="pl-8 text-sm"
                />
              </div>

              {packsLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                  <Loader2 className="mr-2 size-4 animate-spin" /> Loading history...
                </div>
              ) : filteredPacks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <History className="mb-2 size-8 opacity-20" />
                  <p className="text-sm">{search ? "No packs match your search." : "No prompt packs yet. Generate your first one above."}</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {filteredPacks.map((pack) => (
                    <button
                      key={pack.id}
                      type="button"
                      onClick={() => setSelectedHistoryId(pack.id === selectedHistoryId ? null : pack.id)}
                      className={`w-full rounded-xl border p-3 text-left text-sm transition hover:border-primary/40 hover:bg-muted/30 ${selectedHistoryId === pack.id ? "border-primary/50 bg-primary/5" : "border-border bg-background"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-foreground">{pack.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{pack.nicheName} · {pack.sceneCount} scenes</p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(pack.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{activePack?.title ?? "Generated Prompt Pack"}</DialogTitle>
            <DialogDescription>{activePack?.concept}</DialogDescription>
          </DialogHeader>

          {activePack && (
            <>
              <div className="rounded-xl border border-border bg-muted/20 p-4 font-mono text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap max-h-72 overflow-y-auto">
                {promptText}
              </div>

              <div className="space-y-4 border-t border-border pt-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Post-generation options</p>
                  <p className="mt-1 text-xs text-muted-foreground">Choose what you want to do with this extracted prompt.</p>
                </div>

                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" onClick={copyPrompt}>
                      <Copy className="mr-2 size-4" /> Copy
                    </Button>
                    <Button type="button" variant="secondary" onClick={downloadPrompt}>
                      <Download className="mr-2 size-4" /> Download
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => toast({ title: "Already saved", description: "This prompt pack is saved in History." })}>
                      <Save className="mr-2 size-4" /> Save Prompt
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => createNicheFromPrompt(activePack, { selectAfterCreate: true })} disabled={createNicheMutation.isPending}>
                      {createNicheMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FolderPlus className="mr-2 size-4" />}
                      Create Niche from Prompt
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => deletePromptPackById(activePack.id)}
                      disabled={deletePromptPackMutation.isPending}
                    >
                      {deletePromptPackMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}
                      Delete
                    </Button>
                  </div>

                  <Button type="button" onClick={handleGenerate} disabled={isWorking || (!realAnalysisEnabled && !demoMode)}>
                    {isWorking ? <Loader2 className="mr-2 size-4 animate-spin" /> : <WandSparkles className="mr-2 size-4" />}
                    {isExtractingFrames ? "Reading Video" : createAnalysisMutation.isPending ? "Analyzing Video" : "Generate Again"}
                  </Button>
                </div>

                <div className="grid gap-3 rounded-xl border border-border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <div className="space-y-2">
                    <Label>Add to existing niche</Label>
                    <Select value={targetNicheId ? String(targetNicheId) : ""} onValueChange={(value) => setTargetNicheId(Number(value))} disabled={nichesLoading || updatePromptPackMutation.isPending}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose existing niche" />
                      </SelectTrigger>
                      <SelectContent>
                        {niches?.map((niche) => (
                          <SelectItem key={niche.id} value={String(niche.id)}>{niche.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" variant="secondary" onClick={() => addPromptPackToNiche(activePack)} disabled={updatePromptPackMutation.isPending || !targetNicheId}>
                    {updatePromptPackMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FolderInput className="mr-2 size-4" />}
                    Add to Niche
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function buildNicheFromPromptPack(pack: PromptPackDetail) {
  const scenes = [...pack.scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);
  const hookScene = scenes.find((scene) => scene.sceneType === "hook") ?? scenes[0];
  const mainThemes = scenes.slice(0, 3).map((scene) => scene.title).join(", ");
  const name = truncateText(`${pack.concept} niche`, 72);

  return {
    name,
    description: truncateText(`Auto-created from the generated prompt pack "${pack.title}". Core themes: ${mainThemes || pack.concept}.`, 260),
    audience: truncateText(`Viewers interested in ${pack.concept}. Best for the same audience behavior extracted from ${pack.nicheName}: quick emotional hooks, visual storytelling, and short-form reel pacing.`, 260),
    contentAngle: truncateText(`Hook: ${hookScene?.title ?? pack.concept}. Style direction: cinematic short-form prompts with English image, animation, and sound instructions plus Moroccan Darija voice-over.`, 260),
  };
}

function formatPromptPack(pack: PromptPackDetail) {
  const scenes = [...pack.scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);
  const sceneBlocks = scenes.map((scene) => {
    return `**Scene ${scene.sceneNumber}:${scene.sceneType === "hook" ? " HOOK —" : ""} ${scene.title}**\n\n**Image Prompt:**\n${buildCopyReadyImagePrompt(pack.summaryPrompt, scene.imagePrompt)}\n\n**Actions:**\n* ${scene.animationPrompt}\n\n**Dialogue:**\n${formatDialogueBlock(scene.voiceOverDarija)}\n\n**Background Sound:**\n${scene.soundEffectsPrompt}`;
  });

  return `${pack.summaryPrompt || "### Style\n* **Visual Texture:** Match the uploaded video's visible content.\n\n### Cinematography\n* **Camera:** Match the uploaded video's framing and movement."}\n\n---\n\n### Scene Breakdown\n\n${sceneBlocks.join("\n\n")}`;
}

function buildCopyReadyImagePrompt(_summaryPrompt: string | null | undefined, imagePrompt: string) {
  // imagePrompt is already 100% self-contained (per system prompt Rule 3).
  // Wrapping it with summaryPrompt would duplicate the style context inside the prompt.
  return imagePrompt;
}

function formatDialogueBlock(dialogue: string) {
  const lines = dialogue
    .replace(/\s+(?=[A-Z][A-Za-z ]{1,32}(?:\s*\([^)]*\))?:\s*")/g, "\n")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.join("\n");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "prompt-pack";
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trim()}…`;
}

async function extractVideoFrames(file: File) {
  const videoUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = videoUrl;
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";

  try {
    await waitForVideoEvent(video, "loadedmetadata");

    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error("The selected video could not be read.");
    }

    const canvas = document.createElement("canvas");
    const aspectRatio = video.videoWidth > 0 && video.videoHeight > 0 ? video.videoWidth / video.videoHeight : 9 / 16;
    canvas.width = 400;
    canvas.height = Math.round(canvas.width / aspectRatio);
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Could not prepare video frames.");
    }

    const usableDuration = Math.max(video.duration - 0.2, 0.1);
    // 1 frame per 3 seconds = better scene coverage; cap at 48 to avoid very long uploads
    const frameCount = Math.min(48, Math.max(12, Math.ceil(video.duration / 3)));
    const times = Array.from({ length: frameCount }, (_, index) => {
      const ratio = frameCount === 1 ? 0.5 : index / (frameCount - 1);
      return Math.min(usableDuration, 0.15 + ratio * Math.max(usableDuration - 0.15, 0.1));
    });

    const frames: string[] = [];
    for (const time of times) {
      video.currentTime = time;
      await waitForVideoEvent(video, "seeked");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.65));
    }

    return { frames, durationSeconds: video.duration };
  } finally {
    URL.revokeObjectURL(videoUrl);
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Could not read the selected video for audio analysis."));
      }
    };
    reader.onerror = () => reject(new Error("Could not read the selected video for audio analysis."));
    reader.readAsDataURL(file);
  });
}

function waitForVideoEvent(video: HTMLVideoElement, eventName: "loadedmetadata" | "seeked") {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener(eventName, handleEvent);
      video.removeEventListener("error", handleError);
    };
    const handleEvent = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("The video could not be loaded for analysis."));
    };

    video.addEventListener(eventName, handleEvent, { once: true });
    video.addEventListener("error", handleError, { once: true });
  });
}
