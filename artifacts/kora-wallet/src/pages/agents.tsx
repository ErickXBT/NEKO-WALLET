import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWallet, AgentTier } from "@/hooks/use-wallet";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Cpu, Zap, Rocket, Crown } from "lucide-react";

const TIERS: { tier: AgentTier; cost: number; rate: number; icon: any; grad: string }[] = [
  { tier: "NANO", cost: 0.1, rate: 0.002, icon: Cpu, grad: "from-slate-500 to-slate-700" },
  { tier: "MICRO", cost: 1, rate: 0.02, icon: Zap, grad: "from-blue-500 to-blue-700" },
  { tier: "PRO", cost: 5, rate: 0.1, icon: Rocket, grad: "from-purple-500 to-purple-700" },
  { tier: "ELITE", cost: 50, rate: 1, icon: Crown, grad: "from-primary to-red-800" },
];

export default function Agents() {
  const [, setLocation] = useLocation();
  const { walletId, agents, solBalance, buyAgent, claimEarnings } = useWallet();
  const { toast } = useToast();
  const [, force] = useState(0);

  useEffect(() => { if (!walletId) setLocation("/"); }, [walletId, setLocation]);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  if (!walletId) return null;

  const handleBuy = (tier: AgentTier, cost: number) => {
    if (buyAgent(tier, cost)) {
      toast({ title: `Deployed ${tier} agent` });
    } else {
      toast({ title: "Insufficient KORA", variant: "destructive" });
    }
  };

  const totalEarned = agents.reduce((s, a) => s + a.earned, 0);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto w-full px-4 md:px-6 py-6 md:py-10">
        <div className="text-center mb-8 md:mb-10">
          <h1 className="text-3xl md:text-4xl font-black tracking-wider text-white">KORA AGENTS</h1>
          <p className="text-muted-foreground mt-2 max-w-xl mx-auto text-sm">
            Deploy autonomous earning agents on the KORA network. Each tier earns passive KORA every day.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {TIERS.map((t) => {
            const Icon = t.icon;
            return (
              <motion.div
                key={t.tier}
                whileHover={{ y: -4 }}
                className="relative p-5 rounded-2xl bg-card border border-border/40 hover:border-primary/30 overflow-hidden"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${t.grad} flex items-center justify-center mb-3 shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="text-lg font-black tracking-wider text-white">{t.tier}</div>
                <div className="text-xs text-muted-foreground mt-1">{t.rate} KORA / day</div>
                <div className="mt-4 text-2xl font-black text-white">{t.cost} <span className="text-xs text-primary">KORA</span></div>
                <Button
                  onClick={() => handleBuy(t.tier, t.cost)}
                  className="w-full mt-4 rounded-full font-bold tracking-wider bg-gradient-to-r from-primary to-red-800 text-white"
                >
                  DEPLOY
                </Button>
              </motion.div>
            );
          })}
        </div>

        <div className="rounded-2xl bg-card border border-primary/20 p-6">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-4">
            <div>
              <h3 className="text-lg font-black tracking-wider text-white">YOUR AGENTS</h3>
              <p className="text-xs text-muted-foreground">{agents.length} deployed · {totalEarned.toFixed(6)} KORA earned</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground tracking-widest font-bold">BALANCE</div>
                <div className="text-white font-bold">{solBalance.toFixed(4)} KORA</div>
              </div>
              <Button onClick={claimEarnings} variant="secondary" className="rounded-full font-bold tracking-wider">
                CLAIM
              </Button>
            </div>
          </div>

          {agents.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No agents deployed yet. Buy one above to start earning passively.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {agents.map((a) => {
                const tierData = TIERS.find((t) => t.tier === a.tier)!;
                const Icon = tierData.icon;
                return (
                  <div key={a.id} className="p-4 rounded-xl bg-secondary/40 border border-border/40 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${tierData.grad} flex items-center justify-center`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white">{a.tier} <span className="text-[10px] text-muted-foreground font-normal">#{a.id.slice(-4)}</span></div>
                      <div className="text-[10px] text-muted-foreground">Earned</div>
                    </div>
                    <div className="text-green-500 font-mono text-sm font-bold">{a.earned.toFixed(6)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
