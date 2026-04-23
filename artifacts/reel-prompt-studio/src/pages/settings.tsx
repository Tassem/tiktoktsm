import { useState, useEffect } from "react";
import { useUser } from "@clerk/react";
import {
  Settings as SettingsIcon,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Zap,
  Globe,
  Link2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Info,
  Bot,
  ShieldCheck,
  Lock,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Separator } from "@/components/ui/separator";

// ─── Types ───────────────────────────────────────────────────────────────────

type ProviderModel = {
  id: number;
  providerId: number;
  modelId: string;
  label: string;
  capabilities: string;
  isActive: boolean;
  sortOrder: number;
};

type Provider = {
  id: number;
  type: "openrouter" | "custom";
  name: string;
  baseUrl: string;
  apiKey: string;
  isActive: boolean;
  sortOrder: number;
  models: ProviderModel[];
};

type ServiceAssignment = {
  key: string;
  label: string;
  description: string;
  assignedModelId: number | null;
  assignedModel: {
    id: number;
    modelId: string;
    label: string;
    providerName: string;
    providerType: string;
  } | null;
};

type AvailableModel = {
  id: number;
  modelId: string;
  label: string;
  capabilities: string;
  providerId: number;
  providerName: string;
  providerType: string;
};

// ─── API helpers ─────────────────────────────────────────────────────────────

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, { credentials: "include", ...opts });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// Popular OpenRouter models to suggest
const OPENROUTER_SUGGESTIONS = [
  { modelId: "openai/gpt-4o", label: "GPT-4o (OpenAI)", capabilities: "analysis,vision" },
  { modelId: "openai/gpt-4o-mini", label: "GPT-4o Mini (OpenAI)", capabilities: "analysis" },
  { modelId: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet (Anthropic)", capabilities: "analysis,vision" },
  { modelId: "anthropic/claude-3-haiku", label: "Claude 3 Haiku (Anthropic)", capabilities: "analysis" },
  { modelId: "google/gemini-2.0-flash-exp", label: "Gemini 2.0 Flash (Google)", capabilities: "analysis,vision" },
  { modelId: "google/gemini-pro-1.5", label: "Gemini 1.5 Pro (Google)", capabilities: "analysis,vision" },
  { modelId: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B (Meta)", capabilities: "analysis" },
  { modelId: "qwen/qwen-2.5-72b-instruct", label: "Qwen 2.5 72B (Alibaba)", capabilities: "analysis" },
  { modelId: "deepseek/deepseek-r1", label: "DeepSeek R1", capabilities: "analysis" },
  { modelId: "mistralai/mistral-large", label: "Mistral Large", capabilities: "analysis" },
];

const CAPABILITY_LABELS: Record<string, string> = {
  analysis: "تحليل النصوص",
  vision: "رؤية الصور/الفيديو",
  images: "توليد الصور",
};

// ─── Model Form ───────────────────────────────────────────────────────────────

function AddModelForm({
  providerId,
  providerType,
  onAdded,
  onCancel,
}: {
  providerId: number;
  providerType: "openrouter" | "custom";
  onAdded: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [modelId, setModelId] = useState("");
  const [label, setLabel] = useState("");
  const [capabilities, setCapabilities] = useState("analysis");
  const [selectedSuggestion, setSelectedSuggestion] = useState<string>("");

  const addMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/ai-providers/${providerId}/models`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: modelId.trim(), label: label.trim() || modelId.trim(), capabilities }),
      }),
    onSuccess: () => {
      toast({ title: "✅ تم إضافة الموديل" });
      onAdded();
    },
    onError: (err) => toast({ title: "خطأ", description: err.message, variant: "destructive" }),
  });

  function applySuggestion(sug: typeof OPENROUTER_SUGGESTIONS[0]) {
    setModelId(sug.modelId);
    setLabel(sug.label);
    setCapabilities(sug.capabilities);
    setSelectedSuggestion(sug.modelId);
  }

  return (
    <div className="border border-dashed border-border rounded-lg p-4 space-y-3 bg-muted/20">
      {providerType === "openrouter" && (
        <div>
          <p className="text-xs text-muted-foreground mb-2 font-medium">اختر من الموديلات الشهيرة:</p>
          <div className="flex flex-wrap gap-1.5">
            {OPENROUTER_SUGGESTIONS.map((sug) => (
              <button
                key={sug.modelId}
                onClick={() => applySuggestion(sug)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  selectedSuggestion === sug.modelId
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:border-primary/50 hover:bg-accent"
                }`}
              >
                {sug.label.split("(")[0].trim()}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">معرّف الموديل (Model ID)</label>
          <Input
            placeholder={providerType === "openrouter" ? "openai/gpt-4o" : "gpt-4o"}
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className="font-mono text-sm h-8"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">الاسم المعروض</label>
          <Input
            placeholder="GPT-4o — تحليل الفيديو"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="text-sm h-8"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">القدرات</label>
        <div className="flex flex-wrap gap-3">
          {["analysis", "vision", "images"].map((cap) => (
            <label key={cap} className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={capabilities.split(",").includes(cap)}
                onChange={(e) => {
                  const caps = capabilities.split(",").filter(Boolean);
                  if (e.target.checked) {
                    setCapabilities([...caps, cap].join(","));
                  } else {
                    setCapabilities(caps.filter((c) => c !== cap).join(",") || "analysis");
                  }
                }}
                className="rounded"
              />
              {CAPABILITY_LABELS[cap]}
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => addMutation.mutate()}
          disabled={addMutation.isPending || !modelId.trim()}
          className="h-7"
        >
          <Plus className="size-3 mr-1" />
          إضافة
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} className="h-7">
          إلغاء
        </Button>
      </div>
    </div>
  );
}

// ─── Provider Card ────────────────────────────────────────────────────────────

function ProviderCard({ provider, onRefresh }: { provider: Provider; onRefresh: () => void }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(true);
  const [showAddModel, setShowAddModel] = useState(false);
  const [editingKey, setEditingKey] = useState(false);
  const [newKey, setNewKey] = useState("");

  const updateProvider = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiFetch(`/api/ai-providers/${provider.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({ title: "✅ تم التحديث" });
      setEditingKey(false);
      setNewKey("");
      onRefresh();
    },
    onError: (err) => toast({ title: "خطأ", description: err.message, variant: "destructive" }),
  });

  const deleteProvider = useMutation({
    mutationFn: () => apiFetch(`/api/ai-providers/${provider.id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "🗑️ تم حذف المزود" }); onRefresh(); },
    onError: (err) => toast({ title: "خطأ", description: err.message, variant: "destructive" }),
  });

  const deleteModel = useMutation({
    mutationFn: (modelId: number) =>
      apiFetch(`/api/ai-providers/models/${modelId}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "🗑️ تم حذف الموديل" }); onRefresh(); },
    onError: (err) => toast({ title: "خطأ", description: err.message, variant: "destructive" }),
  });

  const typeColor = provider.type === "openrouter"
    ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
    : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";

  return (
    <Card className={!provider.isActive ? "opacity-60" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColor}`}>
              {provider.type === "openrouter" ? "🌐 OpenRouter" : "🔧 Custom AI"}
            </span>
            <span className="font-semibold text-sm">{provider.name}</span>
            <Badge variant="outline" className="text-xs">{provider.models.length} موديل</Badge>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Switch
              checked={provider.isActive}
              onCheckedChange={(v) => updateProvider.mutate({ isActive: v })}
              className="scale-75"
            />
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setExpanded((e) => !e)}>
              {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </Button>
            <Button
              variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={() => deleteProvider.mutate()} disabled={deleteProvider.isPending}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
          <Globe className="size-3 shrink-0" />
          <span className="font-mono truncate">{provider.baseUrl}</span>
        </div>

        <div className="flex items-center gap-2 text-xs mt-1">
          {editingKey ? (
            <div className="flex gap-2 flex-1">
              <Input
                type="password"
                placeholder="المفتاح الجديد..."
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="h-7 text-xs font-mono flex-1"
              />
              <Button size="sm" className="h-7 text-xs"
                onClick={() => updateProvider.mutate({ apiKey: newKey })}
                disabled={!newKey.trim() || updateProvider.isPending}
              >
                <Check className="size-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs"
                onClick={() => { setEditingKey(false); setNewKey(""); }}
              >
                <X className="size-3" />
              </Button>
            </div>
          ) : (
            <>
              <span className="font-mono text-muted-foreground">{provider.apiKey}</span>
              <Button variant="ghost" size="sm" className="h-6 text-xs px-1.5" onClick={() => setEditingKey(true)}>
                <Edit3 className="size-3 mr-1" /> تغيير المفتاح
              </Button>
            </>
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-2">
          <Separator />
          {provider.models.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">
              لا توجد موديلات — أضف موديلاً للبدء
            </p>
          ) : (
            <div className="space-y-1.5">
              {provider.models.map((model) => (
                <div key={model.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-muted/40 border border-border/40"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{model.label}</span>
                      {model.capabilities.split(",").filter(Boolean).map((cap) => (
                        <span key={cap} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                          {CAPABILITY_LABELS[cap] ?? cap}
                        </span>
                      ))}
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">{model.modelId}</span>
                  </div>
                  <Button
                    variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive shrink-0"
                    onClick={() => deleteModel.mutate(model.id)} disabled={deleteModel.isPending}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {showAddModel ? (
            <AddModelForm
              providerId={provider.id}
              providerType={provider.type}
              onAdded={() => { setShowAddModel(false); onRefresh(); }}
              onCancel={() => setShowAddModel(false)}
            />
          ) : (
            <Button variant="outline" size="sm" className="w-full h-8 text-xs border-dashed"
              onClick={() => setShowAddModel(true)}
            >
              <Plus className="size-3 mr-1" /> إضافة موديل
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Add Provider Form ────────────────────────────────────────────────────────

function AddProviderForm({
  type,
  onAdded,
  onCancel,
}: {
  type: "openrouter" | "custom";
  onAdded: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(type === "openrouter" ? "OpenRouter" : "");
  const [baseUrl, setBaseUrl] = useState(type === "openrouter" ? "https://openrouter.ai/api/v1" : "");
  const [apiKey, setApiKey] = useState("");

  const addMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/ai-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name: name.trim(), baseUrl: baseUrl.trim(), apiKey: apiKey.trim() }),
      }),
    onSuccess: () => { toast({ title: "✅ تم إضافة المزود" }); onAdded(); },
    onError: (err) => toast({ title: "خطأ", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="border border-dashed border-border rounded-lg p-4 space-y-3 bg-muted/20">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium">اسم المزود</label>
          <Input
            placeholder={type === "openrouter" ? "OpenRouter" : "مزود مخصص"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Base URL</label>
          <Input
            placeholder="https://openrouter.ai/api/v1"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="h-8 text-sm font-mono"
            readOnly={type === "openrouter"}
          />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium flex items-center gap-2">
          API Key
          {type === "openrouter" && (
            <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer"
              className="text-primary hover:underline text-xs font-normal"
            >
              احصل عليه من openrouter.ai/keys ↗
            </a>
          )}
        </label>
        <Input
          type="password"
          placeholder={type === "openrouter" ? "sk-or-v1-..." : "sk-..."}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="h-8 text-sm font-mono"
        />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => addMutation.mutate()}
          disabled={addMutation.isPending || !name.trim() || !baseUrl.trim() || !apiKey.trim()}
          className="h-7"
        >
          <Plus className="size-3 mr-1" /> إضافة
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} className="h-7">إلغاء</Button>
      </div>
    </div>
  );
}

// ─── Service Assignments ──────────────────────────────────────────────────────

function ServiceAssignmentsCard({
  services,
  availableModels,
  onSaved,
}: {
  services: ServiceAssignment[];
  availableModels: AvailableModel[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<Record<string, number | null>>({});

  useEffect(() => {
    const initial: Record<string, number | null> = {};
    for (const svc of services) initial[svc.key] = svc.assignedModelId;
    setAssignments(initial);
  }, [services]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/ai-service-assignments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignments: Object.entries(assignments).map(([serviceName, modelId]) => ({ serviceName, modelId })),
        }),
      }),
    onSuccess: () => { toast({ title: "✅ تم حفظ تعيينات الخدمات" }); onSaved(); },
    onError: (err) => toast({ title: "خطأ", description: err.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="size-4 text-primary" />
          ربط الخدمات بالموديلات
        </CardTitle>
        <CardDescription>
          اختر الموديل المستخدم لكل خدمة من خدمات الذكاء الاصطناعي في الموقع
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {availableModels.length === 0 ? (
          <Alert>
            <Info className="size-4" />
            <AlertTitle>لا توجد موديلات متاحة</AlertTitle>
            <AlertDescription>
              أضف مزود ذكاء اصطناعي وموديلاته أولاً حتى تتمكن من ربط الخدمات
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {services.map((svc) => (
              <div key={svc.key} className="space-y-1.5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">{svc.label}</p>
                    <p className="text-xs text-muted-foreground">{svc.description}</p>
                  </div>
                  {assignments[svc.key] ? (
                    <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300 shrink-0">
                      <CheckCircle2 className="size-3 mr-1" /> مربوط
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground shrink-0">
                      <AlertTriangle className="size-3 mr-1" /> غير مربوط
                    </Badge>
                  )}
                </div>
                <Select
                  value={assignments[svc.key]?.toString() ?? "none"}
                  onValueChange={(v) =>
                    setAssignments((a) => ({ ...a, [svc.key]: v === "none" ? null : parseInt(v) }))
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="اختر موديلاً..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— بدون تعيين (يستخدم الافتراضي) —</SelectItem>
                    {availableModels.map((m) => (
                      <SelectItem key={m.id} value={m.id.toString()}>
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {m.providerType === "openrouter" ? "🌐" : "🔧"} {m.providerName}
                          </span>
                          <span>{m.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Per-service guidance hints */}
                {svc.key === "image-generation" && (
                  <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2 text-xs text-blue-800 dark:text-blue-300 space-y-0.5">
                    <p className="font-semibold">🖼️ موديلات مدعومة لتوليد الصور:</p>
                    <p>• <span className="font-mono">openai/dall-e-3</span> — عبر OpenRouter</p>
                    <p>• <span className="font-mono">fal-ai/flux/schnell</span> أو <span className="font-mono">fal-ai/flux-pro/v1.1</span> — أضف مزود Custom بـ URL: <span className="font-mono">https://fal.run</span></p>
                  </div>
                )}
                {svc.key === "video-generation" && (
                  <div className="rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 px-3 py-2 text-xs text-rose-800 dark:text-rose-300 space-y-0.5">
                    <p className="font-semibold">🎬 موديلات مدعومة لتوليد الفيديو:</p>
                    <p>• <span className="font-mono">fal-ai/veo3</span> أو <span className="font-mono">fal-ai/kling-video/v1.6/standard/image-to-video</span></p>
                    <p>• أضف مزود Custom بـ URL: <span className="font-mono">https://fal.run</span> ومفتاح fal.ai</p>
                  </div>
                )}
              </div>
            ))}

            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="w-full mt-2"
            >
              {saveMutation.isPending ? (
                <><RefreshCw className="size-4 mr-2 animate-spin" /> جاري الحفظ...</>
              ) : (
                <><Check className="size-4 mr-2" /> حفظ التعيينات</>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────

export default function Settings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, isLoaded: userLoaded } = useUser();
  const isAdmin = (user?.publicMetadata as any)?.role === "admin";
  const [bootstrapping, setBootstrapping] = useState(false);
  const [showAddOpenRouter, setShowAddOpenRouter] = useState(false);
  const [showAddCustom, setShowAddCustom] = useState(false);

  async function handleBootstrap() {
    setBootstrapping(true);
    try {
      const res = await fetch("/api/admin/bootstrap", { method: "POST" });
      const data = await res.json() as { ok?: boolean; message?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "فشل التفعيل");
      toast({ title: "تم تفعيل المشرف", description: data.message });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setBootstrapping(false);
    }
  }

  const providersQuery = useQuery<{ providers: Provider[] }>({
    queryKey: ["ai-providers"],
    queryFn: () => apiFetch("/api/ai-providers"),
  });

  const assignmentsQuery = useQuery<{ services: ServiceAssignment[]; availableModels: AvailableModel[] }>({
    queryKey: ["ai-service-assignments"],
    queryFn: () => apiFetch("/api/ai-service-assignments"),
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["ai-providers"] });
    queryClient.invalidateQueries({ queryKey: ["ai-service-assignments"] });
  }

  const providers = providersQuery.data?.providers ?? [];
  const openRouterProviders = providers.filter((p) => p.type === "openrouter");
  const customProviders = providers.filter((p) => p.type === "custom");
  const services = assignmentsQuery.data?.services ?? [];
  const availableModels = assignmentsQuery.data?.availableModels ?? [];

  const isLoading = providersQuery.isLoading || assignmentsQuery.isLoading;
  const isError = providersQuery.isError || assignmentsQuery.isError;

  return (
    <div className="flex flex-col gap-6 h-full max-w-3xl mx-auto w-full animate-in fade-in duration-500 pb-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <SettingsIcon className="size-8 text-primary" />
          إعدادات الذكاء الاصطناعي
        </h1>
        <p className="text-muted-foreground mt-2">
          أضف مزودي الذكاء الاصطناعي وموديلاتهم، ثم اربطها بخدمات الموقع
        </p>
      </div>

      {/* ── Admin Bootstrap Banner ── */}
      {userLoaded && !isAdmin && (
        <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-800/50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <Lock className="size-4" />
              تفعيل صلاحيات المشرف
            </CardTitle>
            <CardDescription className="text-amber-700/80 dark:text-amber-400/70 text-sm" dir="rtl">
              للوصول إلى AI Systems Editor وDev Agent ولوحة التحكم، تحتاج إلى تفعيل دور المشرف.
              إذا كنت أول مستخدم، اضغط الزر أدناه لتفعيل حسابك.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              size="sm"
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white border-0"
              onClick={handleBootstrap}
              disabled={bootstrapping}
            >
              {bootstrapping
                ? <div className="size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                : <ShieldCheck className="size-3.5" />
              }
              {bootstrapping ? "جارٍ التفعيل..." : "تفعيل كمشرف"}
            </Button>
          </CardContent>
        </Card>
      )}

      {userLoaded && isAdmin && (
        <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 px-1">
          <ShieldCheck className="size-4" />
          <span>مسجّل كمشرف — لديك صلاحية الوصول الكاملة</span>
        </div>
      )}

      {isError && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>خطأ في تحميل الإعدادات</AlertTitle>
          <AlertDescription>
            تأكد أن لديك صلاحيات مسؤول للوصول لهذه الصفحة
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-60 w-full" />
        </div>
      ) : (
        <>
          {/* ── OpenRouter Section ── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Zap className="size-5 text-violet-500" />
                  OpenRouter
                </h2>
                <p className="text-xs text-muted-foreground">
                  وصول موحد لمئات من موديلات الذكاء الاصطناعي عبر API واحد
                </p>
              </div>
              <Button variant="outline" size="sm" className="h-8 text-xs"
                onClick={() => setShowAddOpenRouter(true)}
              >
                <Plus className="size-3 mr-1" /> إضافة OpenRouter
              </Button>
            </div>

            {showAddOpenRouter && (
              <AddProviderForm
                type="openrouter"
                onAdded={() => { setShowAddOpenRouter(false); refresh(); }}
                onCancel={() => setShowAddOpenRouter(false)}
              />
            )}

            {openRouterProviders.length === 0 && !showAddOpenRouter ? (
              <div className="border border-dashed border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
                <Bot className="size-8 mx-auto mb-2 opacity-40" />
                <p>لم تتم إضافة أي مزود OpenRouter بعد</p>
                <p className="text-xs mt-1">
                  احصل على مفتاحك من{" "}
                  <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    openrouter.ai/keys ↗
                  </a>
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {openRouterProviders.map((p) => (
                  <ProviderCard key={p.id} provider={p} onRefresh={refresh} />
                ))}
              </div>
            )}
          </section>

          <Separator />

          {/* ── Custom AI Section ── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Globe className="size-5 text-blue-500" />
                  AI مخصص
                </h2>
                <p className="text-xs text-muted-foreground">
                  أي endpoint متوافق مع OpenAI API (base URL + API Key)
                </p>
              </div>
              <Button variant="outline" size="sm" className="h-8 text-xs"
                onClick={() => setShowAddCustom(true)}
              >
                <Plus className="size-3 mr-1" /> إضافة مزود مخصص
              </Button>
            </div>

            {showAddCustom && (
              <AddProviderForm
                type="custom"
                onAdded={() => { setShowAddCustom(false); refresh(); }}
                onCancel={() => setShowAddCustom(false)}
              />
            )}

            {customProviders.length === 0 && !showAddCustom ? (
              <div className="border border-dashed border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
                <Globe className="size-8 mx-auto mb-2 opacity-40" />
                <p>لم تتم إضافة أي مزود مخصص</p>
                <p className="text-xs mt-1">
                  يمكنك إضافة أي خدمة متوافقة مع OpenAI API — Groq، Together AI، Ollama...
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {customProviders.map((p) => (
                  <ProviderCard key={p.id} provider={p} onRefresh={refresh} />
                ))}
              </div>
            )}
          </section>

          <Separator />

          {/* ── Service Assignments Section ── */}
          <section>
            <ServiceAssignmentsCard
              services={services}
              availableModels={availableModels}
              onSaved={refresh}
            />
          </section>
        </>
      )}
    </div>
  );
}
