import { useState, useRef, useEffect } from "react";
import { useUser } from "@clerk/react";
import { Send, Paperclip, X, Bot, User, Film, Shuffle, Loader2, Download, ChevronDown, Trash2, Copy, Check, FolderOpen, Search, Layers } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useListPromptPacks, useGetPromptPack, getGetPromptPackQueryKey } from "@workspace/api-client-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: string[];
  timestamp: Date;
}

const SYSTEM_OPTIONS = [
  { key: "video-analysis", label: "Video to Prompt", icon: Film, color: "text-blue-400" },
  { key: "story-remix", label: "Remix Studio", icon: Shuffle, color: "text-purple-400" },
];

function MessageBubble({ msg }: { msg: Message }) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === "user";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-1 ${
        isUser ? "bg-orange-500/20 border border-orange-500/30" : "bg-blue-500/20 border border-blue-500/30"
      }`}>
        {isUser
          ? <User className="w-3.5 h-3.5 text-orange-400" />
          : <Bot className="w-3.5 h-3.5 text-blue-400" />
        }
      </div>
      <div className={`flex-1 max-w-[85%] space-y-2 ${isUser ? "items-end flex flex-col" : ""}`}>
        {msg.images && msg.images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {msg.images.map((img, i) => (
              <img key={i} src={img} alt="" className="max-h-40 rounded-lg border border-white/10 object-contain bg-black/20" />
            ))}
          </div>
        )}
        <div className={`relative group rounded-xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-orange-500/10 border border-orange-500/20 text-orange-100/90"
            : "bg-white/[0.04] border border-white/[0.07] text-white/80"
        }`}>
          <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
          {!isUser && (
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-white/5 hover:bg-white/10"
            >
              {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-white/40" />}
            </button>
          )}
        </div>
        <p className="text-[10px] text-white/20 px-1">
          {msg.timestamp.toLocaleTimeString("ar-MA", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

function formatPackAsContext(pack: any): string {
  const lines: string[] = [
    `══════════════════════════════════════`,
    `PACK: ${pack.title}`,
    `Concept: ${pack.concept}`,
    `Niche: ${pack.nicheName ?? "—"}`,
    `Scenes: ${pack.sceneCount ?? pack.scenes?.length ?? 0}`,
    `══════════════════════════════════════`,
  ];
  if (pack.summaryPrompt) {
    lines.push(`\nSUMMARY PROMPT:\n${pack.summaryPrompt}`);
  }
  if (pack.scenes?.length) {
    lines.push("\n─── SCENES ───");
    for (const s of pack.scenes) {
      lines.push(`\n[Scene ${s.sceneNumber}] ${s.title} (${s.sceneType})`);
      lines.push(`Image Prompt: ${s.imagePrompt}`);
      lines.push(`Animation: ${s.animationPrompt}`);
      lines.push(`Voice (Darija): ${s.voiceOverDarija}`);
      lines.push(`SFX: ${s.soundEffectsPrompt}`);
    }
  }
  return lines.join("\n");
}

export default function DevAgent() {
  const { user } = useUser();
  const role = (user?.publicMetadata as any)?.role as string | undefined;
  const isAdmin = role === "admin";
  const { toast } = useToast();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `مرحباً! أنا مساعدك التطويري لنظام Reel Prompt Studio.\n\nأستطيع مساعدتك في:\n🔍 تحليل مخرجات Video to Prompt ومقارنتها بالفيديو الأصلي\n⚠️ تشخيص المشاكل في دقة وصف الشخصيات والمشاهد\n✅ اقتراح تحسينات محددة على البرومت\n🔧 مقارنة نتيجتين وإيجاد الفروقات\n\nأرسل لي صورة أو فيديو أو اشرح المشكلة وسأساعدك.`,
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [selectedSystem, setSelectedSystem] = useState<string>("video-analysis");
  const [previousOutput, setPreviousOutput] = useState("");
  const [showContext, setShowContext] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const [selectedPackId, setSelectedPackId] = useState<number | null>(null);
  const [packSearch, setPackSearch] = useState("");
  const [showPackPicker, setShowPackPicker] = useState(false);

  const { data: packs, isLoading: packsLoading } = useListPromptPacks(undefined, {
    query: { enabled: showContext },
  });

  const { data: packDetail } = useGetPromptPack(selectedPackId ?? 0, {
    query: {
      enabled: selectedPackId !== null,
      queryKey: getGetPromptPackQueryKey(selectedPackId ?? 0),
    },
  });

  useEffect(() => {
    if (packDetail) {
      setPreviousOutput(formatPackAsContext(packDetail));
    }
  }, [packDetail]);

  const filteredPacks = (packs ?? []).filter((p) =>
    p.title.toLowerCase().includes(packSearch.toLowerCase()) ||
    (p.nicheName ?? "").toLowerCase().includes(packSearch.toLowerCase())
  );

  const selectedPack = (packs ?? []).find((p) => p.id === selectedPackId);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-white/40">هذه الصفحة خاصة بالمشرفين فقط</p>
      </div>
    );
  }

  const extractVideoFrames = (file: File, count = 10): Promise<string[]> =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.src = url;
      video.muted = true;
      video.playsInline = true;
      video.preload = "metadata";

      video.onloadedmetadata = async () => {
        const duration = video.duration;
        if (!duration || duration === Infinity) {
          URL.revokeObjectURL(url);
          reject(new Error("لا يمكن قراءة مدة الفيديو"));
          return;
        }

        const actualCount = Math.min(count, 10 - pendingImages.length);
        const frames: string[] = [];

        const captureAt = (t: number): Promise<string> =>
          new Promise((res, rej) => {
            video.currentTime = t;
            video.onseeked = () => {
              const canvas = document.createElement("canvas");
              const scale = Math.min(1, 960 / (video.videoWidth || 640));
              canvas.width = Math.round((video.videoWidth || 640) * scale);
              canvas.height = Math.round((video.videoHeight || 360) * scale);
              const ctx = canvas.getContext("2d");
              if (!ctx) { rej(new Error("canvas")); return; }
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              res(canvas.toDataURL("image/jpeg", 0.82));
            };
          });

        try {
          for (let i = 0; i < actualCount; i++) {
            const t = (duration / (actualCount + 1)) * (i + 1);
            const frame = await captureAt(Math.min(t, duration - 0.1));
            frames.push(frame);
          }
          URL.revokeObjectURL(url);
          resolve(frames);
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(e);
        }
      };

      video.onerror = () => { URL.revokeObjectURL(url); reject(new Error("فشل تحميل الفيديو")); };
      video.load();
    });

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(async (file) => {
      try {
        if (file.type.startsWith("video/")) {
          const available = 10 - pendingImages.length;
          if (available <= 0) {
            toast({ title: "الحد الأقصى", description: "وصلت إلى الحد الأقصى (10 فريمات)", variant: "destructive" });
            return;
          }
          toast({ title: "جارٍ استخراج الفريمات...", description: file.name });
          const frames = await extractVideoFrames(file, Math.min(10, available));
          setPendingImages((prev) => [...prev, ...frames]);
          toast({ title: `تم استخراج ${frames.length} فريمات`, description: "موزعة على طول الفيديو" });
        } else {
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result as string;
            if (result) setPendingImages((prev) => [...prev, result]);
          };
          reader.readAsDataURL(file);
        }
      } catch (err: any) {
        toast({ title: "خطأ", description: err.message ?? `فشل معالجة: ${file.name}`, variant: "destructive" });
      }
    });
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const imageItems = Array.from(items).filter((item) => item.type.startsWith("image/"));
    imageItems.forEach((item) => {
      const file = item.getAsFile();
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const result = ev.target?.result as string;
          if (result) setPendingImages((prev) => [...prev, result]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const sendMessage = async () => {
    if (!input.trim() && pendingImages.length === 0) return;
    if (isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim() || "(صورة/مرفق)",
      images: pendingImages.length > 0 ? [...pendingImages] : undefined,
      timestamp: new Date(),
    };

    const history = messages
      .filter((m) => m.id !== "welcome")
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setPendingImages([]);
    setIsLoading(true);

    try {
      const r = await fetch("/api/admin/dev-agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg.content,
          images: userMsg.images,
          history,
          systemKey: selectedSystem,
          previousOutput: previousOutput.trim() || undefined,
        }),
      });

      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "فشل الاتصال");

      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: data.reply, timestamp: new Date() },
      ]);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const downloadProject = async () => {
    setIsDownloading(true);
    try {
      const r = await fetch("/api/admin/download-project");
      if (!r.ok) throw new Error("فشل التحميل");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "reel-prompt-studio.zip";
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "تم", description: "تم تحميل المشروع بنجاح" });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const selectedSystemInfo = SYSTEM_OPTIONS.find((s) => s.key === selectedSystem);

  return (
    <div className="flex flex-col h-full max-h-screen overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/30 to-purple-500/30 border border-blue-400/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white/90">Dev Agent</h1>
            <p className="text-[11px] text-white/35">مساعد تطوير الذكاء الاصطناعي — للمشرفين فقط</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMessages([{
              id: "welcome", role: "assistant",
              content: "تم مسح المحادثة. كيف يمكنني مساعدتك؟",
              timestamp: new Date()
            }])}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-white/40 hover:text-white/60 text-xs transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            مسح
          </button>
          <button
            onClick={downloadProject}
            disabled={isDownloading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-300 hover:bg-orange-500/15 text-xs font-medium transition-colors"
          >
            {isDownloading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Download className="w-3.5 h-3.5" />
            }
            تحميل المشروع
          </button>
        </div>
      </div>

      {/* Context panel */}
      <div className="px-4 py-2 border-b border-white/[0.04] bg-white/[0.01] shrink-0">
        <button
          onClick={() => setShowContext((p) => !p)}
          className="flex items-center gap-2 text-xs text-white/40 hover:text-white/60 transition-colors w-full"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showContext ? "rotate-180" : ""}`} />
          سياق التحليل
          <span className="text-orange-400/60">{selectedSystemInfo?.label}</span>
          {selectedPack && (
            <span className="ml-auto flex items-center gap-1 text-blue-400/70 text-[10px]">
              <FolderOpen className="w-3 h-3" />
              {selectedPack.title}
            </span>
          )}
        </button>

        {showContext && (
          <div className="mt-3 space-y-3">
            {/* System selector */}
            <div className="flex gap-2">
              {SYSTEM_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSelectedSystem(opt.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    selectedSystem === opt.key
                      ? "bg-orange-500/15 border-orange-500/30 text-orange-300"
                      : "border-white/10 bg-white/[0.03] text-white/40 hover:bg-white/[0.06]"
                  }`}
                >
                  <opt.icon className={`w-3.5 h-3.5 ${opt.color}`} />
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Pack selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase tracking-wide text-white/30 flex items-center gap-1">
                  <FolderOpen className="w-3 h-3" />
                  اختر Pack من Video to Prompt
                </label>
                {selectedPackId && (
                  <button
                    onClick={() => { setSelectedPackId(null); setPreviousOutput(""); }}
                    className="text-[10px] text-white/30 hover:text-red-400 transition-colors flex items-center gap-0.5"
                  >
                    <X className="w-2.5 h-2.5" /> إلغاء
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowPackPicker((p) => !p)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all text-left ${
                  selectedPackId
                    ? "bg-blue-500/10 border-blue-500/20 text-blue-300"
                    : "bg-white/[0.03] border-white/10 text-white/40 hover:bg-white/[0.06]"
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1 truncate">
                  {selectedPack ? selectedPack.title : "اختر pack لتحميل محتواه تلقائياً..."}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${showPackPicker ? "rotate-180" : ""}`} />
              </button>

              {showPackPicker && (
                <div className="border border-white/10 rounded-lg bg-[hsl(222_42%_4%)] overflow-hidden">
                  <div className="p-2 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2 bg-white/[0.04] rounded-md px-2 py-1.5">
                      <Search className="w-3 h-3 text-white/30 shrink-0" />
                      <input
                        value={packSearch}
                        onChange={(e) => setPackSearch(e.target.value)}
                        placeholder="ابحث عن pack..."
                        className="flex-1 bg-transparent text-xs text-white/60 focus:outline-none placeholder:text-white/25"
                        style={{ direction: "rtl" }}
                      />
                    </div>
                  </div>
                  <div className="max-h-44 overflow-y-auto">
                    {packsLoading ? (
                      <div className="flex items-center justify-center py-4 text-white/30 text-xs gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ التحميل...
                      </div>
                    ) : filteredPacks.length === 0 ? (
                      <p className="text-center py-4 text-white/25 text-xs">لا توجد packs</p>
                    ) : (
                      filteredPacks.map((pack) => {
                        const isSelected = pack.id === selectedPackId;
                        return (
                          <button
                            key={pack.id}
                            onClick={() => {
                              setSelectedPackId(isSelected ? null : pack.id);
                              if (isSelected) setPreviousOutput("");
                              setShowPackPicker(false);
                            }}
                            className={`w-full flex items-start gap-2.5 px-3 py-2.5 border-b border-white/[0.04] last:border-0 text-left transition-colors ${
                              isSelected
                                ? "bg-blue-500/10 text-blue-300"
                                : "text-white/60 hover:bg-white/[0.04]"
                            }`}
                          >
                            <Layers className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-400/60" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{pack.title}</p>
                              <p className="text-[10px] text-white/30 mt-0.5">
                                {pack.nicheName ?? "—"} • {(pack as any).sceneCount ?? 0} scenes
                              </p>
                            </div>
                            {isSelected && <Check className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {selectedPackId && !packDetail && (
                <div className="flex items-center gap-2 text-[10px] text-white/30 px-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> جارٍ تحميل محتوى الـ pack...
                </div>
              )}
              {selectedPackId && packDetail && (
                <p className="text-[10px] text-blue-400/60 px-1 flex items-center gap-1">
                  <Check className="w-3 h-3" /> تم تحميل {(packDetail as any).scenes?.length ?? 0} مشهد في السياق
                </p>
              )}
            </div>

            {/* Manual previous output */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wide text-white/30">
                أو الصق الناتج يدوياً (اختياري)
              </label>
              <textarea
                value={previousOutput}
                onChange={(e) => setPreviousOutput(e.target.value)}
                rows={3}
                placeholder="الصق هنا نتيجة Video to Prompt السابقة لمقارنتها..."
                className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs text-white/60 resize-none focus:outline-none focus:border-orange-400/40 font-mono"
              />
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0 mt-1">
              <Bot className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3">
              <div className="flex gap-1.5 items-center">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400/60 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t border-white/[0.06] bg-[hsl(222_42%_5%/0.8)] shrink-0">
        {pendingImages.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {pendingImages.map((img, i) => (
              <div key={i} className="relative">
                <img src={img} alt="" className="h-16 w-16 rounded-lg object-cover border border-white/10" />
                <button
                  onClick={() => setPendingImages((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2 items-end">
          <button
            onClick={() => fileRef.current?.click()}
            className="shrink-0 w-9 h-9 rounded-lg border border-white/10 bg-white/[0.04] flex items-center justify-center text-white/40 hover:text-white/60 hover:bg-white/[0.07] transition-colors"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="صف المشكلة أو الصق نصاً أو أرفق صورة... (Enter للإرسال، Shift+Enter لسطر جديد)"
            rows={1}
            className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/80 resize-none focus:outline-none focus:border-orange-400/30 placeholder:text-white/25 min-h-[40px] max-h-32 overflow-y-auto"
            style={{ direction: "rtl" }}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || (!input.trim() && pendingImages.length === 0)}
            className="shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-white/20 text-center mt-2">
          يمكنك لصق الصور مباشرة في حقل النص • تحليل موصول بـ {selectedSystemInfo?.label}
        </p>
      </div>
    </div>
  );
}
