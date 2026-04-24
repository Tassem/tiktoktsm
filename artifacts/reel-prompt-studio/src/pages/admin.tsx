import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSignIn } from "@clerk/react";
import {
  Users, Settings, Megaphone, ShieldCheck, User, Trash2,
  LogIn, Crown, ChevronDown, Plus, Edit2, Check, X,
  Globe, Mail, Twitter, Instagram, MessageCircle, Link2,
  Lock, Unlock, AlertTriangle, Eye, EyeOff, Image,
  ToggleLeft, ToggleRight, Save, RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Tab = "members" | "site" | "announcements";

interface ClerkUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email_addresses: { email_address: string }[];
  image_url: string | null;
  public_metadata: Record<string, any>;
  created_at: number;
}

interface SiteSettings {
  siteName: string;
  siteLocked: boolean;
  lockedMessage: string | null;
  registrationMode: string;
  inviteCode: string | null;
  contactEmail: string | null;
  contactTwitter: string | null;
  contactInstagram: string | null;
  contactWhatsapp: string | null;
  contactWebsite: string | null;
  footerText: string | null;
  announcementSliderDuration: number;
  forceDemoMode: boolean;
}

interface Announcement {
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

const emptyAnn: Omit<Announcement, "id"> = {
  title: "", content: "", variant: "info", placement: "top",
  size: "md", buttonText: "", buttonUrl: "", imageUrl: "",
  active: true, showTo: "all", sortOrder: 0,
};

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

function Badge({ role }: { role: string }) {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/20">
        <Crown className="w-2.5 h-2.5" /> Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/5 text-white/40 border border-white/10">
      <User className="w-2.5 h-2.5" /> Member
    </span>
  );
}

function MembersTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { signIn, setActive } = useSignIn();
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery<ClerkUser[]>({
    queryKey: ["admin-users", search],
    queryFn: async () => {
      const q = search ? `&q=${encodeURIComponent(search)}` : "";
      const r = await fetch(`/api/admin/users?limit=50${q}`, { credentials: "include" });
      if (!r.ok) throw new Error("فشل جلب الأعضاء");
      return r.json();
    },
    staleTime: 10_000,
  });

  const roleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const r = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!r.ok) throw new Error("فشل تغيير الدور");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "تم تغيير الدور بنجاح" });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const r = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE", credentials: "include",
      });
      if (!r.ok) throw new Error("فشل حذف العضو");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setConfirmDelete(null);
      toast({ title: "تم حذف العضو" });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  async function handleImpersonate(userId: string) {
    try {
      const r = await fetch(`/api/admin/users/${userId}/impersonate`, {
        method: "POST", credentials: "include",
      });
      if (!r.ok) throw new Error("فشل إنشاء جلسة الانتحال");
      const { token } = await r.json();
      if (!signIn || !setActive) throw new Error("Clerk غير جاهز");
      const result = await signIn.create({ strategy: "ticket" as any, ticket: token } as any);
      await setActive({ session: result.createdSessionId! });
      toast({ title: "تم الدخول كعضو" });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو الإيميل..."
          className="flex-1 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/25 focus:outline-none focus:border-orange-400/40"
        />
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ["admin-users"] })}
          className="p-2 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
        >
          <RefreshCw className="w-4 h-4 text-white/50" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {(users ?? []).map((u) => {
            const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || "—";
            const email = u.email_addresses?.[0]?.email_address ?? "—";
            const role = u.public_metadata?.role ?? "member";
            return (
              <GlassCard key={u.id} className="flex items-center gap-3 p-3">
                {u.image_url ? (
                  <img src={u.image_url} alt={name} className="w-9 h-9 rounded-full object-cover ring-1 ring-white/10 shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-white/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white/80 truncate">{name}</span>
                    <Badge role={role} />
                  </div>
                  <p className="text-xs text-white/35 truncate">{email}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => roleMutation.mutate({ userId: u.id, role: role === "admin" ? "member" : "admin" })}
                    className={`p-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      role === "admin"
                        ? "border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20"
                        : "border-white/10 bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/60"
                    }`}
                    title={role === "admin" ? "تنزيل إلى عضو" : "ترقية إلى مشرف"}
                  >
                    <Crown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleImpersonate(u.id)}
                    className="p-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-white/40 hover:text-white/70 transition-colors"
                    title="الدخول كهذا العضو"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                  </button>
                  {confirmDelete === u.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => deleteMutation.mutate(u.id)}
                        className="p-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="p-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-white/40 hover:bg-white/[0.08]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(u.id)}
                      className="p-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-red-500/10 hover:border-red-500/20 text-white/30 hover:text-red-400 transition-colors"
                      title="حذف العضو"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </GlassCard>
            );
          })}
          {users?.length === 0 && (
            <p className="text-center py-8 text-white/30 text-sm">لا يوجد أعضاء</p>
          )}
        </div>
      )}
    </div>
  );
}

function SiteSettingsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<SiteSettings>({
    queryKey: ["admin-site-settings"],
    queryFn: async () => {
      const r = await fetch("/api/admin/site-settings", { credentials: "include" });
      if (!r.ok) throw new Error("فشل جلب الإعدادات");
      return r.json();
    },
  });

  const [form, setForm] = useState<Partial<SiteSettings>>({});
  const current = { ...data, ...form } as SiteSettings;

  function set(key: keyof SiteSettings, val: any) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/admin/site-settings", {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(current),
      });
      if (!r.ok) throw new Error("فشل الحفظ");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-site-settings"] });
      qc.invalidateQueries({ queryKey: ["public-site-settings"] });
      setForm({});
      toast({ title: "تم حفظ الإعدادات" });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <GlassCard className="p-5 space-y-5">
        <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2">
          <Globe className="w-4 h-4 text-orange-400" /> الموقع العام
        </h3>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-white/40">اسم الموقع</label>
          <input
            value={current.siteName ?? ""}
            onChange={(e) => set("siteName", e.target.value)}
            className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-orange-400/40"
          />
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
          <div>
            <p className="text-sm font-medium text-white/70 flex items-center gap-2">
              {current.siteLocked ? <Lock className="w-4 h-4 text-red-400" /> : <Unlock className="w-4 h-4 text-emerald-400" />}
              {current.siteLocked ? "الموقع مقفول" : "الموقع مفتوح"}
            </p>
            <p className="text-xs text-white/30 mt-0.5">عند القفل، لا يستطيع الأعضاء الدخول</p>
          </div>
          <button
            onClick={() => set("siteLocked", !current.siteLocked)}
            className={`w-11 h-6 rounded-full transition-all relative ${current.siteLocked ? "bg-red-500" : "bg-emerald-500"}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${current.siteLocked ? "right-1" : "left-1"}`} />
          </button>
        </div>

        {current.siteLocked && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-white/40">رسالة القفل</label>
            <input
              value={current.lockedMessage ?? ""}
              onChange={(e) => set("lockedMessage", e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-orange-400/40"
            />
          </div>
        )}

        <div className={`flex items-center justify-between p-3 rounded-lg border transition-all ${current.forceDemoMode ? "bg-amber-500/8 border-amber-500/30" : "bg-white/[0.03] border-white/[0.06]"}`}>
          <div>
            <p className="text-sm font-medium text-white/70 flex items-center gap-2">
              {current.forceDemoMode
                ? <><span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" /> وضع الديمو مُفعَّل</>
                : <><span className="inline-block w-2 h-2 rounded-full bg-emerald-400" /> وضع الذكاء الاصطناعي الحقيقي</>
              }
            </p>
            <p className="text-xs text-white/30 mt-0.5">
              {current.forceDemoMode
                ? "جميع التحليلات تستخدم بيانات تجريبية — مفيد للاختبار"
                : "التحليلات تستخدم الذكاء الاصطناعي الفعلي عند توفر المزود"}
            </p>
          </div>
          <button
            onClick={() => set("forceDemoMode", !current.forceDemoMode)}
            className={`w-11 h-6 rounded-full transition-all relative ${current.forceDemoMode ? "bg-amber-500" : "bg-emerald-500"}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${current.forceDemoMode ? "right-1" : "left-1"}`} />
          </button>
        </div>
      </GlassCard>

      <GlassCard className="p-5 space-y-5">
        <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2">
          <Users className="w-4 h-4 text-orange-400" /> التسجيل
        </h3>
        <div className="space-y-2">
          {[
            { value: "open", label: "مفتوح", desc: "يستطيع الجميع التسجيل" },
            { value: "closed", label: "مغلق", desc: "لا يُسمح بالتسجيل الجديد" },
            { value: "invite", label: "بكود دعوة", desc: "فقط من لديه الكود يستطيع التسجيل" },
          ].map((opt) => (
            <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
              current.registrationMode === opt.value
                ? "border-orange-400/30 bg-orange-500/8"
                : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
            }`}>
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                current.registrationMode === opt.value ? "border-orange-400" : "border-white/20"
              }`}>
                {current.registrationMode === opt.value && <div className="w-2 h-2 rounded-full bg-orange-400" />}
              </div>
              <input
                type="radio"
                className="hidden"
                checked={current.registrationMode === opt.value}
                onChange={() => set("registrationMode", opt.value)}
              />
              <div>
                <p className="text-sm font-medium text-white/75">{opt.label}</p>
                <p className="text-xs text-white/30">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>

        {current.registrationMode === "invite" && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-white/40">كود الدعوة</label>
            <input
              value={current.inviteCode ?? ""}
              onChange={(e) => set("inviteCode", e.target.value)}
              placeholder="مثال: REEL2025"
              className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 font-mono focus:outline-none focus:border-orange-400/40"
            />
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2">
          <Link2 className="w-4 h-4 text-orange-400" /> روابط التواصل
        </h3>
        {[
          { key: "contactEmail" as const, icon: <Mail className="w-3.5 h-3.5" />, label: "البريد الإلكتروني", placeholder: "contact@example.com" },
          { key: "contactTwitter" as const, icon: <Twitter className="w-3.5 h-3.5" />, label: "تويتر / X", placeholder: "https://x.com/..." },
          { key: "contactInstagram" as const, icon: <Instagram className="w-3.5 h-3.5" />, label: "إنستغرام", placeholder: "https://instagram.com/..." },
          { key: "contactWhatsapp" as const, icon: <MessageCircle className="w-3.5 h-3.5" />, label: "واتساب", placeholder: "+212 6..." },
          { key: "contactWebsite" as const, icon: <Globe className="w-3.5 h-3.5" />, label: "الموقع الرسمي", placeholder: "https://..." },
        ].map(({ key, icon, label, placeholder }) => (
          <div key={key} className="flex items-center gap-3">
            <span className="text-white/30 shrink-0">{icon}</span>
            <div className="flex-1 space-y-0.5">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-white/30">{label}</label>
              <input
                value={(current as any)[key] ?? ""}
                onChange={(e) => set(key, e.target.value)}
                placeholder={placeholder}
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70 focus:outline-none focus:border-orange-400/40"
              />
            </div>
          </div>
        ))}
      </GlassCard>

      <GlassCard className="p-5 space-y-3">
        <h3 className="text-sm font-semibold text-white/70">نص الفوتر</h3>
        <textarea
          value={current.footerText ?? ""}
          onChange={(e) => set("footerText", e.target.value)}
          rows={2}
          placeholder="© 2025 Reel Prompt Studio — جميع الحقوق محفوظة"
          className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/70 resize-none focus:outline-none focus:border-orange-400/40"
        />
      </GlassCard>

      <GlassCard className="p-5 space-y-3">
        <h3 className="text-sm font-semibold text-white/70">سلايدر الإعلانات</h3>
        <p className="text-xs text-white/40">مدة عرض كل إعلان صوري قبل الانتقال للتالي</p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={60}
            value={current.announcementSliderDuration ?? 5}
            onChange={(e) => set("announcementSliderDuration", Math.max(1, Math.min(60, Number(e.target.value))))}
            className="w-20 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-orange-400/40 text-center"
          />
          <span className="text-sm text-white/50">ثانية</span>
          <div className="flex gap-1 ml-2">
            {[3, 5, 7, 10].map((s) => (
              <button
                key={s}
                onClick={() => set("announcementSliderDuration", s)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  current.announcementSliderDuration === s
                    ? "bg-orange-500/30 text-orange-300 border border-orange-500/30"
                    : "bg-white/[0.04] text-white/40 border border-white/10 hover:bg-white/[0.08]"
                }`}
              >
                {s}ث
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      <button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="w-full py-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-400 text-white text-sm font-semibold hover:from-orange-600 hover:to-amber-500 transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
      >
        {saveMutation.isPending ? (
          <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        ) : (
          <><Save className="w-4 h-4" /> حفظ الإعدادات</>
        )}
      </button>
    </div>
  );
}

const VARIANT_OPTIONS = [
  { value: "info", label: "معلوماتي (أزرق)", color: "bg-blue-500" },
  { value: "warning", label: "تحذيري (برتقالي)", color: "bg-amber-500" },
  { value: "success", label: "نجاح (أخضر)", color: "bg-emerald-500" },
  { value: "error", label: "خطأ (أحمر)", color: "bg-red-500" },
  { value: "orange", label: "إعلان (برتقالي)", color: "bg-orange-500" },
];

const PLACEMENT_OPTIONS = [
  { value: "top", label: "شريط علوي" },
  { value: "bottom", label: "شريط سفلي" },
];

const SIZE_OPTIONS = [
  { value: "sm", label: "صغير" },
  { value: "md", label: "متوسط" },
  { value: "lg", label: "كبير" },
];

const SHOW_TO_OPTIONS = [
  { value: "all", label: "الكل" },
  { value: "members", label: "الأعضاء فقط" },
  { value: "admins", label: "المشرفون فقط" },
];

function AnnouncementForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial: Omit<Announcement, "id">;
  onSave: (data: Omit<Announcement, "id">) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState({ ...initial });
  function set(k: keyof typeof form, v: any) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <div className="space-y-4 p-4 rounded-xl border border-orange-400/20 bg-orange-500/5">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-white/40">العنوان (اختياري)</label>
          <input
            value={form.title ?? ""}
            onChange={(e) => set("title", e.target.value)}
            placeholder="عنوان الإعلان"
            className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-orange-400/40"
          />
        </div>
        <div className="col-span-2 space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
            المحتوى {!form.imageUrl && <span className="text-red-400">*</span>}
            {form.imageUrl && <span className="text-white/30 normal-case">(اختياري عند وجود صورة)</span>}
          </label>
          <textarea
            value={form.content ?? ""}
            onChange={(e) => set("content", e.target.value || null)}
            rows={2}
            placeholder={form.imageUrl ? "اتركه فارغاً إذا كانت الصورة كافية..." : "نص الإعلان..."}
            className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 resize-none focus:outline-none focus:border-orange-400/40"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-white/40">النوع</label>
          <select
            value={form.variant}
            onChange={(e) => set("variant", e.target.value)}
            className="w-full bg-[#0e1524] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-orange-400/40"
          >
            {VARIANT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-white/40">المكان</label>
          <select
            value={form.placement}
            onChange={(e) => set("placement", e.target.value)}
            className="w-full bg-[#0e1524] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-orange-400/40"
          >
            {PLACEMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-white/40">الحجم</label>
          <select
            value={form.size}
            onChange={(e) => set("size", e.target.value)}
            className="w-full bg-[#0e1524] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-orange-400/40"
          >
            {SIZE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-white/40">يُعرض لـ</label>
          <select
            value={form.showTo}
            onChange={(e) => set("showTo", e.target.value)}
            className="w-full bg-[#0e1524] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-orange-400/40"
          >
            {SHOW_TO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-white/40">نص الزر (اختياري)</label>
          <input
            value={form.buttonText ?? ""}
            onChange={(e) => set("buttonText", e.target.value)}
            placeholder="اضغط هنا"
            className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-orange-400/40"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-white/40">رابط الزر</label>
          <input
            value={form.buttonUrl ?? ""}
            onChange={(e) => set("buttonUrl", e.target.value)}
            placeholder="https://..."
            className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-orange-400/40"
          />
        </div>
        <div className="col-span-2 space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-white/40 flex items-center gap-1"><Image className="w-3 h-3" /> رابط الصورة (اختياري)</label>
          <input
            value={form.imageUrl ?? ""}
            onChange={(e) => set("imageUrl", e.target.value)}
            placeholder="https://..."
            className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-orange-400/40"
          />
          {form.imageUrl && (
            <img src={form.imageUrl} alt="" className="mt-1 w-16 h-16 rounded-lg object-cover border border-white/10" />
          )}
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-white/40">الترتيب</label>
          <input
            type="number"
            value={form.sortOrder}
            onChange={(e) => set("sortOrder", Number(e.target.value))}
            className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-orange-400/40"
          />
        </div>
        <div className="flex items-end gap-2">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-white/40 block mb-1">نشط؟</label>
          <button
            type="button"
            onClick={() => set("active", !form.active)}
            className={`w-10 h-6 rounded-full transition-all relative ${form.active ? "bg-emerald-500" : "bg-white/20"}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${form.active ? "right-1" : "left-1"}`} />
          </button>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave(form)}
          disabled={isSaving || (!form.content && !form.imageUrl)}
          className="flex-1 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-400 text-white text-sm font-semibold hover:from-orange-600 hover:to-amber-500 transition-all flex items-center justify-center gap-2"
        >
          {isSaving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <><Check className="w-4 h-4" /> حفظ</>}
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-white/10 bg-white/[0.04] text-sm text-white/50 hover:bg-white/[0.08]">
          إلغاء
        </button>
      </div>
    </div>
  );
}

function AnnouncementsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const { data: announcements, isLoading } = useQuery<Announcement[]>({
    queryKey: ["admin-announcements"],
    queryFn: async () => {
      const r = await fetch("/api/admin/announcements", { credentials: "include" });
      if (!r.ok) throw new Error("فشل جلب الإعلانات");
      return r.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Omit<Announcement, "id">) => {
      const r = await fetch("/api/admin/announcements", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("فشل الإنشاء");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
      qc.invalidateQueries({ queryKey: ["announcements-active"] });
      setShowForm(false);
      toast({ title: "تم إنشاء الإعلان" });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Announcement> }) => {
      const r = await fetch(`/api/admin/announcements/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("فشل التحديث");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
      qc.invalidateQueries({ queryKey: ["announcements-active"] });
      setEditId(null);
      toast({ title: "تم تحديث الإعلان" });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/admin/announcements/${id}`, {
        method: "DELETE", credentials: "include",
      });
      if (!r.ok) throw new Error("فشل الحذف");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
      qc.invalidateQueries({ queryKey: ["announcements-active"] });
      toast({ title: "تم حذف الإعلان" });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const variantDot: Record<string, string> = {
    info: "bg-blue-400",
    warning: "bg-amber-400",
    success: "bg-emerald-400",
    error: "bg-red-400",
    orange: "bg-orange-400",
  };

  return (
    <div className="space-y-4">
      <button
        onClick={() => setShowForm(true)}
        className="w-full py-2.5 rounded-lg border border-dashed border-orange-400/30 bg-orange-500/5 text-orange-400 text-sm font-medium hover:bg-orange-500/10 transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" /> إضافة إعلان جديد
      </button>

      {showForm && (
        <AnnouncementForm
          initial={emptyAnn}
          onSave={(data) => createMutation.mutate(data)}
          onCancel={() => setShowForm(false)}
          isSaving={createMutation.isPending}
        />
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {(announcements ?? []).map((ann) => (
            <div key={ann.id}>
              {editId === ann.id ? (
                <AnnouncementForm
                  initial={ann}
                  onSave={(data) => updateMutation.mutate({ id: ann.id, data })}
                  onCancel={() => setEditId(null)}
                  isSaving={updateMutation.isPending}
                />
              ) : (
                <GlassCard className="p-3 flex items-start gap-3">
                  <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${variantDot[ann.variant] ?? "bg-white/30"}`} />
                  <div className="flex-1 min-w-0">
                    {ann.title && <p className="text-sm font-semibold text-white/80">{ann.title}</p>}
                    {ann.content && <p className="text-sm text-white/55 leading-snug">{ann.content}</p>}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[10px] text-white/25 bg-white/5 px-1.5 py-0.5 rounded">{ann.placement}</span>
                      <span className="text-[10px] text-white/25 bg-white/5 px-1.5 py-0.5 rounded">{ann.size}</span>
                      <span className="text-[10px] text-white/25 bg-white/5 px-1.5 py-0.5 rounded">{ann.showTo}</span>
                      {ann.imageUrl && <span className="text-[10px] text-white/25 flex items-center gap-0.5"><Image className="w-2.5 h-2.5" /> صورة</span>}
                      {ann.buttonText && <span className="text-[10px] text-white/25 flex items-center gap-0.5">🔗 {ann.buttonText}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => updateMutation.mutate({ id: ann.id, data: { active: !ann.active } })}
                      className={`p-1.5 rounded-lg border transition-colors ${ann.active ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-white/10 bg-white/[0.04] text-white/30"}`}
                      title={ann.active ? "إخفاء" : "إظهار"}
                    >
                      {ann.active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => setEditId(ann.id)}
                      className="p-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-white/40 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(ann.id)}
                      className="p-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-red-500/10 hover:border-red-500/20 text-white/30 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </GlassCard>
              )}
            </div>
          ))}
          {announcements?.length === 0 && !showForm && (
            <p className="text-center py-8 text-white/30 text-sm">لا توجد إعلانات</p>
          )}
        </div>
      )}
    </div>
  );
}

const TABS: { id: Tab; label: string; icon: JSX.Element }[] = [
  { id: "members", label: "الأعضاء", icon: <Users className="w-4 h-4" /> },
  { id: "site", label: "إعدادات الموقع", icon: <Settings className="w-4 h-4" /> },
  { id: "announcements", label: "الإعلانات", icon: <Megaphone className="w-4 h-4" /> },
];

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>("members");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-400/10 flex items-center justify-center border border-orange-400/20">
          <ShieldCheck className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white/90 tracking-tight">لوحة التحكم</h1>
          <p className="text-sm text-white/35">إدارة الأعضاء والموقع والإعلانات</p>
        </div>
      </div>

      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? "bg-orange-500/15 text-orange-400 border border-orange-400/20"
                : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="max-w-2xl">
        {tab === "members" && <MembersTab />}
        {tab === "site" && <SiteSettingsTab />}
        {tab === "announcements" && <AnnouncementsTab />}
      </div>
    </div>
  );
}
