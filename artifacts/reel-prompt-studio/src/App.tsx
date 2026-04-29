import React from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function AppRoutes() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/niches" component={Niches} />
        <Route path="/studio" component={Studio} />
        <Route path="/packs" component={Packs} />
        <Route path="/packs/:id">
          {() => <PackDetail />}
        </Route>
        <Route path="/remix" component={RemixStudio} />
        <Route path="/frame-extractor" component={FrameExtractor} />
        <Route path="/ai-systems" component={AiSystems} />
        <Route path="/admin" component={AdminPanel} />
        <Route path="/dev-agent" component={DevAgent} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <AppRoutes />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
