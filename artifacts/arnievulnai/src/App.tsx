import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

// Page Imports
import Dashboard from "@/pages/dashboard";
import GuardDuty from "@/pages/guardduty";
import Inspector from "@/pages/inspector";
import SecurityHub from "@/pages/security-hub";
import Artifacts from "@/pages/artifacts";
import ArtifactFolder from "@/pages/artifact-folder";
import Logs from "@/pages/logs";
import ThreatIntel from "@/pages/threat-intel";
import Scans from "@/pages/scans";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/guardduty" component={GuardDuty} />
      <Route path="/inspector" component={Inspector} />
      <Route path="/security-hub" component={SecurityHub} />
      <Route path="/artifacts" component={Artifacts} />
      <Route path="/artifacts/:folder" component={ArtifactFolder} />
      <Route path="/logs" component={Logs} />
      <Route path="/threat-intel" component={ThreatIntel} />
      <Route path="/scans" component={Scans} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
