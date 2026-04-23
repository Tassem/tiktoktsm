import { useState } from "react";
import { useListPromptPacks, useListNiches, useDeletePromptPack, useRemixPromptPack, getListPromptPacksQueryKey, getGetDashboardSummaryQueryKey, getListRecentActivityQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, Search, Trash2, Eye, Calendar, Layers, Film, Shuffle, Video, Wand2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";

type Tab = "all" | "original" | "remix";

export default function Packs() {
  const [search, setSearch] = useState("");
  const [nicheFilter, setNicheFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<Tab>("all");

  const { data: niches } = useListNiches();
  const { data: packs, isLoading } = useListPromptPacks(nicheFilter !== "all" ? { nicheId: parseInt(nicheFilter) } : undefined);

  const filtered = packs?.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.concept.toLowerCase().includes(search.toLowerCase()) ||
      p.nicheName.toLowerCase().includes(search.toLowerCase());
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "original" && p.sourceType === "original") ||
      (activeTab === "remix" && p.sourceType === "remix");
    return matchesSearch && matchesTab;
  });

  const counts = {
    all: packs?.length ?? 0,
    original: packs?.filter((p) => p.sourceType === "original").length ?? 0,
    remix: packs?.filter((p) => p.sourceType === "remix").length ?? 0,
  };

  const tabs: { key: Tab; label: string; icon: React.ElementType; color: string }[] = [
    { key: "all", label: "الكل", icon: BookOpen, color: "text-primary" },
    { key: "original", label: "أصلية (من فيديو)", icon: Video, color: "text-blue-600" },
    { key: "remix", label: "ريمكس", icon: Wand2, color: "text-violet-600" },
  ];

  return (
    <div className="flex flex-col gap-6 h-full animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="size-8 text-primary" /> Stories
          </h1>
          <p className="text-muted-foreground mt-2">تصفح وإدارة القصص المولّدة — الأصلية من الفيديوهات والريمكس.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-xl border border-border w-fit">
        {tabs.map(({ key, label, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === key
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className={`size-4 ${activeTab === key ? color : ""}`} />
            {label}
            <span className={`text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center font-semibold ${
              activeTab === key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`}>
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* Active Tab Description */}
      {activeTab === "original" && (
        <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5" dir="rtl">
          <Video className="size-4 shrink-0" />
          القصص المستخرجة مباشرة من تحليل فيديوهات — TikTok، Instagram، YouTube
        </div>
      )}
      {activeTab === "remix" && (
        <div className="flex items-center gap-2 text-sm text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-4 py-2.5" dir="rtl">
          <Wand2 className="size-4 shrink-0" />
          قصص جديدة تم إنشاؤها بالذكاء الاصطناعي بنفس الأسلوب البصري لقصة أصلية
        </div>
      )}

      {/* Search + Niche filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="ابحث عن قصة..."
            className="pl-9 bg-card"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={nicheFilter} onValueChange={setNicheFilter}>
          <SelectTrigger className="w-full sm:w-[220px] bg-card">
            <SelectValue placeholder="كل النيتشات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل النيتشات</SelectItem>
            {niches?.map((n) => (
              <SelectItem key={n.id} value={n.id.toString()}>
                {n.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 flex-1 pb-10">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-48 flex flex-col justify-between">
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-1/4 mb-2" />
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardFooter>
                <Skeleton className="h-8 w-full" />
              </CardFooter>
            </Card>
          ))
        ) : filtered?.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-border rounded-xl bg-card/50">
            <BookOpen className="size-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium">لا توجد قصص</h3>
            <p className="text-muted-foreground mt-2 max-w-sm">
              {search || nicheFilter !== "all"
                ? "لا توجد قصص تطابق البحث أو الفلتر المحدد."
                : activeTab === "remix"
                ? "لم تقم بإنشاء أي ريمكس بعد. اضغط على أيقونة الريمكس في أي قصة أصلية."
                : "قم بتحليل فيديو في صفحة Video to Prompt لإنشاء أول قصة."}
            </p>
            {!search && nicheFilter === "all" && activeTab !== "remix" && (
              <Button variant="outline" className="mt-6" asChild>
                <Link href="/studio">انتقل إلى Video to Prompt</Link>
              </Button>
            )}
          </div>
        ) : (
          filtered?.map((pack) => (
            <Card
              key={pack.id}
              className="flex flex-col group hover:border-primary/50 transition-colors bg-card/80 hover:bg-card"
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="secondary"
                      className="bg-primary/10 text-primary hover:bg-primary/20 font-medium"
                    >
                      <Layers className="size-3 mr-1 inline" /> {pack.nicheName}
                    </Badge>
                    {pack.sourceType === "remix" ? (
                      <Badge variant="outline" className="border-violet-200 text-violet-700 bg-violet-50 text-xs">
                        <Wand2 className="size-3 mr-1 inline" /> ريمكس
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50 text-xs">
                        <Video className="size-3 mr-1 inline" /> أصلية
                      </Badge>
                    )}
                  </div>
                  <DeleteDialog packId={pack.id} packTitle={pack.title}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity -mt-1 -mr-1 shrink-0"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </DeleteDialog>
                </div>
                <CardTitle className="text-xl line-clamp-1 mt-2 leading-tight" title={pack.title}>
                  {pack.title}
                </CardTitle>
                <CardDescription className="line-clamp-2 min-h-10 text-sm mt-1">{pack.concept}</CardDescription>
              </CardHeader>

              <CardContent className="flex items-center gap-4 text-xs text-muted-foreground pb-4">
                <div className="flex items-center gap-1">
                  <Film className="size-3.5" />
                  {pack.sceneCount} مشاهد
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="size-3.5" />
                  {format(new Date(pack.createdAt), "d MMM yyyy")}
                </div>
              </CardContent>

              <CardFooter className="border-t border-border pt-4 gap-2">
                <Button className="flex-1 shadow-sm" variant="secondary" asChild>
                  <Link href={`/packs/${pack.id}`}>
                    <Eye className="mr-2 size-4" /> عرض
                  </Link>
                </Button>
                <QuickRemixDialog packId={pack.id} packTitle={pack.title}>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-9 shrink-0 text-violet-600 border-violet-200 hover:bg-violet-50 hover:border-violet-400"
                    title="Remix this pack"
                  >
                    <Shuffle className="size-4" />
                  </Button>
                </QuickRemixDialog>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function QuickRemixDialog({ packId, packTitle, children }: { packId: number; packTitle: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [storyIdea, setStoryIdea] = useState("");
  const remixMutation = useRemixPromptPack();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  function handleRemix() {
    if (storyIdea.trim().length < 10) return;
    remixMutation.mutate(
      { promptPackId: packId, data: { storyIdea: storyIdea.trim() } },
      {
        onSuccess: (newPack) => {
          queryClient.invalidateQueries({ queryKey: getListPromptPacksQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          toast({ title: "تم إنشاء الريمكس!", description: newPack.title });
          setOpen(false);
          setStoryIdea("");
          navigate(`/packs/${newPack.id}`);
        },
        onError: (err) => toast({ title: "فشل الريمكس", description: err.message, variant: "destructive" }),
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!remixMutation.isPending) {
          setOpen(o);
          if (!o) setStoryIdea("");
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shuffle className="size-5 text-primary" /> ريمكس القصة
          </DialogTitle>
          <DialogDescription>
            احتفظ بالأسلوب البصري لـ <strong>{packTitle}</strong> واكتب قصة جديدة.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor={`story-${packId}`}>
            فكرة القصة الجديدة <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id={`story-${packId}`}
            placeholder="مثلاً: فريزيتا تخون زوجها مع بنانة، تحمل معه، وزوجها يكتشف الحقيقة..."
            value={storyIdea}
            onChange={(e) => setStoryIdea(e.target.value)}
            disabled={remixMutation.isPending}
            rows={4}
            className="resize-none text-sm"
          />
          <p className="text-xs text-muted-foreground">اكتب بأي لغة — الذكاء الاصطناعي سيولّد prompts احترافية</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={remixMutation.isPending}>
            إلغاء
          </Button>
          <Button
            onClick={handleRemix}
            disabled={remixMutation.isPending || storyIdea.trim().length < 10}
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white"
          >
            {remixMutation.isPending ? (
              <>
                <div className="mr-2 size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                جاري التوليد...
              </>
            ) : (
              <>
                <Shuffle className="mr-2 size-4" /> توليد الريمكس
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ packId, packTitle, children }: { packId: number; packTitle: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const deleteMutation = useDeletePromptPack();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>حذف القصة؟</DialogTitle>
          <DialogDescription>
            هل أنت متأكد من حذف <strong>{packTitle}</strong>؟ لا يمكن التراجع عن هذا الإجراء.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            إلغاء
          </Button>
          <Button
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() => {
              deleteMutation.mutate(
                { promptPackId: packId },
                {
                  onSuccess: () => {
                    queryClient.invalidateQueries({ queryKey: getListPromptPacksQueryKey() });
                    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
                    queryClient.invalidateQueries({ queryKey: getListRecentActivityQueryKey() });
                    toast({ title: "تم حذف القصة" });
                    setOpen(false);
                  },
                  onError: () => toast({ title: "خطأ في الحذف", variant: "destructive" }),
                },
              );
            }}
          >
            {deleteMutation.isPending ? "جاري الحذف..." : "حذف"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
