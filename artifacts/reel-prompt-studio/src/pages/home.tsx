import { useGetDashboardSummary, useListRecentActivity, useGetProviderSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Activity, AlertTriangle, ArrowRight, Film, FolderHeart, Layers, Play, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

export default function Home() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: activity, isLoading: loadingActivity } = useListRecentActivity();
  const { data: settings, isLoading: loadingSettings } = useGetProviderSettings();

  return (
    <div className="flex flex-col gap-8 h-full animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Command Center</h1>
        <p className="text-muted-foreground mt-2">Overview of your prompt generation workspace.</p>
      </div>

      {loadingSettings ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : settings ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              Demo Mode Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Real AI video analysis is not connected in this version. Demo analysis is available now
              {settings.apiKeyConfigured ? `, and your ${settings.providerName} key metadata is saved for a future provider integration` : ""}.
            </p>
            <Button asChild variant="destructive" size="sm">
              <Link href="/settings">Configure Settings <ArrowRight className="ml-2 size-4" /></Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Niches" value={summary?.nicheCount} icon={Layers} href="/niches" loading={loadingSummary} />
        <StatCard title="Prompt Packs" value={summary?.promptPackCount} icon={FolderHeart} href="/packs" loading={loadingSummary} />
        <StatCard title="Total Scenes" value={summary?.sceneCount} icon={Film} loading={loadingSummary} />
        <StatCard title="Analyses Run" value={summary?.analysisCount} icon={Activity} loading={loadingSummary} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 flex-1">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest actions in your workspace.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {loadingActivity ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : !activity || activity.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground border border-dashed border-border rounded-lg p-4">
                <Activity className="size-8 mb-2 opacity-20" />
                <p>No recent activity</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activity.map((item) => (
                  <div key={item.id} className="flex items-start gap-4 text-sm border-b border-border/50 pb-4 last:border-0">
                    <div className="mt-0.5 shrink-0">
                      {item.type === "niche" ? <Layers className="size-4 text-blue-500" /> :
                       item.type === "analysis" ? <Activity className="size-4 text-purple-500" /> :
                       <FolderHeart className="size-4 text-pink-500" />}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="font-medium leading-none text-foreground">{item.title}</p>
                      <p className="text-muted-foreground line-clamp-1">{item.detail}</p>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col border-dashed border-2 bg-transparent">
          <CardHeader>
            <CardTitle>Quick Start</CardTitle>
            <CardDescription>Jump back into your workflow.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button asChild variant="outline" className="h-auto p-4 justify-start group">
              <Link href="/niches">
                <div className="flex items-center gap-4 w-full">
                  <div className="p-2 rounded-md bg-secondary text-secondary-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Layers className="size-5" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-medium">Manage Niches</div>
                    <div className="text-xs text-muted-foreground">Define target audiences and angles</div>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="h-auto p-4 justify-start group">
              <Link href="/studio">
                <div className="flex items-center gap-4 w-full">
                  <div className="p-2 rounded-md bg-secondary text-secondary-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Film className="size-5" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-medium">Analyze a Reel</div>
                    <div className="text-xs text-muted-foreground">Extract scenes and create prompts</div>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, href, loading }: { title: string, value?: number, icon: LucideIcon, href?: string, loading?: boolean }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-3xl font-bold">{value || 0}</div>
        )}
      </CardContent>
      {href && (
        <div className="bg-muted/50 border-t border-border px-6 py-2 text-xs">
          <Link href={href} className="text-primary hover:underline inline-flex items-center gap-1 font-medium">
            View all <ArrowRight className="size-3" />
          </Link>
        </div>
      )}
    </Card>
  );
}
