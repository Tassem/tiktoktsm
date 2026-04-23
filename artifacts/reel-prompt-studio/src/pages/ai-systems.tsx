import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Bot, Save, RotateCcw, ChevronDown, ChevronUp, CheckCircle2, Film, Shuffle, BookOpen, Cpu } from "lucide-react";
import { format } from "date-fns";

const DEFAULT_MODEL_SENTINEL = "__default__";

const AVAILABLE_MODELS = [
  { value: DEFAULT_MODEL_SENTINEL, label: "الافتراضي (gpt-5.2)" },
  { value: "gpt-5.2", label: "GPT-5.2" },
  { value: "gpt-4.1", label: "GPT-4.1" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
  { value: "claude-3-haiku-20240307", label: "Claude 3 Haiku" },
];

type AiSystem = {
  systemKey: string;
  displayName: string;
  description: string;
  systemPrompt: string;
  modelOverride: string | null;
  updatedAt: string | null;
};

const SYSTEM_ICONS: Record<string, React.ElementType> = {
  "video-analysis": Film,
  "story-remix": Shuffle,
  "story-summary": BookOpen,
};

const SYSTEM_COLORS: Record<string, string> = {
  "video-analysis": "bg-blue-50 border-blue-200 text-blue-700",
  "story-remix": "bg-violet-50 border-violet-200 text-violet-700",
  "story-summary": "bg-amber-50 border-amber-200 text-amber-700",
};

function AiSystemCard({ system }: { system: AiSystem }) {
  const [expanded, setExpanded] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(system.systemPrompt);
  const [selectedModel, setSelectedModel] = useState(system.modelOverride ?? DEFAULT_MODEL_SENTINEL);
  const [isDirty, setIsDirty] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async ({ prompt, model }: { prompt: string; model: string }) => {
      const res = await fetch(`/api/ai-systems/${system.systemKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt: prompt, modelOverride: model === DEFAULT_MODEL_SENTINEL ? null : (model || null) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "فشل الحفظ" })) as { error?: string };
        throw new Error(body.error ?? "فشل الحفظ");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم الحفظ", description: `تم تحديث نظام "${system.displayName}"` });
      setIsDirty(false);
      void queryClient.invalidateQueries({ queryKey: ["ai-systems"] });
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/ai-systems/${system.systemKey}/reset`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Reset failed");
      return res.json() as Promise<{ systemPrompt: string; modelOverride: string | null }>;
    },
    onSuccess: (data) => {
      setEditedPrompt(data.systemPrompt);
      setSelectedModel(data.modelOverride ?? DEFAULT_MODEL_SENTINEL);
      setIsDirty(false);
      toast({ title: "تم الإعادة", description: "تم إعادة الإعدادات للافتراضية" });
      void queryClient.invalidateQueries({ queryKey: ["ai-systems"] });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل إعادة الضبط", variant: "destructive" });
    },
  });

  const IconComponent = SYSTEM_ICONS[system.systemKey] ?? Bot;
  const colorClass = SYSTEM_COLORS[system.systemKey] ?? "bg-gray-50 border-gray-200 text-gray-700";

  function handlePromptChange(value: string) {
    setEditedPrompt(value);
    setIsDirty(value !== system.systemPrompt || selectedModel !== (system.modelOverride ?? DEFAULT_MODEL_SENTINEL));
  }

  function handleModelChange(value: string) {
    setSelectedModel(value);
    setIsDirty(editedPrompt !== system.systemPrompt || value !== (system.modelOverride ?? DEFAULT_MODEL_SENTINEL));
  }

  const activeModelLabel = AVAILABLE_MODELS.find((m) => m.value === selectedModel)?.label ?? (selectedModel || "الافتراضي (gpt-5.2)");

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg border ${colorClass}`}>
              <IconComponent className="size-5" />
            </div>
            <div>
              <CardTitle className="text-base">{system.displayName}</CardTitle>
              <CardDescription className="mt-1 text-sm leading-relaxed">{system.description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {system.updatedAt && (
              <span className="text-xs text-muted-foreground hidden sm:block">
                آخر تعديل: {format(new Date(system.updatedAt), "d MMM yyyy")}
              </span>
            )}
            <Badge variant="outline" className="text-xs flex items-center gap-1 border-slate-200 text-slate-600">
              <Cpu className="size-3" /> {activeModelLabel}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded((v) => !v)}
              className="h-8 gap-1.5 text-xs"
            >
              {expanded ? "إخفاء" : "عرض الـ Prompt"}
              {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          {/* Model selector */}
          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Cpu className="size-3.5" /> نموذج الذكاء الاصطناعي
            </Label>
            <Select value={selectedModel} onValueChange={handleModelChange}>
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder="الافتراضي (gpt-5.2)" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="text-xs">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">اختر النموذج الذي سيستخدمه هذا النظام في كل عملية توليد</p>
          </div>

          {/* Prompt editor */}
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">System Prompt</span>
              {isDirty && (
                <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">
                  تعديلات غير محفوظة
                </Badge>
              )}
            </div>
            <Textarea
              value={editedPrompt}
              onChange={(e) => handlePromptChange(e.target.value)}
              rows={18}
              className="font-mono text-xs leading-relaxed resize-y min-h-[200px] bg-background"
              dir="ltr"
            />
          </div>

          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground"
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending || saveMutation.isPending}
            >
              {resetMutation.isPending ? (
                <div className="size-3.5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
              ) : (
                <RotateCcw className="size-3.5" />
              )}
              إعادة للافتراضي
            </Button>
            <Button
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => saveMutation.mutate({ prompt: editedPrompt, model: selectedModel })}
              disabled={!isDirty || saveMutation.isPending || editedPrompt.trim().length < 20}
            >
              {saveMutation.isPending ? (
                <div className="size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Save className="size-3.5" />
              )}
              حفظ التعديلات
            </Button>
          </div>

          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 leading-relaxed" dir="rtl">
            <strong>تأثير التعديل:</strong> أي تغيير في الـ prompt أو النموذج يؤثر مباشرة على نتائج التوليد القادمة. التعديلات محفوظة في قاعدة البيانات وتُطبّق تلقائياً في كل عملية توليد جديدة.
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function AiSystems() {
  const { data: systems, isLoading, isError } = useQuery<AiSystem[]>({
    queryKey: ["ai-systems"],
    queryFn: async () => {
      const res = await fetch("/api/ai-systems");
      if (!res.ok) throw new Error("Failed to load AI systems");
      return res.json() as Promise<AiSystem[]>;
    },
    staleTime: 1000 * 60 * 5,
  });

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-4xl mx-auto w-full pb-16">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Bot className="size-7 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">AI Systems</h1>
        </div>
        <p className="text-muted-foreground text-base mt-1">
          كل نظام ذكاء اصطناعي مع وظيفته والـ prompt الخاص به — يمكنك تعديل أي prompt وحفظه مباشرة
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-800 leading-relaxed" dir="rtl">
        <strong>ما هو الـ System Prompt؟</strong> هو مجموعة التعليمات الثابتة التي يتلقاها نموذج الذكاء الاصطناعي قبل كل عملية توليد. هذه التعليمات هي التي تتحكم في طريقة تفكير النموذج وأسلوب كتابته — تعديلها يغيّر النتائج بشكل مباشر.
      </div>

      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="text-center py-12 text-muted-foreground">
          <Bot className="size-12 mx-auto mb-4 opacity-30" />
          <p>تعذّر تحميل أنظمة الذكاء الاصطناعي</p>
        </div>
      )}

      {systems && (
        <div className="space-y-4">
          {systems.map((system) => (
            <AiSystemCard key={system.systemKey} system={system} />
          ))}
        </div>
      )}

      <div className="rounded-xl border p-4 bg-card/50 text-sm text-muted-foreground space-y-2" dir="rtl">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <CheckCircle2 className="size-4 text-emerald-500" />
          معلومات تقنية
        </div>
        <ul className="space-y-1 pr-6 list-disc">
          <li><strong>Video Analysis:</strong> يستخدم gpt-5.2 مع vision — يحلل فريمات الفيديو</li>
          <li><strong>Story Remix:</strong> يستخدم gpt-5.2 — يولّد قصصاً جديدة بالقوس الدرامي الكامل</li>
          <li><strong>Story Summary:</strong> يستخدم gpt-5.2 — يولّد الملخص العربي وخلاصات المشاهد مرة واحدة ويحفظها</li>
        </ul>
      </div>
    </div>
  );
}
