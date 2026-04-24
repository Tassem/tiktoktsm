import { Link, useLocation } from "wouter";
import {
  Film,
  LayoutDashboard,
  Settings,
  Layers,
  FolderHeart,
  Shuffle,
  Bot,
  ScanLine,
  LogOut,
  ShieldCheck,
  User,
  ChevronRight,
  Zap,
  LayoutGrid,
  Wrench,
  WifiOff,
  BrainCircuit,
} from "lucide-react";
import { ReactNode } from "react";
import { useHealthCheck } from "@workspace/api-client-react";
import { useUser, useClerk, useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { AnnouncementBanners } from "@/components/announcement-banner";

const AUTH_PATHS = ["/sign-in", "/sign-up"];

function isAuthPath(path: string) {
  return AUTH_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Niches", href: "/niches", icon: Layers },
  { label: "Video to Prompt", href: "/studio", icon: Film },
  { label: "Stories", href: "/packs", icon: FolderHeart },
  { label: "Remix Studio", href: "/remix", icon: Shuffle },
  { label: "Frame Extractor", href: "/frame-extractor", icon: ScanLine },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { isSignedIn } = useAuth();
  const { data: health } = useHealthCheck();
  const { user } = useUser();
  const { signOut } = useClerk();

  const role = (user?.publicMetadata as any)?.role as string | undefined;
  const isAdmin = role === "admin";

  const { data: providerData } = useQuery<{ aiConnected?: boolean; forceDemoMode?: boolean; realAnalysisEnabled?: boolean }>({
    queryKey: ["provider-settings-status"],
    queryFn: async () => {
      const r = await fetch("/api/provider-settings", { credentials: "include" });
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const aiConnected = providerData?.aiConnected ?? false;
  const forceDemoMode = providerData?.forceDemoMode ?? false;
  const aiStatus: "connected" | "demo" | "disconnected" =
    forceDemoMode ? "demo" : aiConnected ? "connected" : "disconnected";

  if (isAuthPath(location) || !isSignedIn) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Background effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-orange-500/5 blur-[100px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-orange-600/4 blur-[80px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-blue-900/8 blur-[120px]" />
      </div>

      {/* Sidebar */}
      <aside className="relative z-20 flex flex-col w-[220px] shrink-0 border-r border-white/[0.06] bg-[hsl(222_42%_5%/0.95)] backdrop-blur-xl">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/[0.06]">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-400 shadow-lg shadow-orange-500/30">
            <Film className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-bold text-[13px] tracking-tight text-white/90">Reel Prompt</span>
            <span className="text-[10px] text-white/35 font-medium tracking-wide uppercase">Studio</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {/* Section label */}
          <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-widest text-white/25">
            Navigation
          </p>

          {navItems.map((item) => {
            const isActive = item.href === "/"
              ? location === "/"
              : location === item.href || location.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium cursor-pointer transition-all duration-150 group relative ${
                    isActive
                      ? "bg-orange-500/12 text-orange-400"
                      : "text-white/50 hover:text-white/80 hover:bg-white/[0.05]"
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-orange-400" />
                  )}
                  <item.icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? "text-orange-400" : "text-white/35 group-hover:text-white/60"
                    }`}
                  />
                  <span>{item.label}</span>
                  {isActive && (
                    <ChevronRight className="w-3 h-3 ml-auto text-orange-400/60" />
                  )}
                </div>
              </Link>
            );
          })}

          {/* Admin section */}
          {isAdmin && (
            <div className="pt-4">
              <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-widest text-orange-400/40 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Admin
              </p>
              {[
                { href: "/admin", icon: LayoutGrid, label: "لوحة التحكم" },
                { href: "/dev-agent", icon: Wrench, label: "Dev Agent" },
                { href: "/ai-systems", icon: Bot, label: "AI Systems" },
              ].map((item) => {
                const isActive = location === item.href;
                return (
                  <Link key={item.href} href={item.href}>
                    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium cursor-pointer transition-all duration-150 group relative ${
                      isActive ? "bg-orange-500/12 text-orange-400" : "text-white/50 hover:text-white/80 hover:bg-white/[0.05]"
                    }`}>
                      {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-orange-400" />}
                      <item.icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? "text-orange-400" : "text-white/35 group-hover:text-white/60"}`} />
                      <span>{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Settings */}
          <div className="pt-4">
            <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-widest text-white/25">
              Account
            </p>
            <Link href="/settings">
              <div
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium cursor-pointer transition-all duration-150 group relative ${
                  location === "/settings"
                    ? "bg-orange-500/12 text-orange-400"
                    : "text-white/50 hover:text-white/80 hover:bg-white/[0.05]"
                }`}
              >
                {location === "/settings" && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-orange-400" />
                )}
                <Settings className="w-4 h-4 shrink-0 text-white/35 group-hover:text-white/60" />
                <span>Settings</span>
              </div>
            </Link>
          </div>
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-white/[0.06] space-y-2">
          {/* User card */}
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            {user?.imageUrl ? (
              <img
                src={user.imageUrl}
                alt={user.fullName ?? "User"}
                className="w-7 h-7 rounded-full object-cover ring-1 ring-orange-400/30 shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500/30 to-amber-400/20 flex items-center justify-center ring-1 ring-orange-400/20 shrink-0">
                <User className="w-3.5 h-3.5 text-orange-300" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-white/75 truncate leading-tight">
                {user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "Member"}
              </p>
              {isAdmin ? (
                <span className="text-[10px] text-orange-400 font-semibold flex items-center gap-0.5">
                  <ShieldCheck className="w-2.5 h-2.5" /> Admin
                </span>
              ) : (
                <span className="text-[10px] text-white/30 font-medium">Member</span>
              )}
            </div>
            <button
              onClick={() => signOut()}
              className="p-1.5 rounded-md hover:bg-white/10 transition-colors shrink-0 group"
              title="Sign out"
            >
              <LogOut className="w-3 h-3 text-white/25 group-hover:text-white/60 transition-colors" />
            </button>
          </div>

          {/* API status */}
          <div className="flex items-center gap-2 px-2 text-[11px] text-white/25">
            <div className={`w-1.5 h-1.5 rounded-full ${health?.status === "ok" ? "bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400/80" : "bg-red-400"}`} />
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              API: {health?.status === "ok"
                ? <span className="text-emerald-400 font-medium">Online</span>
                : <span className="text-red-400 font-medium">Offline</span>}
            </span>
          </div>

          {/* AI status */}
          <div className={`flex items-center gap-2 px-2 text-[11px] rounded-md py-1 ${
            aiStatus === "connected" ? "text-emerald-400/70" :
            aiStatus === "demo" ? "text-amber-400/70" :
            "text-red-400/70"
          }`}>
            {aiStatus === "connected" && (
              <>
                <BrainCircuit className="w-3 h-3 shrink-0" />
                <span>AI: <span className="font-semibold text-emerald-400">متصل</span></span>
              </>
            )}
            {aiStatus === "demo" && (
              <>
                <BrainCircuit className="w-3 h-3 shrink-0 text-amber-400" />
                <span>AI: <span className="font-semibold text-amber-400">وضع ديمو</span></span>
              </>
            )}
            {aiStatus === "disconnected" && (
              <>
                <WifiOff className="w-3 h-3 shrink-0 text-red-400" />
                <span className="text-red-400/80">AI غير متصل — أضف مزوداً</span>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="relative flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Announcement banners */}
        <AnnouncementBanners />

        {/* Mobile header */}
        <header className="h-13 border-b border-white/[0.06] bg-[hsl(222_42%_5%/0.8)] backdrop-blur-xl flex items-center px-4 shrink-0 md:hidden">
          <Film className="w-5 h-5 text-orange-400 mr-3" />
          <span className="font-bold text-sm text-white/80">Reel Prompt Studio</span>
        </header>

        <div className="flex-1 overflow-auto p-6 lg:p-8">
          <div className="max-w-6xl mx-auto w-full h-full flex flex-col">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
