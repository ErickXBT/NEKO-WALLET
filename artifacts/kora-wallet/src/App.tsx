import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "@/hooks/WalletProvider";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Wallet from "@/pages/wallet";
import Trade from "@/pages/trade";
import Card from "@/pages/card";
import News from "@/pages/news";
import Markets from "@/pages/markets";
import CoinDetail from "@/pages/coin-detail";
import Activity from "@/pages/activity";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/wallet" component={Wallet} />
      <Route path="/trade" component={Trade} />
      <Route path="/card" component={Card} />
      <Route path="/news" component={News} />
      <Route path="/markets" component={Markets} />
      <Route path="/coin/:id" component={CoinDetail} />
      <Route path="/activity" component={Activity} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </WalletProvider>
    </QueryClientProvider>
  );
}

export default App;
