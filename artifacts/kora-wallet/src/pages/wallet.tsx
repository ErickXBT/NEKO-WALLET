import { useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/use-wallet";
import { useSolanaBalance } from "@/hooks/use-solana-balance";
import { useTopCoins } from "@/hooks/use-coingecko";
import { useCAPrices } from "@/hooks/use-ca-prices";
import { CoinGrid } from "@/components/CoinGrid";
import { DepositModal } from "@/components/modals/DepositModal";
import { SendModal } from "@/components/modals/SendModal";
import { SwapModal } from "@/components/modals/SwapModal";
import { BuyModal } from "@/components/modals/BuyModal";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { AccountDetailModal } from "@/components/modals/AccountDetailModal";
import {
  ArrowDownLeft, ArrowUpRight, Settings, Copy, RefreshCw,
  ArrowLeftRight, ShoppingCart, ChevronDown
} from "lucide-react";
import { motion } from "framer-motion";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

const ACCOUNT_COLORS = [
  "from-violet-500 to-purple-700",
  "from-blue-500 to-cyan-700",
  "from-emerald-500 to-teal-700",
  "from-orange-500 to-amber-700",
  "from-rose-500 to-pink-700",
  "from-indigo-500 to-blue-700",
  "from-teal-500 to-cyan-600",
  "from-fuchsia-500 to-purple-600",
];

function getInitials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function Wallet() {
  const [, setLocation] = useLocation();
  const { walletId, address, holdings, accounts, activeAccountId, syncSolBalance, solBalance } = useWallet();
  const { data: chainSOL, isLoading: balanceLoading, refetch: refetchBalance } = useSolanaBalance(address);

  // Keep the stored solBalance in sync with real on-chain changes.
  // syncSolBalance now applies only the chain delta so simulated
  // swap deposits are preserved (see WalletProvider).
  useEffect(() => {
    if (chainSOL != null && chainSOL >= 0) {
      syncSolBalance(chainSOL);
    }
  }, [chainSOL]);
  const { data: coins } = useTopCoins();
  const solPrice = coins?.find(c => c.id === "solana")?.current_price ?? 0;
  // Use the full stored solBalance (on-chain + simulated) as the displayed figure
  const realSOL = solBalance;

  // Live CA token prices — polled from DexScreener every 60 s
  const caIds = Object.keys(holdings).filter(id => id.startsWith("ca:"));
  const liveCA = useCAPrices(caIds, walletId ?? null);

  // Price lookup: CoinGecko first → live DexScreener → cached localStorage
  const customCoinsRaw: { id: string; price: number }[] = (() => {
    try {
      const raw = walletId
        ? localStorage.getItem(`neko_custom_coins_${walletId.toUpperCase()}`)
        : null;
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  })();

  const holdingsUSD = Object.entries(holdings).reduce((sum, [coinId, amount]) => {
    const cgPrice = coins?.find(c => c.id === coinId)?.current_price ?? 0;
    const caPrice = cgPrice === 0 ? (liveCA[coinId]?.price ?? 0) : 0;
    const customPrice = caPrice === 0
      ? (customCoinsRaw.find(c => c.id === coinId)?.price ?? 0)
      : 0;
    return sum + amount * (cgPrice || caPrice || customPrice);
  }, 0);
  const totalUSD = realSOL * solPrice + holdingsUSD;
  const [deposit, setDeposit] = useState(false);
  const [send, setSend] = useState(false);
  const [swap, setSwap] = useState(false);
  const [buy, setBuy] = useState(false);
  const [settings, setSettings] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [detailAccountId, setDetailAccountId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!walletId) setLocation("/");
  }, [walletId, setLocation]);

  if (!walletId) return null;

  const activeAccountIndex = accounts.findIndex(a => a.id === activeAccountId);
  const activeAccount = activeAccountIndex >= 0 ? accounts[activeAccountIndex] : accounts[0];
  const accountColor = ACCOUNT_COLORS[activeAccountIndex % ACCOUNT_COLORS.length];
  const initials = activeAccount ? getInitials(activeAccount.name) : "A1";

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto w-full px-4 md:px-6 py-6 md:py-8">

        {/* Page header */}
        <div className="flex items-start justify-between mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-wider text-white">WALLET</h1>
            <p className="text-xs text-muted-foreground mt-1">@{walletId.toLowerCase()}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setSettings(true)} className="rounded-full border-border/40">
              <Settings className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation("/")}
              className="hidden sm:flex rounded-full border-border/40 text-xs font-bold tracking-wider"
            >
              DISCONNECT
            </Button>
          </div>
        </div>

        {/* Account switcher bar */}
        <button
          onClick={() => setSwitcherOpen(true)}
          className="flex items-center gap-3 mb-4 px-4 py-2.5 rounded-2xl bg-secondary/40 border border-border/40 hover:border-primary/30 hover:bg-secondary/60 transition-all w-full md:w-auto"
        >
          <div className={cn(
            "w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-md",
            accountColor
          )}>
            {initials}
          </div>
          <div className="text-left flex-1 min-w-0">
            <div className="text-sm font-bold text-white truncate">
              {activeAccount?.name ?? "Account 1"}
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              {address?.slice(0, 4)}...{address?.slice(-4)}
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>

        {/* Balance card */}
        <div className="mb-8">
          <div className="text-[10px] text-muted-foreground tracking-widest font-bold mb-2">BALANCE</div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative p-6 rounded-2xl bg-gradient-to-br from-card to-secondary/30 border border-primary/20 overflow-hidden"
            style={{
              boxShadow: "0 0 40px rgba(225,243,17,0.08), inset 0 0 40px rgba(225,243,17,0.03)",
            }}
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
                  <button
                    onClick={() => refetchBalance()}
                    className="text-muted-foreground hover:text-white transition-colors"
                    title="Refresh balance"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", balanceLoading && "animate-spin")} />
                  </button>
                </div>
              </div>
              <div className="flex items-baseline gap-2 mt-3">
                <span className="text-5xl font-black text-white">
                  {balanceLoading && realSOL === 0 && holdingsUSD === 0
                    ? "···"
                    : `$${totalUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-sm text-muted-foreground font-mono">
                  {realSOL.toFixed(4)} SOL
                </span>
                {solPrice > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ≈ ${(realSOL * solPrice).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
                {holdingsUSD > 0 && (
                  <span className="text-xs text-muted-foreground/60">+ portfolio</span>
                )}
              </div>

              <button
                onClick={() => {
                  if (address) {
                    navigator.clipboard.writeText(address);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }
                }}
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white"
              >
                {address?.slice(0, 4)}...{address?.slice(-4)}
                <Copy className="w-3 h-3" />
                {copied && <span className="text-green-500">copied</span>}
              </button>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={() => setDeposit(true)}
                  className="rounded-full font-bold tracking-wider"
                >
                  <ArrowDownLeft className="w-4 h-4 mr-2" /> RECEIVE
                </Button>
                <Button
                  onClick={() => setSend(true)}
                  className="rounded-full font-bold tracking-wider bg-gradient-to-r from-primary to-[#8a9500] text-primary-foreground"
                >
                  <ArrowUpRight className="w-4 h-4 mr-2" /> SEND
                </Button>
                <Button
                  onClick={() => setSwap(true)}
                  className="rounded-full font-bold tracking-wider bg-gradient-to-r from-primary to-[#8a9500] text-primary-foreground"
                >
                  <ArrowLeftRight className="w-4 h-4 mr-2" /> SWAP
                </Button>
                <Button
                  onClick={() => setBuy(true)}
                  variant="secondary"
                  className="rounded-full font-bold tracking-wider"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" /> BUY
                </Button>
              </div>
            </div>
          </motion.div>
        </div>

        <CoinGrid initialCount={12} />
      </div>

      <DepositModal open={deposit} onOpenChange={setDeposit} />
      <SendModal open={send} onOpenChange={setSend} onDeposit={() => setDeposit(true)} />
      <SwapModal open={swap} onOpenChange={setSwap} />
      <BuyModal open={buy} onOpenChange={setBuy} />
      <SettingsModal
        open={settings}
        onOpenChange={setSettings}
        onManageAccounts={() => setSwitcherOpen(true)}
      />
      <AccountSwitcher
        open={switcherOpen}
        onOpenChange={setSwitcherOpen}
        onEditAccount={(id) => setDetailAccountId(id)}
      />
      <AccountDetailModal
        accountId={detailAccountId}
        open={!!detailAccountId}
        onOpenChange={(o) => { if (!o) setDetailAccountId(null); }}
      />
    </AppLayout>
  );
}
