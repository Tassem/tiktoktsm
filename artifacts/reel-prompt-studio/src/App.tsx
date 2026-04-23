import React, { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient, useQuery } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, useClerk, useUser, useAuth } from "@clerk/react";
import { shadcn } from "@clerk/themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";
import NotFound from "@/pages/not-found";

import Home from "@/pages/home";
import Niches from "@/pages/niches";
import Studio from "@/pages/studio";
import Packs from "@/pages/packs";
import PackDetail from "@/pages/pack-detail";
import RemixStudio from "@/pages/remix-studio";
import Settings from "@/pages/settings";
import AiSystems from "@/pages/ai-systems";
import FrameExtractor from "@/pages/frame-extractor";
import AdminPanel from "@/pages/admin";
import DevAgent from "@/pages/dev-agent";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL as string | undefined;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#f97316",
    colorForeground: "#f0f2f5",
    colorMutedForeground: "#6b7a8d",
    colorDanger: "#ef4444",
    colorBackground: "#080d18",
    colorInput: "#0e1524",
    colorInputForeground: "#e8ecf0",
    colorNeutral: "#1a2236",
    colorModalBackdrop: "rgba(0,0,0,0.7)",
    fontFamily: "'Inter', sans-serif",
    borderRadius: "0.625rem",
  },
  elements: {
    rootBox: "flex justify-center w-full",
    cardBox: "rounded-2xl w-[420px] max-w-full overflow-hidden shadow-2xl shadow-black/50 border border-white/[0.07]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-white/90 font-bold text-xl tracking-tight",
    headerSubtitle: "text-white/40 text-sm",
    socialButtonsBlockButtonText: "text-white/70 font-medium text-sm",
    formFieldLabel: "text-white/60 text-xs font-semibold uppercase tracking-wide",
    footerActionLink: "text-orange-400 hover:text-orange-300 font-semibold",
    footerActionText: "text-white/35",
    dividerText: "text-white/25 text-xs",
    identityPreviewEditButton: "text-orange-400",
    formFieldSuccessText: "text-emerald-400 text-xs",
    alertText: "text-white/70 text-sm",
    logoBox: "flex justify-center",
    logoImage: "h-10 w-10",
    socialButtonsBlockButton: "border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] transition-colors",
    formButtonPrimary: "bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-600 hover:to-amber-500 text-white font-semibold shadow-lg shadow-orange-500/25 transition-all",
    formFieldInput: "bg-white/[0.05] border-white/[0.08] text-white/90 placeholder:text-white/20 focus:border-orange-400/50",
    footerAction: "border-t border-white/[0.06]",
    dividerLine: "bg-white/[0.08]",
    alert: "bg-red-500/10 border-red-500/20",
    otpCodeFieldInput: "border-white/[0.10] bg-white/[0.04]",
    formFieldRow: "gap-3",
    main: "p-7",
  },
};

function SiteLocked({ message }: { message?: string | null }) {
  const { signOut } = useClerk();
  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4" style={{ background: "hsl(222 45% 4%)" }}>
      <div className="text-center max-w-sm space-y-4">
        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <h2 className="text-xl font-bold text-white/80">الموقع مغلق مؤقتاً</h2>
        <p className="text-white/40 text-sm">{message || "الموقع مغلق مؤقتاً، يرجى المحاولة لاحقاً"}</p>
        <button onClick={() => signOut()} className="text-sm text-orange-400 underline hover:text-orange-300">تسجيل الخروج</button>
      </div>
    </div>
  );
}

function AuthPageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-4"
      style={{ background: "hsl(222 45% 4%)" }}>
      {/* Background glow effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[400px] rounded-full bg-orange-500/8 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[350px] rounded-full bg-blue-900/10 blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(hsl(222 25% 14%) 1px, transparent 1px), linear-gradient(90deg, hsl(222 25% 14%) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Logo header */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shadow-lg shadow-orange-500/30">
          <svg viewBox="0 0 24 24" fill="none" className="w-4.5 h-4.5 text-white" stroke="currentColor" strokeWidth="2.5">
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
        </div>
        <span className="font-bold text-white/80 text-[15px] tracking-tight">Reel Prompt Studio</span>
      </div>

      {children}
    </div>
  );
}

function SignInPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <AuthPageWrapper>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </AuthPageWrapper>
  );
}

function SignUpPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  const [inviteInput, setInviteInput] = React.useState("");
  const [inviteOk, setInviteOk] = React.useState<boolean | null>(null);
  const [checking, setChecking] = React.useState(false);
  const qc = useQueryClient();

  const { data: siteSettings, isLoading } = useQuery<{ registrationMode: string }>({
    queryKey: ["public-site-settings-signup"],
    queryFn: async () => {
      const r = await fetch("/api/public/site-settings");
      if (!r.ok) return { registrationMode: "open" };
      return r.json();
    },
    staleTime: 30_000,
  });

  const mode = siteSettings?.registrationMode ?? "open";

  async function checkInvite() {
    setChecking(true);
    try {
      const r = await fetch("/api/public/validate-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: inviteInput }),
      });
      const { valid } = await r.json();
      setInviteOk(Boolean(valid));
    } catch {
      setInviteOk(false);
    } finally {
      setChecking(false);
    }
  }

  return (
    <AuthPageWrapper>
      {isLoading ? (
        <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      ) : mode === "closed" ? (
        <div className="w-[420px] max-w-full rounded-2xl border border-white/[0.07] bg-[#0e1524]/80 backdrop-blur p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <h2 className="text-lg font-bold text-white/80">التسجيل مغلق</h2>
          <p className="text-white/40 text-sm">عذراً، التسجيل متوقف حالياً</p>
          <a href={`${basePath}/sign-in`} className="text-sm text-orange-400 underline">الدخول لحساب موجود</a>
        </div>
      ) : mode === "invite" && !inviteOk ? (
        <div className="w-[420px] max-w-full rounded-2xl border border-white/[0.07] bg-[#0e1524]/80 backdrop-blur p-8 space-y-5">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-400/20 flex items-center justify-center mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <h2 className="text-lg font-bold text-white/80">التسجيل بكود الدعوة</h2>
            <p className="text-white/40 text-sm">أدخل كود الدعوة للمتابعة</p>
          </div>
          <div className="space-y-2">
            <input
              value={inviteInput}
              onChange={(e) => { setInviteInput(e.target.value); setInviteOk(null); }}
              placeholder="أدخل الكود..."
              className={`w-full bg-white/[0.05] border rounded-lg px-4 py-3 text-sm text-center font-mono text-white/90 focus:outline-none tracking-widest uppercase ${inviteOk === false ? "border-red-500/40" : "border-white/[0.08] focus:border-orange-400/50"}`}
            />
            {inviteOk === false && <p className="text-xs text-red-400 text-center">كود غير صحيح</p>}
          </div>
          <button
            onClick={checkInvite}
            disabled={!inviteInput || checking}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-400 text-white text-sm font-semibold hover:from-orange-600 hover:to-amber-500 transition-all flex items-center justify-center gap-2"
          >
            {checking ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : "متابعة"}
          </button>
          <p className="text-center text-sm text-white/30">لديك حساب؟ <a href={`${basePath}/sign-in`} className="text-orange-400">سجّل دخول</a></p>
        </div>
      ) : (
        <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      )}
    </AuthPageWrapper>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [, setLocation] = useLocation();

  const { data: siteSettings } = useQuery<{ siteLocked: boolean; lockedMessage: string | null }>({
    queryKey: ["public-site-settings"],
    queryFn: async () => {
      const r = await fetch("/api/public/site-settings");
      if (!r.ok) return { siteLocked: false, lockedMessage: null };
      return r.json();
    },
    staleTime: 30_000,
    enabled: isSignedIn === true,
  });

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setLocation("/sign-in", { replace: true });
    }
  }, [isLoaded, isSignedIn, setLocation]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!isSignedIn) return null;

  const isAdmin = (user?.publicMetadata as any)?.role === "admin";
  if (siteSettings?.siteLocked && !isAdmin) {
    return <SiteLocked message={siteSettings.lockedMessage} />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoaded) {
      const role = (user?.publicMetadata as any)?.role;
      if (role !== "admin") setLocation("/", { replace: true });
    }
  }, [isLoaded, user, setLocation]);

  if (!isLoaded) return null;
  const role = (user?.publicMetadata as any)?.role;
  if (role !== "admin") return null;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/">
          <RequireAuth><Home /></RequireAuth>
        </Route>
        <Route path="/niches">
          <RequireAuth><Niches /></RequireAuth>
        </Route>
        <Route path="/studio">
          <RequireAuth><Studio /></RequireAuth>
        </Route>
        <Route path="/packs">
          <RequireAuth><Packs /></RequireAuth>
        </Route>
        <Route path="/packs/:id">
          {() => <RequireAuth><PackDetail /></RequireAuth>}
        </Route>
        <Route path="/remix">
          <RequireAuth><RemixStudio /></RequireAuth>
        </Route>
        <Route path="/frame-extractor">
          <RequireAuth><FrameExtractor /></RequireAuth>
        </Route>
        <Route path="/ai-systems">
          <RequireAuth><AdminRoute><AiSystems /></AdminRoute></RequireAuth>
        </Route>
        <Route path="/admin">
          <RequireAuth><AdminRoute><AdminPanel /></AdminRoute></RequireAuth>
        </Route>
        <Route path="/dev-agent">
          <RequireAuth><AdminRoute><DevAgent /></AdminRoute></RequireAuth>
        </Route>
        <Route path="/settings">
          <RequireAuth><Settings /></RequireAuth>
        </Route>
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function ClerkSetup() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "مرحباً بعودتك 👋",
            subtitle: "سجّل دخولك إلى Reel Prompt Studio",
          },
        },
        signUp: {
          start: {
            title: "إنشاء حساب جديد",
            subtitle: "انضم إلى Reel Prompt Studio",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <ClerkQueryClientCacheInvalidator />
      <AppRoutes />
    </ClerkProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <ClerkSetup />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
