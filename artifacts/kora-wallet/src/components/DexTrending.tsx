import { useState } from "react";
import { useDexTokens, useDexLaunches, TrendingToken, LaunchToken } from "@/hooks/use-dex-trending";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Loader2, ChevronDown, Zap, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { TokenDetailModal, DexToken } from "@/components/modals/TokenDetailModal";
import { BuyModal, BuyModalToken } from "@/components/modals/BuyModal";

// ─── chain metadata ───────────────────────────────────────────────────────────

const CHAIN_INFO: Record<string, { label: string; color: string; bg: string; short: string }> = {
  solana:    { label: "Solana",    color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/30",  short: "SOL"  },
  ethereum:  { label: "Ethereum",  color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/30",      short: "ETH"  },
  bsc:       { label: "BNB",       color: "text-yellow-400",  bg: "bg-yellow-500/10 border-yellow-500/30",  short: "BNB"  },
  base:      { label: "Base",      color: "text-blue-400",    bg: "bg-blue-600/10 border-blue-600/30",      short: "BASE" },
  polygon:   { label: "Polygon",   color: "text-purple-400",  bg: "bg-purple-600/10 border-purple-600/30",  short: "POL"  },
  arbitrum:  { label: "Arbitrum",  color: "text-sky-400",     bg: "bg-sky-500/10 border-sky-500/30",        short: "ARB"  },
  avalanche: { label: "Avalanche", color: "text-red-400",     bg: "bg-red-500/10 border-red-500/30",        short: "AVAX" },
  optimism:  { label: "Optimism",  color: "text-red-500",     bg: "bg-red-600/10 border-red-600/30",        short: "OP"   },
  sui:       { label: "SUI",       color: "text-cyan-400",    bg: "bg-cyan-500/10 border-cyan-500/30",      short: "SUI"  },
  tron:      { label: "TRON",      color: "text-red-400",     bg: "bg-red-500/10 border-red-500/30",        short: "TRX"  },
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatMC(n: number): string {
  if (n <= 0) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function formatAge(ms: number): string {
  const diff = Date.now() - ms;
  const s = Math.floor(diff / 1000);
  if (s < 60)   return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60)   return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function formatPrice(p: number): string {
  if (p <= 0) return "—";
  if (p < 0.000001) return `$${p.toExponential(2)}`;
  if (p < 0.0001)   return `$${p.toFixed(8)}`;
  if (p < 0.01)     return `$${p.toFixed(6)}`;
  if (p < 1)        return `$${p.toFixed(4)}`;
  return `$${p.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
}

// Build a BuyModalToken from a DexToken
function toBuyToken(token: DexToken): BuyModalToken {
  return {
    id: `ca:${token.address.toLowerCase()}`,
    name: token.name,
    symbol: token.symbol,
    image: token.image,
    price: token.price,
    address: token.address,
    chain: token.chainId,
  };
}

// ─── sub-components ───────────────────────────────────────────────────────────

function ChainBadge({ chainId }: { chainId: string }) {
  const info = CHAIN_INFO[chainId] ?? {
    label: chainId, color: "text-muted-foreground",
    bg: "bg-secondary/60 border-border/30", short: chainId.slice(0, 3).toUpperCase(),
  };
  return (
    <span className={cn("text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded border shrink-0", info.color, info.bg)}>
      {info.short}
    </span>
  );
}

function PriceChange({ value }: { value: number }) {
  const isPos = value >= 0;
  if (value === 0) return <span className="text-xs text-muted-foreground tabular-nums">—</span>;
  return (
    <span className={cn("text-xs font-bold tabular-nums", isPos ? "text-green-400" : "text-red-400")}>
      {isPos ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

function TokenImg({ src, alt, size = 9 }: { src: string | null; alt: string; size?: number }) {
  const [err, setErr] = useState(false);
  const px = `w-${size} h-${size}`;
  if (src && !err) {
    return (
      <img
        src={src} alt={alt}
        className={`${px} rounded-full shrink-0 object-cover border border-border/20`}
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <div className={`${px} rounded-full shrink-0 bg-secondary/60 flex items-center justify-center text-[10px] font-black text-muted-foreground border border-border/20`}>
      {alt.slice(0, 2)}
    </div>
  );
}

interface DropOpt { value: string; label: string }
interface DropdownProps { value: string; options: DropOpt[]; onChange: (v: string) => void }
function Dropdown({ value, options, onChange }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const label = options.find(o => o.value === value)?.label ?? value;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-secondary/60 border border-border/40 text-xs font-bold text-white hover:border-primary/40 transition-colors"
      >
        {label}
        <ChevronDown className="w-3 h-3 text-muted-foreground" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.1 }}
            className="absolute top-full right-0 mt-1 bg-[#1a1a24] border border-border/60 rounded-xl z-30 shadow-2xl overflow-hidden min-w-[120px]"
            onMouseLeave={() => setOpen(false)}
          >
            {options.map(opt => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={cn(
                  "w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-secondary/60 transition-colors",
                  opt.value === value ? "text-primary" : "text-white"
                )}
              >
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── LAUNCHES tab ─────────────────────────────────────────────────────────────

type LaunchStatus = "new" | "migrating" | "migrated";

function LaunchCard({ token, index, onClick }: { token: LaunchToken; index: number; onClick: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02 }}
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors border-b border-border/20 last:border-0 text-left"
    >
      <div className="shrink-0">
        <TokenImg src={token.image} alt={token.symbol} size={10} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className="text-sm font-bold text-white truncate max-w-[120px]">{token.name}</span>
          <span className="text-[10px] text-muted-foreground">{token.symbol}</span>
          <ChainBadge chainId={token.chainId} />
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>{formatAge(token.createdAt)}</span>
          {token.holders != null && token.holders > 0 && (
            <>
              <span className="opacity-40">·</span>
              <span>{token.holders.toLocaleString()} holders</span>
            </>
          )}
          {token.bondingProgress != null && (
            <>
              <span className="opacity-40">·</span>
              <span className="text-primary font-bold">{token.bondingProgress.toFixed(0)}%</span>
            </>
          )}
        </div>
        {token.bondingProgress != null && (
          <div className="w-full h-1 bg-secondary/60 rounded-full mt-1.5 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-[#8a9500] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, token.bondingProgress)}%` }}
              transition={{ duration: 0.6, delay: index * 0.02 }}
            />
          </div>
        )}
      </div>

      <div className="text-right shrink-0">
        <div className="text-xs font-bold text-white">{formatMC(token.marketCap)}</div>
        {token.volume24h > 0 && (
          <div className="text-[10px] text-muted-foreground">VOL {formatMC(token.volume24h)}</div>
        )}
      </div>
    </motion.button>
  );
}

function LaunchesTab({ onSelect }: { onSelect: (token: LaunchToken) => void }) {
  const [status, setStatus] = useState<LaunchStatus>("new");
  const { data, isLoading, isFetching } = useDexLaunches(status);

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Rocket className="w-3.5 h-3.5 text-primary" />
          <span className="text-sm font-bold text-white">Launches</span>
          {isFetching && <Loader2 className="w-3 h-3 text-primary animate-spin" />}
        </div>
        <Dropdown
          value={status}
          onChange={(v) => setStatus(v as LaunchStatus)}
          options={[
            { value: "new",       label: "New"       },
            { value: "migrating", label: "Migrating" },
            { value: "migrated",  label: "Migrated"  },
          ]}
        />
      </div>

      <div className="overflow-y-auto max-h-[560px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm">Loading launches…</span>
          </div>
        ) : data && data.length > 0 ? (
          data.map((token, i) => (
            <LaunchCard key={token.address + i} token={token} index={i} onClick={() => onSelect(token)} />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Zap className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">No launches right now</p>
            <p className="text-xs mt-1 opacity-60">Try switching to New or Migrated</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TOKENS tab ───────────────────────────────────────────────────────────────

type TimePeriod = "1h" | "24h" | "7d";

function TokensTab({ onSelect }: { onSelect: (token: TrendingToken) => void }) {
  const [period, setPeriod] = useState<TimePeriod>("24h");
  const [chain, setChain] = useState<string>("all");
  const { data, isLoading, isFetching } = useDexTokens();

  const chains = data ? [...new Set(data.map(t => t.chainId))].filter(c => CHAIN_INFO[c]) : [];

  const filtered = data
    ? (chain === "all" ? data : data.filter(t => t.chainId === chain))
    : [];

  const sorted = [...filtered].sort((a, b) => {
    const getVal = (t: TrendingToken) =>
      period === "1h" ? t.priceChange1h : period === "24h" ? t.priceChange24h : t.priceChange7d;
    return Math.abs(getVal(b)) - Math.abs(getVal(a));
  }).slice(0, 30);

  const rankColors = ["text-yellow-400", "text-slate-300", "text-amber-600"];

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-primary" />
          <span className="text-sm font-bold text-white">Tokens</span>
          {isFetching && <Loader2 className="w-3 h-3 text-primary animate-spin" />}
        </div>
        <Dropdown
          value={period}
          onChange={(v) => setPeriod(v as TimePeriod)}
          options={[
            { value: "1h",  label: "1h"  },
            { value: "24h", label: "24h" },
            { value: "7d",  label: "7d"  },
          ]}
        />
      </div>

      {chains.length > 1 && (
        <div className="flex items-center gap-1 px-4 py-2 border-b border-border/20 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setChain("all")}
            className={cn(
              "text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 transition-all",
              chain === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-white"
            )}
          >
            ALL
          </button>
          {chains.map(c => {
            const info = CHAIN_INFO[c];
            if (!info) return null;
            return (
              <button
                key={c}
                onClick={() => setChain(c)}
                className={cn(
                  "text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 transition-all",
                  chain === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-white"
                )}
              >
                {info.short}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-[2rem_1fr_auto_auto] gap-2 px-4 py-2 border-b border-border/20">
        <div className="text-[10px] text-muted-foreground font-bold">#</div>
        <div className="text-[10px] text-muted-foreground font-bold">TOKEN</div>
        <div className="text-[10px] text-muted-foreground font-bold text-right">MCAP</div>
        <div className="text-[10px] text-muted-foreground font-bold text-right uppercase w-16">{period}</div>
      </div>

      <div className="overflow-y-auto max-h-[500px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm">Fetching DexScreener data…</span>
          </div>
        ) : sorted.length > 0 ? (
          sorted.map((token, i) => {
            const change = period === "1h" ? token.priceChange1h : period === "24h" ? token.priceChange24h : token.priceChange7d;
            return (
              <motion.button
                key={token.address + token.pairAddress}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.015 }}
                onClick={() => onSelect(token)}
                className="w-full grid grid-cols-[2rem_1fr_auto_auto] gap-2 items-center px-4 py-2.5 hover:bg-secondary/30 transition-colors border-b border-border/20 last:border-0 text-left"
              >
                <div className={cn("text-sm font-black", rankColors[i] ?? "text-muted-foreground")}>{i + 1}</div>
                <div className="flex items-center gap-2.5 min-w-0">
                  <TokenImg src={token.image} alt={token.symbol} size={9} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold text-white truncate max-w-[100px]">{token.name}</span>
                      <ChainBadge chainId={token.chainId} />
                    </div>
                    <div className="text-[10px] text-muted-foreground">{token.symbol}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium text-white">{formatMC(token.marketCap)}</div>
                  <div className="text-[10px] text-muted-foreground">{formatPrice(token.price)}</div>
                </div>
                <div className="text-right w-16">
                  <PriceChange value={change} />
                </div>
              </motion.button>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <TrendingUp className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">No trending data</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export type MainTab = "launches" | "tokens";

export interface DexTrendingProps {
  onSelectCAToken?: (address: string, chainId: string, meta: {
    name: string; symbol: string; image: string | null; price: number;
  }) => void;
}

export function DexTrending({ onSelectCAToken }: DexTrendingProps) {
  const [tab, setTab] = useState<MainTab>("tokens");

  // Token detail modal state
  const [selectedToken, setSelectedToken] = useState<DexToken | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Buy/Sell modal state
  const [buyOpen, setBuyOpen] = useState(false);
  const [buyReceiveToken, setBuyReceiveToken] = useState<BuyModalToken | null>(null);
  const [buyPayToken, setBuyPayToken] = useState<BuyModalToken | null>(null);

  const openDetail = (token: TrendingToken | LaunchToken, type: "trending" | "launch") => {
    setSelectedToken({ ...token, _type: type });
    setDetailOpen(true);
  };

  const handleBuy = (token: DexToken) => {
    const bt = toBuyToken(token);
    setBuyReceiveToken(bt);
    setBuyPayToken(null);
    setDetailOpen(false);
    setBuyOpen(true);
    // Also notify parent so the swap section pre-selects this token
    onSelectCAToken?.(token.address, token.chainId, {
      name: token.name, symbol: token.symbol, image: token.image, price: token.price,
    });
  };

  const handleSell = (token: DexToken) => {
    const bt = toBuyToken(token);
    setBuyPayToken(bt);
    setBuyReceiveToken(null);
    setDetailOpen(false);
    setBuyOpen(true);
  };

  return (
    <div className="mb-8">
      {/* Header bar */}
      <div className="flex items-center mb-3 gap-3">
        <TrendingUp className="w-4 h-4 text-primary shrink-0" />
        <span className="text-[10px] text-muted-foreground tracking-widest font-bold">DEXSCREENER TRENDING</span>
        <div className="flex gap-1 ml-auto">
          {(["launches", "tokens"] as MainTab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-bold tracking-wider transition-all",
                tab === t
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-white"
              )}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Card */}
      <div
        className="rounded-2xl bg-card border border-primary/20 overflow-hidden"
        style={{ boxShadow: "0 0 40px rgba(225,243,17,0.05)" }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            {tab === "launches" ? (
              <LaunchesTab onSelect={(t) => openDetail(t, "launch")} />
            ) : (
              <TokensTab onSelect={(t) => openDetail(t, "trending")} />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-border/30 bg-secondary/10">
          <p className="text-[10px] text-muted-foreground">
            Data sourced from DexScreener · Pump.fun · All chains · Refreshes every 60s · Not financial advice
          </p>
        </div>
      </div>

      {/* Token detail modal */}
      <TokenDetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        token={selectedToken}
        onBuy={handleBuy}
        onSell={handleSell}
      />

      {/* Buy / Sell swap modal */}
      <BuyModal
        open={buyOpen}
        onOpenChange={setBuyOpen}
        initialReceiveToken={buyReceiveToken}
        initialPayToken={buyPayToken}
      />
    </div>
  );
}
