import { useGetProviderSettings, useUpdateProviderSettings, getGetProviderSettingsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Settings as SettingsIcon, Key, AlertTriangle, Sparkles, Film, Info, CheckCircle2, Trash2, Lock, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState, useCallback } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

const API_KEY_TYPES = [
  {
    key: "openai",
    label: "OpenAI",
    hint: "لتحليل الفيديو، Remix، وملخص القصة (gpt-5.2)",
    placeholder: "sk-...",
    link: "platform.openai.com/api-keys",
    color: "emerald",
  },
  {
    key: "fal",
    label: "fal.ai",
    hint: "لتوليد الصور (FLUX) والفيديو (Veo 3، Kling)",
    placeholder: "fal_...",
    link: "fal.ai/dashboard",
    color: "violet",
  },
  {
    key: "bfl",
    label: "BFL (Black Forest Labs)",
    hint: "لتوليد الصور مباشرة عبر FLUX Pro/Dev",
    placeholder: "bfl_...",
    link: "api.bfl.ai/settings",
    color: "amber",
  },
  {
    key: "google",
    label: "Google AI Studio",
    hint: "لتوليد الفيديو مباشرة عبر Veo 3",
    placeholder: "AIza...",
    link: "aistudio.google.com/apikey",
    color: "blue",
  },
];

function UserApiKeysCard() {
  const { toast } = useToast();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const { data, isLoading, refetch } = useQuery<{ keys: Record<string, string> }>({
    queryKey: ["user-api-keys"],
    queryFn: async () => {
      const res = await fetch("/api/user-keys", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch keys");
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ keyType, apiKey }: { keyType: string; apiKey: string }) => {
      const res = await fetch(`/api/user-keys/${keyType}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Failed to save");
      }
    },
    onSuccess: (_, { keyType }) => {
      toast({ title: "✅ تم الحفظ", description: `مفتاح ${keyType} حُفظ في حسابك` });
      setEditingKey(null);
      setInputValues((v) => ({ ...v, [keyType]: "" }));
      refetch();
    },
    onError: (err) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (keyType: string) => {
      const res = await fetch(`/api/user-keys/${keyType}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: (_, keyType) => {
      toast({ title: "🗑️ تم الحذف", description: `مفتاح ${keyType} حُذف` });
      refetch();
    },
    onError: (err) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const maskedKeys = data?.keys ?? {};

  return (
    <Card className="border-violet-200/60 dark:border-violet-800/30 bg-gradient-to-br from-violet-50/40 to-indigo-50/20 dark:from-violet-950/20 dark:to-indigo-950/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="size-5 text-violet-600" />
          مفاتيح API الشخصية
        </CardTitle>
        <CardDescription>
          مفاتيحك مُخزّنة بأمان في حسابك — تُستخدم تلقائياً في التحليل والتوليد دون أن تُشارَك مع أي عضو آخر.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          API_KEY_TYPES.map((kt) => {
            const hasSaved = !!maskedKeys[kt.key];
            const isEditing = editingKey === kt.key;
            return (
              <div
                key={kt.key}
                className="flex flex-col gap-2 p-3 rounded-lg border border-border/50 bg-background/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{kt.label}</span>
                    {hasSaved ? (
                      <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30">
                        <CheckCircle2 className="size-2.5 mr-1" /> محفوظ: {maskedKeys[kt.key]}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">غير مضاف</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {hasSaved && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(kt.key)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                    <Button
                      variant={isEditing ? "outline" : "secondary"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setEditingKey(isEditing ? null : kt.key)}
                    >
                      {isEditing ? "إلغاء" : hasSaved ? "تغيير" : "إضافة"}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{kt.hint}</p>
                {isEditing && (
                  <div className="flex gap-2 mt-1">
                    <Input
                      type={showKeys[kt.key] ? "text" : "password"}
                      placeholder={kt.placeholder}
                      value={inputValues[kt.key] ?? ""}
                      onChange={(e) => setInputValues((v) => ({ ...v, [kt.key]: e.target.value }))}
                      className="font-mono text-xs h-8"
                      autoComplete="off"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 text-xs"
                      onClick={() => setShowKeys((v) => ({ ...v, [kt.key]: !v[kt.key] }))}
                    >
                      {showKeys[kt.key] ? "إخفاء" : "إظهار"}
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 shrink-0"
                      onClick={() => saveMutation.mutate({ keyType: kt.key, apiKey: inputValues[kt.key] ?? "" })}
                      disabled={saveMutation.isPending || !inputValues[kt.key]?.trim()}
                    >
                      حفظ
                    </Button>
                  </div>
                )}
                {!isEditing && (
                  <a
                    href={`https://${kt.link}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-violet-600 hover:underline"
                  >
                    احصل على مفتاحك من: {kt.link} ↗
                  </a>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

const settingsSchema = z.object({
  providerName: z.string().min(1, "Provider name is required"),
  model: z.string().min(1, "Model is required"),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  clearApiKey: z.boolean().default(false),
}).superRefine((value, context) => {
  if (value.providerName === "custom" && !value.baseUrl?.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["baseUrl"],
      message: "Base URL is required for a custom provider",
    });
  }
});

function normalizeProviderName(providerName: string) {
  return providerName === "OpenAI compatible" ? "openai" : providerName;
}

const IMAGE_MODELS = [
  { value: "flux-schnell", label: "FLUX Schnell (سريع — BFL)" },
  { value: "flux-dev", label: "FLUX Dev (جودة — BFL)" },
  { value: "flux-pro", label: "FLUX Pro (احترافي — BFL)" },
  { value: "dalle3", label: "DALL-E 3 (OpenAI)" },
  { value: "ideogram", label: "Ideogram 2.0" },
  { value: "custom", label: "نموذج مخصص" },
];

const VIDEO_MODELS = [
  { value: "veo-3", label: "Veo 3 (Google DeepMind) ✨" },
  { value: "veo-2", label: "Veo 2 (Google)" },
  { value: "kling-1.6", label: "Kling 1.6" },
  { value: "runway-gen4", label: "Runway Gen-4" },
  { value: "pika-2", label: "Pika 2.0" },
  { value: "custom", label: "نموذج مخصص" },
];

const IMAGE_PROVIDERS = [
  { value: "bfl-direct", label: "🍌 BFL Direct — api.bfl.ai (حسابك الخاص)" },
  { value: "fal", label: "fal.ai (FLUX + models)" },
  { value: "openai", label: "OpenAI (DALL-E)" },
  { value: "custom", label: "Custom Endpoint" },
];

const IMAGE_PROVIDERS_HINTS: Record<string, string> = {
  "bfl-direct": "احصل على مفتاحك من: api.bfl.ai/settings — يُحاسب مباشرة من حساب BFL",
  "fal": "احصل على مفتاحك من: fal.ai/dashboard — يدعم FLUX + Veo + Kling",
  "openai": "احصل على مفتاحك من: platform.openai.com/api-keys",
  "custom": "أدخل API endpoint مخصص",
};

const VIDEO_PROVIDERS = [
  { value: "fal", label: "fal.ai (Veo 3 + Kling + Runway) — موصى به" },
  { value: "google", label: "Google AI Studio (Veo 3 مباشر)" },
  { value: "runwayml", label: "Runway ML" },
  { value: "custom", label: "Custom Endpoint" },
];

const VIDEO_PROVIDERS_HINTS: Record<string, string> = {
  "fal": "مفتاح fal.ai — يدعم Veo 3, Kling 1.6, Runway Gen-4, Pika",
  "google": "مفتاح Google AI Studio من: aistudio.google.com — يحتاج وصول Veo 3",
  "runwayml": "مفتاح Runway من: app.runwayml.com/account/api-keys",
  "custom": "أدخل API endpoint مخصص",
};

function useGenerationSettings() {
  const [settings, setSettings] = useState<{
    imageModel: string;
    videoModel: string;
    imageProvider: string;
    videoProvider: string;
    imageApiKey: string;
    videoApiKey: string;
  }>(() => {
    try {
      return JSON.parse(localStorage.getItem("reel-gen-settings") || "null") || {
        imageModel: "flux-schnell",
        videoModel: "veo-3",
        imageProvider: "fal",
        videoProvider: "fal",
        imageApiKey: "",
        videoApiKey: "",
      };
    } catch {
      return {
        imageModel: "flux-schnell",
        videoModel: "veo-3",
        imageProvider: "fal",
        videoProvider: "fal",
        imageApiKey: "",
        videoApiKey: "",
      };
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

export default function Settings() {
  const { data: settings, isLoading } = useGetProviderSettings();
  const updateMutation = useUpdateProviderSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [genSettings, updateGenSettings] = useGenerationSettings();
  const [showImageKey, setShowImageKey] = useState(false);
  const [showVideoKey, setShowVideoKey] = useState(false);

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      providerName: "anthropic",
      model: "claude-3-5-sonnet-20241022",
      baseUrl: "",
      apiKey: "",
      clearApiKey: false,
    },
    values: settings
      ? {
          providerName: normalizeProviderName(settings.providerName),
          model: settings.model,
          baseUrl: settings.baseUrl ?? "",
          apiKey: "",
          clearApiKey: false,
        }
      : undefined,
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        providerName: normalizeProviderName(settings.providerName),
        model: settings.model,
        baseUrl: settings.baseUrl ?? "",
        apiKey: "",
        clearApiKey: false,
      });
    }
  }, [settings, form]);

  function onSubmit(data: z.infer<typeof settingsSchema>) {
    updateMutation.mutate(
      { data: { ...data, baseUrl: data.baseUrl?.trim() || undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProviderSettingsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          toast({ title: "Settings updated successfully" });
          form.resetField("apiKey");
          form.resetField("clearApiKey", { defaultValue: false });
        },
        onError: (err) => {
          toast({ title: "Error updating settings", description: err.message, variant: "destructive" });
        }
      }
    );
  }

  const isConfigured = settings?.apiKeyConfigured;
  const selectedProvider = form.watch("providerName") || (settings ? normalizeProviderName(settings.providerName) : "anthropic");

  return (
    <div className="flex flex-col gap-6 h-full max-w-3xl mx-auto w-full animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <SettingsIcon className="size-8 text-primary" /> Settings
        </h1>
        <p className="text-muted-foreground mt-2">إعدادات حسابك الشخصي ومزودي الذكاء الاصطناعي.</p>
      </div>

      {/* User Personal API Keys */}
      <UserApiKeysCard />

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          {!isConfigured ? (
            <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 text-destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Provider Profile Not Configured</AlertTitle>
              <AlertDescription>
                Save a provider profile if you want to track which model and endpoint should be used for AI prompt generation.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="size-4 text-amber-700 dark:text-amber-300" />
              <AlertTitle>Provider Profile Saved</AlertTitle>
              <AlertDescription>
                Your provider choice, model, base URL, and key status are saved for this workspace.
                {settings?.apiKeyLastFour ? ` (Key ends in ••••${settings.apiKeyLastFour})` : ""}
              </AlertDescription>
            </Alert>
          )}

          <Card className="border-violet-200/60 dark:border-violet-800/30 bg-violet-50/30 dark:bg-violet-950/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-5 text-violet-600" />
                إعدادات توليد الصور
              </CardTitle>
              <CardDescription>اختر مزود الـ AI ونموذج التوليد للصور في كل Scene</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Alert className="bg-violet-500/5 border-violet-300/40 text-violet-800 dark:text-violet-300">
                <Info className="size-4 text-violet-600" />
                <AlertTitle>نصيحة</AlertTitle>
                <AlertDescription>
                  يُنصح باستخدام <strong>FLUX Schnell</strong> عبر fal.ai للسرعة، أو <strong>FLUX Dev</strong> للجودة العالية. احصل على مفتاح API من{" "}
                  <a href="https://fal.ai/dashboard" target="_blank" rel="noopener noreferrer" className="underline">
                    fal.ai
                  </a>{" "}
                  أو{" "}
                  <a href="https://api.bfl.ml" target="_blank" rel="noopener noreferrer" className="underline">
                    BFL
                  </a>
                  .
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">مزود التوليد</label>
                  <Select value={genSettings.imageProvider} onValueChange={(v) => updateGenSettings({ imageProvider: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {IMAGE_PROVIDERS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {IMAGE_PROVIDERS_HINTS[genSettings.imageProvider] && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-1.5 rounded-md border border-amber-200/50">
                      {IMAGE_PROVIDERS_HINTS[genSettings.imageProvider]}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">النموذج</label>
                  <Select value={genSettings.imageModel} onValueChange={(v) => updateGenSettings({ imageModel: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {IMAGE_MODELS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Key className="size-3.5 text-muted-foreground" />
                  API Key (صور)
                </label>
                <div className="flex gap-2">
                  <Input
                    type={showImageKey ? "text" : "password"}
                    placeholder="fal_... أو bfl_..."
                    value={genSettings.imageApiKey}
                    onChange={(e) => updateGenSettings({ imageApiKey: e.target.value })}
                    className="font-mono text-sm"
                  />
                  <Button variant="outline" size="sm" onClick={() => setShowImageKey((v) => !v)} className="shrink-0">
                    {showImageKey ? "إخفاء" : "إظهار"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">يُحفظ محلياً في متصفحك فقط — لا يُرسل للسيرفر</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-rose-200/60 dark:border-rose-800/30 bg-rose-50/30 dark:bg-rose-950/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Film className="size-5 text-rose-600" />
                إعدادات توليد الفيديو
              </CardTitle>
              <CardDescription>اختر نموذج AI لتوليد مقاطع الفيديو من الـ Scene</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Alert className="bg-rose-500/5 border-rose-300/40 text-rose-800 dark:text-rose-300">
                <Info className="size-4 text-rose-600" />
                <AlertTitle>نصيحة</AlertTitle>
                <AlertDescription>
                  يُنصح باستخدام <strong>Veo 3</strong> من Google DeepMind للجودة الاحترافية. متاح عبر{" "}
                  <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" className="underline">
                    Google AI Studio
                  </a>
                  . بديل جيد: <strong>Kling 1.6</strong> عبر fal.ai.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">مزود التوليد</label>
                  <Select value={genSettings.videoProvider} onValueChange={(v) => updateGenSettings({ videoProvider: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VIDEO_PROVIDERS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {VIDEO_PROVIDERS_HINTS[genSettings.videoProvider] && (
                    <p className="text-xs text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-2 py-1.5 rounded-md border border-rose-200/50">
                      {VIDEO_PROVIDERS_HINTS[genSettings.videoProvider]}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">النموذج</label>
                  <Select value={genSettings.videoModel} onValueChange={(v) => updateGenSettings({ videoModel: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VIDEO_MODELS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Key className="size-3.5 text-muted-foreground" />
                  API Key (فيديو)
                </label>
                <div className="flex gap-2">
                  <Input
                    type={showVideoKey ? "text" : "password"}
                    placeholder="AIza... أو fal_..."
                    value={genSettings.videoApiKey}
                    onChange={(e) => updateGenSettings({ videoApiKey: e.target.value })}
                    className="font-mono text-sm"
                  />
                  <Button variant="outline" size="sm" onClick={() => setShowVideoKey((v) => !v)} className="shrink-0">
                    {showVideoKey ? "إخفاء" : "إظهار"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">يُحفظ محلياً في متصفحك فقط — لا يُرسل للسيرفر</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle>AI Provider Settings</CardTitle>
              <CardDescription>Select your LLM provider and model for prompt generation.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="providerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Provider</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value || (settings ? normalizeProviderName(settings.providerName) : "anthropic")}
                            disabled={updateMutation.isPending}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select provider" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="anthropic">Anthropic</SelectItem>
                              <SelectItem value="openai">OpenAI</SelectItem>
                              <SelectItem value="custom">Custom provider</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Model</FormLabel>
                          {selectedProvider === "custom" ? (
                            <FormControl>
                              <Input placeholder="gpt-4o, qwen-vl-max, ..." className="font-mono" {...field} disabled={updateMutation.isPending} />
                            </FormControl>
                          ) : (
                            <Select 
                              onValueChange={field.onChange} 
                              value={field.value || settings?.model || "gpt-4o"}
                              disabled={updateMutation.isPending}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select model" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {selectedProvider === "anthropic" ? (
                                  <>
                                    <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</SelectItem>
                                    <SelectItem value="claude-3-haiku-20240307">Claude 3 Haiku</SelectItem>
                                  </>
                                ) : (
                                  <>
                                    <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                                    <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                                  </>
                                )}
                              </SelectContent>
                            </Select>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {selectedProvider === "custom" && (
                    <FormField
                      control={form.control}
                      name="baseUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Base URL</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="https://api.example.com/v1" 
                              className="font-mono"
                              {...field} 
                              disabled={updateMutation.isPending}
                            />
                          </FormControl>
                          <FormDescription>
                            Use an OpenAI-compatible endpoint URL for your custom provider.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="apiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Key</FormLabel>
                        <div className="relative">
                          <Key className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder={isConfigured ? "••••••••••••••••••••••••" : "sk-..."} 
                              className="pl-9 font-mono"
                              {...field} 
                              disabled={updateMutation.isPending || form.watch("clearApiKey")}
                            />
                          </FormControl>
                        </div>
                        <FormDescription>
                          Entering a key records configured status and last-four metadata for this workspace.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {isConfigured && (
                    <FormField
                      control={form.control}
                      name="clearApiKey"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-destructive/20 p-4 bg-destructive/5">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base text-destructive">Remove API Key</FormLabel>
                            <FormDescription>
                              Clear the saved key metadata for this provider profile.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={updateMutation.isPending || !!form.watch("apiKey")}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? "Saving Settings..." : "Save Settings"}
                  </Button>
                </form>
              </Form>
            </CardContent>
            {settings && (
              <CardFooter className="bg-muted/30 border-t border-border text-xs text-muted-foreground py-3">
                Last updated {format(new Date(settings.updatedAt), "PPp")}
              </CardFooter>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
