import { useState } from "react";
import {
  useListPromptPacks,
  useRemixPromptPack,
  getListPromptPacksQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Search,
  Shuffle,
  RefreshCw,
  Sparkles,
  Lightbulb,
  Film,
  CheckCircle2,
  ArrowRight,
  Layers,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type RemixMode = "rephrase" | "similar" | "new";

interface ModeConfig {
  id: RemixMode;
  icon: typeof RefreshCw;
  label: string;
  labelAr: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  inputLabel?: string;
  placeholder?: string;
  hint?: string;
  required: boolean;
}

const MODES: ModeConfig[] = [
  {
    id: "rephrase",
    icon: RefreshCw,
    label: "Rephrase",
    labelAr: "إعادة صياغة",
    description: "نفس القصة والشخصيات، لكن بـ prompts أكثر احترافية ودقة",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-300",
    required: false,
    inputLabel: "ملاحظات إضافية (اختياري)",
    placeholder: "مثلاً: ركّز أكثر على الإضاءة الليلية، أو اجعل الحوارات أقوى...",
    hint: "الذكاء الاصطناعي سيُعيد كتابة كل الـ prompts بجودة أعلى مع نفس القصة",
  },
  {
    id: "similar",
    icon: Sparkles,
    label: "Similar Twist",
    labelAr: "فكرة مشابهة",
    description: "نفس الجانر والأسلوب البصري، لكن بسيناريو مختلف قليلاً",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-300",
    required: true,
    inputLabel: "ما الذي تريد تغييره؟ *",
    placeholder: "مثلاً: نفس فريزيتا وبنانة، لكن هذه المرة الخيانة من طرف بنانة مع أخو فريزيتا...",
    hint: "صِف التحوّل الذي تريده — الشخصيات الرئيسية تبقى لكن الحبكة تتغير",
  },
  {
    id: "new",
    icon: Lightbulb,
    label: "New Concept",
    labelAr: "فكرة جديدة",
    description: "نفس الأسلوب البصري من الـ pack الأصلي، لكن قصة ومشاهد جديدة بالكامل",
    color: "text-violet-600",
    bgColor: "bg-violet-50",
    borderColor: "border-violet-300",
    required: true,
    inputLabel: "السيناريو الجديد بالتفصيل *",
    placeholder: `مثلاً:
• فريزيتا وتفاحة في علاقة سرية — أولاً يتبيّن كيف بدات العلاقة (لقاءاتهم السرية في المقهى)
• من بعد، الأب ديال فريزيتا يلقا رسائلهم في تليفونها بالصدفة
• مواجهة حادة بين الأب وتفاحة في الزقاق
• فريزيتا تعترف وتطلب السماح — الأب يصمت`,
    hint: "💡 كلما زدت التفصيل (من بداية العلاقة ← للاكتشاف ← للمواجهة ← للنتيجة) كانت القصة أقوى وأوضح",
  },
];

function buildStoryIdea(mode: RemixMode, userInput: string, packTitle: string): string {
  if (mode === "rephrase") {
    const notes = userInput.trim();
    return [
      `TASK: Rephrase and professionally upgrade this SAME story with better cinematic quality.`,
      `Keep all character names, relationships, and the exact narrative arc IDENTICAL to the original pack: "${packTitle}".`,
      `ONLY improve: make imagePrompts longer and more detailed (min 150 words each), animationPrompts more precise with richer camera language and stronger speaker blocking, voiceOverDarija more emotionally authentic and natural.`,
      `Add missing establishing beats if the original story feels rushed — make the full arc clear and complete.`,
      notes ? `DIRECTOR NOTES: ${notes}` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }
  if (mode === "similar") {
    return `SIMILAR TWIST on the original pack "${packTitle}": ${userInput.trim()}

IMPORTANT: Follow the mandatory story structure (ACT 1 setup → ACT 2 development → ACT 2B conflict/discovery → ACT 3 resolution). The visual style stays identical. Write a COMPLETE story where the relationship/situation is established FIRST, then complications arise, then the conflict/discovery, then the resolution. Do not skip any act.`;
  }
  // mode === "new"
  const trimmed = userInput.trim();
  return `NEW STORY CONCEPT:
${trimmed}

STORY STRUCTURE REQUIREMENT: Follow all three acts strictly.
ACT 1: Establish the characters and their relationship/situation CLEARLY before any conflict happens. The viewer must understand who these characters are to each other.
ACT 2A: Develop the situation — show the secret/relationship more explicitly or deepen the stakes.
ACT 2B: The discovery or confrontation — HIGH EMOTIONAL STAKES. Must be earned by Act 1 setup.
ACT 3: Climax + resolution — characters make a decision or change. Emotional payoff.

Write enough scenes to tell this story COMPLETELY. Each scene must advance the story. No shortcuts.`;
}

export default function RemixStudio() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mode, setMode] = useState<RemixMode>("new");
  const [userInput, setUserInput] = useState("");
  const [conceptTitle, setConceptTitle] = useState("");

  const { data: packs, isLoading } = useListPromptPacks();
  const remixMutation = useRemixPromptPack();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const selectedPack = packs?.find((p) => p.id === selectedId);
  const currentMode = MODES.find((m) => m.id === mode)!;

  const filtered = packs?.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.concept.toLowerCase().includes(search.toLowerCase()) ||
      p.nicheName.toLowerCase().includes(search.toLowerCase()),
  );

  const canGenerate =
    selectedId !== null &&
    (!currentMode.required || userInput.trim().length >= 10);

  function handleGenerate() {
    if (!selectedId || !selectedPack) return;
    const storyIdea = buildStoryIdea(mode, userInput, selectedPack.title);
    remixMutation.mutate(
      {
        promptPackId: selectedId,
        data: {
          storyIdea,
          concept: conceptTitle.trim() || undefined,
        },
      },
      {
        onSuccess: (newPack) => {
          queryClient.invalidateQueries({ queryKey: getListPromptPacksQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          toast({ title: "Remix generated!", description: newPack.title });
          navigate(`/packs/${newPack.id}`);
        },
        onError: (err) => {
          toast({ title: "Generation failed", description: err.message, variant: "destructive" });
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-0 h-full animate-in fade-in duration-500">
      {/* Header */}
      <div className="pb-6 border-b border-border">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-md">
            <Shuffle className="size-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Remix Studio</h1>
        </div>
        <p className="text-muted-foreground mt-1 text-base">
          اختر pack موجود، حدد طريقة الـ remix، واتركِ الذكاء الاصطناعي يبني pack جديد من الصفر.
        </p>
      </div>

      <div className="flex gap-6 flex-1 min-h-0 pt-6 pb-10">
        {/* Left panel — Pack selector */}
        <div className="w-[340px] shrink-0 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm uppercase tracking-widest text-muted-foreground">
              اختر Pack
            </h2>
            {selectedId && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-muted-foreground"
                onClick={() => setSelectedId(null)}
              >
                إلغاء الاختيار
              </Button>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="ابحث..."
              className="pl-8 h-9 text-sm bg-card"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2 overflow-y-auto pr-1" style={{ maxHeight: "calc(100vh - 300px)" }}>
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl border p-3 bg-card space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                ))
              : filtered?.map((pack) => {
                  const isSelected = pack.id === selectedId;
                  return (
                    <button
                      key={pack.id}
                      onClick={() => setSelectedId(isSelected ? null : pack.id)}
                      className={cn(
                        "w-full text-left rounded-xl border p-3 transition-all duration-150 group",
                        isSelected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/30 shadow-sm"
                          : "border-border bg-card hover:border-primary/40 hover:bg-card/80",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-xs font-medium",
                            isSelected
                              ? "bg-primary/15 text-primary"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          <Layers className="size-2.5 mr-1 inline" />
                          {pack.nicheName}
                        </Badge>
                        {isSelected && (
                          <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
                        )}
                      </div>
                      <p
                        className={cn(
                          "font-semibold text-sm leading-snug line-clamp-2",
                          isSelected ? "text-primary" : "text-foreground",
                        )}
                      >
                        {pack.title}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Film className="size-3" /> {pack.sceneCount} scenes
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />{" "}
                          {format(new Date(pack.createdAt), "MMM d")}
                        </span>
                      </div>
                    </button>
                  );
                })}

            {!isLoading && filtered?.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-10 border-2 border-dashed rounded-xl">
                لا توجد packs مطابقة
              </div>
            )}
          </div>
        </div>

        {/* Right panel — Config */}
        <div className="flex-1 flex flex-col gap-5 min-w-0">
          {/* Selected pack preview */}
          {selectedPack ? (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
                  Pack المختار
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="font-bold text-lg text-foreground leading-tight line-clamp-2">
                  {selectedPack.title}
                </p>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {selectedPack.concept}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-xs">
                    <Layers className="size-2.5 mr-1 inline" /> {selectedPack.nicheName}
                  </Badge>
                  <span className="flex items-center gap-1">
                    <Film className="size-3" /> {selectedPack.sceneCount} scenes
                  </span>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-border bg-muted/30 flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
              <Shuffle className="size-8 opacity-30" />
              <p className="text-sm font-medium">اختر pack من اليسار للبدء</p>
            </div>
          )}

          {/* Mode selector */}
          <div>
            <h2 className="font-semibold text-sm uppercase tracking-widest text-muted-foreground mb-3">
              نوع الـ Remix
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {MODES.map((m) => {
                const Icon = m.icon;
                const isActive = mode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setMode(m.id);
                      setUserInput("");
                    }}
                    className={cn(
                      "rounded-xl border-2 p-4 text-left transition-all duration-150 hover:shadow-sm",
                      isActive
                        ? `${m.borderColor} ${m.bgColor} shadow-sm`
                        : "border-border bg-card hover:border-border/80",
                    )}
                  >
                    <Icon
                      className={cn("size-5 mb-2", isActive ? m.color : "text-muted-foreground")}
                    />
                    <p
                      className={cn(
                        "font-bold text-sm",
                        isActive ? m.color : "text-foreground",
                      )}
                    >
                      {m.labelAr}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 leading-snug">
                      {m.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Input area */}
          <div className="space-y-3">
            {currentMode.inputLabel && (
              <div className="space-y-2">
                <Label htmlFor="userInput" className="text-sm font-medium">
                  {currentMode.inputLabel}
                </Label>
                {mode === "new" && (
                  <div className="grid grid-cols-4 gap-1.5 text-[11px] mb-1">
                    {[
                      { num: "1", label: "تأسيس العلاقة", color: "bg-blue-100 text-blue-700 border-blue-200" },
                      { num: "2", label: "تطور الوضع", color: "bg-amber-100 text-amber-700 border-amber-200" },
                      { num: "3", label: "الاكتشاف/الصراع", color: "bg-red-100 text-red-700 border-red-200" },
                      { num: "4", label: "المواجهة/النهاية", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
                    ].map((step) => (
                      <div key={step.num} className={`rounded border px-2 py-1.5 text-center font-medium ${step.color}`}>
                        <span className="block font-bold text-xs mb-0.5">{step.num}▸</span>
                        {step.label}
                      </div>
                    ))}
                  </div>
                )}
                <Textarea
                  id="userInput"
                  placeholder={currentMode.placeholder}
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  disabled={remixMutation.isPending}
                  rows={mode === "rephrase" ? 2 : mode === "new" ? 6 : 4}
                  className="resize-none text-sm font-mono"
                  dir="auto"
                />
                {currentMode.hint && (
                  <p className="text-xs text-muted-foreground">{currentMode.hint}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="conceptTitle" className="text-sm font-medium">
                عنوان الـ Pack الجديد{" "}
                <span className="text-muted-foreground font-normal">(اختياري)</span>
              </Label>
              <Input
                id="conceptTitle"
                placeholder="مثلاً: خيانة بنانة — درامة الفاكهة"
                value={conceptTitle}
                onChange={(e) => setConceptTitle(e.target.value)}
                disabled={remixMutation.isPending}
                className="text-sm"
              />
            </div>
          </div>

          {/* Generate button */}
          <div className="mt-auto">
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate || remixMutation.isPending}
              size="lg"
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg disabled:opacity-40"
            >
              {remixMutation.isPending ? (
                <span className="flex items-center gap-3">
                  <div className="size-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>الذكاء الاصطناعي يولّد الـ Pack... قد يأخذ دقيقة</span>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Shuffle className="size-5" />
                  توليد الـ Remix
                  <ArrowRight className="size-4 ml-1" />
                </span>
              )}
            </Button>

            {!selectedId && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                اختر pack من القائمة اليسرى أولاً
              </p>
            )}
            {selectedId && currentMode.required && userInput.trim().length < 10 && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                أدخل {currentMode.inputLabel?.replace(" *", "")} (10 أحرف على الأقل)
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
