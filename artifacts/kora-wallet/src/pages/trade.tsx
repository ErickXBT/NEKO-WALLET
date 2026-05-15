import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/use-wallet";
import { useTopCoins } from "@/hooks/use-coingecko";
import { useSolanaBalance } from "@/hooks/use-solana-balance";
import { DepositModal } from "@/components/modals/DepositModal";
import { SendModal } from "@/components/modals/SendModal";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { SwapModal } from "@/components/modals/SwapModal";
import { DexTrending } from "@/components/DexTrending";
import {
  Settings, ArrowDownLeft, ArrowUpRight, RefreshCw,
  Copy, ArrowUpDown, Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ─── main page ────────────────────────────────────────────────────────────────

export default function Trade() {
  const [, setLocation] = useLocation();
  const { walletId, address, solBalance, holdings } = useWallet();
  const { data: coins } = useTopCoins();
  const { data: chainSOL, isLoading: balanceLoading, refetch: refetchBalance } = useSolanaBalance(address);
  const { toast } = useToast();
  const solPrice = coins?.find(c => c.id === "solana")?.current_price ?? 0;
  const realSOL = chainSOL ?? 0;
  const holdingsUSD = Object.entries(holdings).reduce((sum, [coinId, amount]) => {
    const coin = coins?.find(c => c.id === coinId);
    return sum + amount * (coin?.current_price ?? 0);
  }, 0);
  const totalUSD = realSOL * solPrice + holdingsUSD;

  const [depositOpen, setDepositOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!walletId) setLocation("/");
  }, [walletId, setLocation]);

  if (!walletId) return null;

  const handleDexSelect = useCallback((_addr: string, _chain: string, meta: any) => {
    toast({ title: `${meta.symbol} selected — open Swap to trade it` });
    setSwapOpen(true);
  }, [toast]);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto w-full px-4 md:px-6 py-6 md:py-8">

        {/* Page header */}
        <div className="flex items-start justify-between mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-wider text-white">TRADE</h1>
            <p className="text-xs text-muted-foreground mt-1">@{walletId.toLowerCase()}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setSettings(true)} className="rounded-full border-border/40">
              <Settings className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={() => setLocation("/")} className="hidden sm:flex rounded-full border-border/40 text-xs font-bold tracking-wider">
              DISCONNECT
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Balance card */}
          <div>
            <div className="text-[10px] text-muted-foreground tracking-widest font-bold mb-2">WALLET</div>
            <div
              className="relative p-6 rounded-2xl bg-gradient-to-br from-card to-secondary/30 border border-primary/20 overflow-hidden"
              style={{ boxShadow: "0 0 40px rgba(225,243,17,0.08)" }}
            >
              <div className="absolute -top-20 -right-20 w-60 h-60 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground tracking-widest font-bold">AVAILABLE BALANCE</span>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[10px] text-green-500 font-bold tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
                      MAINNET
                    </span>
                    <button onClick={() => refetchBalance()} className="text-muted-foreground hover:text-white transition-colors">
                      <RefreshCw className={cn("w-3.5 h-3.5", balanceLoading && "animate-spin")} />
                    </button>
                  </div>
                </div>
                <div className="flex items-baseline gap-3 mt-3">
                  <span className="text-5xl font-black text-white">
                    {balanceLoading && realSOL === 0 ? "···" : realSOL.toFixed(4)}
                  </span>
                  <span className="px-2 py-1 rounded-md bg-purple-500/20 text-purple-300 text-xs font-bold tracking-wider">SOL</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn("text-sm font-medium", totalUSD > 0 ? "text-green-400" : "text-muted-foreground")}>
                    ${totalUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                  </span>
                  {holdingsUSD > 0 && (
                    <span className="text-xs text-muted-foreground">portfolio included</span>
                  )}
                </div>
                <button
                  onClick={() => { if (address) { navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 1500); } }}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white"
                >
                  {address?.slice(0, 8)}...{address?.slice(-6)} <Copy className="w-3 h-3" />
                  {copied && <span className="text-green-500">copied</span>}
                </button>
                <div className="grid grid-cols-2 gap-3 mt-6">
                  <Button variant="secondary" onClick={() => setDepositOpen(true)} className="rounded-full font-bold tracking-wider">
                    <ArrowDownLeft className="w-4 h-4 mr-2" /> RECEIVE
                  </Button>
                  <Button onClick={() => setSendOpen(true)} className="rounded-full font-bold tracking-wider bg-gradient-to-r from-primary to-[#8a9500] text-primary-foreground">
                    <ArrowUpRight className="w-4 h-4 mr-2" /> SEND
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* SWAP card */}
          <div>
            <div className="text-[10px] text-muted-foreground tracking-widest font-bold mb-2">SWAP</div>
            <div
              className="p-6 rounded-2xl bg-card border border-primary/20 flex flex-col items-center justify-center gap-5 min-h-[220px]"
              style={{ boxShadow: "0 0 40px rgba(225,243,17,0.08)" }}
            >
              <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                <ArrowUpDown className="w-6 h-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-white font-bold tracking-wider text-sm">Jupiter-Powered Swaps</p>
                <p className="text-xs text-muted-foreground mt-1">Real on-chain swaps across Solana tokens</p>
                <div className="flex items-center justify-center gap-1 mt-2 text-[10px] text-emerald-400 font-bold tracking-wider">
                  <Zap className="w-2.5 h-2.5" />
                  MAINNET · BEST PRICE ROUTING
                </div>
              </div>
              <Button
                onClick={() => setSwapOpen(true)}
                className="rounded-full font-bold tracking-wider bg-gradient-to-r from-primary to-[#8a9500] hover:opacity-90 text-primary-foreground px-8"
              >
                OPEN SWAP
              </Button>
            </div>
          </div>
        </div>

        {/* DexScreener Trending — LAUNCHES + TOKENS */}
        <DexTrending onSelectCAToken={handleDexSelect} />
      </div>

      <DepositModal open={depositOpen} onOpenChange={setDepositOpen} />
      <SendModal open={sendOpen} onOpenChange={setSendOpen} onDeposit={() => setDepositOpen(true)} />
      <SettingsModal open={settings} onOpenChange={setSettings} />
      <SwapModal open={swapOpen} onOpenChange={setSwapOpen} />
    </AppLayout>
  );
}
