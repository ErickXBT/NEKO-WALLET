import { useEffect } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWallet } from "@/hooks/use-wallet";
import { motion } from "framer-motion";
import { Coins, TrendingUp, Wallet, ChevronRight } from "lucide-react";

const SECTIONS = [
  { icon: Coins, title: "AGENTS", desc: "Deploy passive earning agents on the KORA network", route: "/agents", grad: "from-amber-500 to-amber-700" },
  { icon: TrendingUp, title: "TRADE", desc: "Quick swap KORA into the top 100 cryptocurrencies", route: "/trade", grad: "from-primary to-red-800" },
  { icon: Wallet, title: "WALLET", desc: "Manage balances, send and receive tokens", route: "/wallet", grad: "from-purple-500 to-purple-800" },
];

export default function Portal() {
  const [, setLocation] = useLocation();
  const { walletId } = useWallet();
  useEffect(() => { if (!walletId) setLocation("/"); }, [walletId, setLocation]);
  if (!walletId) return null;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto w-full px-4 md:px-6 py-8 md:py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-black tracking-wider text-white">KORA PORTAL</h1>
          <p className="text-muted-foreground mt-3">Your gateway to the entire KORA ecosystem</p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {SECTIONS.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.button
                key={s.title}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                whileHover={{ y: -6 }}
                onClick={() => setLocation(s.route)}
                className="group relative p-6 rounded-2xl bg-card border border-border/40 hover:border-primary/40 transition-all text-left overflow-hidden"
              >
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.grad} flex items-center justify-center mb-4 shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-black tracking-wider text-white">{s.title}</h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{s.desc}</p>
                <div className="flex items-center gap-1 text-primary text-[10px] font-bold tracking-widest mt-4 group-hover:gap-2 transition-all">
                  ENTER <ChevronRight className="w-3 h-3" />
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
