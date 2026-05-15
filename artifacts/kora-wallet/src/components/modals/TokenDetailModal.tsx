import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ExternalLink, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import type { TrendingToken, LaunchToken } from "@/hooks/use-dex-trending";

// ─── helpers ──────────────────────────────────────────────────────────────────

const CHAIN_INFO: Record<string, { label: string; color: string; bg: string; short: string }> = {
  solana:    { label: "Solana",    color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/30",  short: "SOL"  },
  ethereum:  { label: "Ethereum",  color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/30",      short: "ETH"  },
  bsc:       { label: "BNB Chain", color: "text-yellow-400",  bg: "bg-yellow-500/10 border-yellow-500/30",  short: "BNB"  },
  base:      { label: "Base",      color: "text-blue-400",    bg: "bg-blue-600/10 border-blue-600/30",      short: "BASE" },
  polygon:   { label: "Polygon",   color: "text-purple-400",  bg: "bg-purple-600/10 border-purple-600/30",  short: "POL"  },
  arbitrum:  { label: "Arbitrum",  color: "text-sky-400",     bg: "bg-sky-500/10 border-sky-500/30",        short: "ARB"  },
  avalanche: { label: "Avalanche", color: "text-red-400",     bg: "bg-red-500/10 border-red-500/30",        short: "AVAX" },
  optimism:  { label: "Optimism",  color: "text-red-500",     bg: "bg-red-600/10 border-red-600/30",        short: "OP"   },
  sui:       { label: "SUI",       color: "text-cyan-400",    bg: "bg-cyan-500/10 border-cyan-500/30",      short: "SUI"  },
  tron:      { label: "TRON",      color: "text-red-400",     bg: "bg-red-500/10 border-red-500/30",        short: "TRX"  },
};

function chainLabel(chainId: string) {
  return CHAIN_INFO[chainId]?.label ?? chainId;
}

function chainShort(chainId: string) {
  return CHAIN_INFO[chainId]?.short ?? chainId.slice(0, 4).toUpperCase();
}

function formatPrice(p: number): string {
  if (p <= 0) return "$0.00";
  if (p < 0.000001) return `$${p.toExponential(2)}`;
  if (p < 0.0001) return `$${p.toFixed(8)}`;
  if (p < 0.01) return `$${p.toFixed(6)}`;
  if (p < 1) return `$${p.toFixed(4)}`;
  if (p < 10000) return `$${p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${p.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatNum(n: number): string {
  if (n <= 0) return "—";
  if (n >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(2)}T`;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

// Seeded pseudo-random for stable chart (no flicker on re-render)
function seededRand(seed: string) {
  let s = seed.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) & 0x7fffffff, 1);
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

type Period = "1D" | "1W" | "1M" | "1Y" | "ALL";

function generateChart(price: number, ch24h: number, ch7d: number, period: Period, seed: string) {
  const rand = seededRand(seed + period);
  const cfg: Record<Period, { pts: number; ms: number; pct: number; fmt: (t: Date) => string }> = {
    "1D":  { pts: 48,  ms: 86_400_000,           pct: ch24h,        fmt: d => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
    "1W":  { pts: 84,  ms: 7 * 86_400_000,       pct: ch7d,         fmt: d => d.toLocaleDateString([], { weekday: "short" }) },
    "1M":  { pts: 60,  ms: 30 * 86_400_000,      pct: ch7d * 4,     fmt: d => d.toLocaleDateString([], { month: "short", day: "numeric" }) },
    "1Y":  { pts: 52,  ms: 365 * 86_400_000,     pct: ch7d * 52,    fmt: d => d.toLocaleDateString([], { month: "short" }) },
    "ALL": { pts: 60,  ms: 2 * 365 * 86_400_000, pct: ch7d * 104,   fmt: d => d.toLocaleDateString([], { year: "2-digit", month: "short" }) },
  };
  const { pts, ms, pct, fmt } = cfg[period];
  const startPrice = price / (1 + pct / 100);
  const now = Date.now();
  const volatility = 0.025 * Math.abs(pct / 100) + 0.005;
  let running = startPrice;

  return Array.from({ length: pts + 1 }, (_, i) => {
    const t = now - ms + (ms * i) / pts;
    const trend = startPrice + (price - startPrice) * (i / pts);
    const noise = (rand() - 0.5) * 2 * volatility * price;
    running = running * 0.7 + (trend + noise) * 0.3;
    return { t: fmt(new Date(t)), price: Math.max(price * 0.001, running) };
  });
}

// ─── Token image ──────────────────────────────────────────────────────────────

function TokenImg({ src, alt, size = 12 }: { src: string | null; alt: string; size?: number }) {
  const [err, setErr] = useState(false);
  const cls = `w-${size} h-${size}`;
  if (src && !err) {
    return <img src={src} alt={alt} className={`${cls} rounded-full object-cover border border-border/30`} onError={() => setErr(true)} />;
  }
  return (
    <div className={`${cls} rounded-full bg-secondary/60 flex items-center justify-center text-sm font-black text-muted-foreground border border-border/20`}>
      {alt.slice(0, 2).toUpperCase()}
    </div>
  );
}

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/20 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-semibold text-white", valueClass)}>{value}</span>
    </div>
  );
}

// ─── Exported token type ──────────────────────────────────────────────────────

export type DexToken = (TrendingToken | LaunchToken) & { _type: "trending" | "launch" };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: DexToken | null;
  onBuy: (token: DexToken) => void;
  onSell: (token: DexToken) => void;
}

export function TokenDetailModal({ open, onOpenChange, token, onBuy, onSell }: Props) {
  const [period, setPeriod] = useState<Period>("1D");

  const trending = token?._type === "trending" ? (token as TrendingToken & { _type: "trending" }) : null;
  const change24h = trending?.priceChange24h ?? 0;
  const change7d = trending?.priceChange7d ?? 0;
  const change1h = trending?.priceChange1h ?? 0;
  const volume24h = token?.volume24h ?? 0;
  const marketCap = token?.marketCap ?? 0;

  const price = token?.price ?? 0;
  const isPositive = change24h >= 0;

  const chartData = useMemo(() => {
    if (!token) return [];
    return generateChart(price, change24h, change7d, period, token.address);
  }, [token?.address, price, change24h, change7d, period]);

  const chartColor = isPositive ? "#22c55e" : "#ef4444";
  const chartGradient = isPositive ? "#22c55e" : "#ef4444";

  const dexUrl = trending?.pairAddress
    ? `https://dexscreener.com/${token?.chainId}/${trending.pairAddress}`
    : `https://dexscreener.com/tokens/${token?.address}`;

  // Calculate approximate 24h high/low from chart data
  const prices = chartData.map(d => d.price);
  const high24h = prices.length ? Math.max(...prices) : 0;
  const low24h = prices.length ? Math.min(...prices) : 0;

  const changeForPeriod = () => {
    if (!trending) return 0;
    if (period === "1D") return change24h;
    if (period === "1W" || period === "1M") return change7d;
    return change7d;
  };

  const periodChange = changeForPeriod();
  const priceChangeDollar = price - price / (1 + periodChange / 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 bg-[#0f0f14] border border-border/30 overflow-hidden gap-0 max-h-[90vh] flex flex-col">
        <DialogTitle className="sr-only">{token?.name ?? "Token"} Detail</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/20 shrink-0">
          <button onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-white transition-colors p-1">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <TokenImg src={token?.image ?? null} alt={token?.symbol ?? "?"} size={7} />
            <div>
              <span className="text-sm font-bold text-white">{token?.name}</span>
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded border font-bold text-muted-foreground border-border/40 bg-secondary/30">
                {chainShort(token?.chainId ?? "")}
              </span>
            </div>
          </div>
          <a
            href={dexUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-white transition-colors p-1"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1">

          {/* Price section */}
          <div className="px-5 pt-5 pb-3">
            <div className="text-4xl font-black text-white">{formatPrice(price)}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn("text-sm font-semibold", isPositive ? "text-green-400" : "text-red-400")}>
                {isPositive ? "+" : ""}${Math.abs(priceChangeDollar).toLocaleString("en-US", { maximumFractionDigits: 6 })}
              </span>
              <span className={cn(
                "text-xs font-bold px-1.5 py-0.5 rounded",
                isPositive ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
              )}>
                {isPositive ? "+" : ""}{periodChange.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Chart */}
          <div className="px-2 pb-2">
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                  <defs>
                    <linearGradient id="tdGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartGradient} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={chartGradient} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" hide />
                  <YAxis domain={["auto", "auto"]} hide />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-card border border-border/60 rounded-lg px-3 py-2 text-xs">
                          <div className="text-white font-bold">{formatPrice(payload[0].value as number)}</div>
                          <div className="text-muted-foreground">{payload[0].payload.t}</div>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke={chartColor}
                    strokeWidth={2}
                    fill="url(#tdGrad)"
                    dot={false}
                    activeDot={{ r: 3, fill: chartColor, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Period selector */}
            <div className="flex items-center justify-center gap-1 mt-2">
              {(["1D", "1W", "1M", "1Y", "ALL"] as Period[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-bold transition-all",
                    period === p
                      ? "bg-secondary text-white"
                      : "text-muted-foreground hover:text-white"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Info section */}
          <div className="px-5 pb-2">
            <h3 className="text-base font-bold text-white mb-3">Info</h3>
            <div className="bg-secondary/20 rounded-2xl px-4 border border-border/20">
              <InfoRow label="Name" value={token?.name ?? "—"} />
              <InfoRow label="Symbol" value={token?.symbol ?? "—"} />
              <InfoRow label="Network" value={chainLabel(token?.chainId ?? "")} />
              {marketCap > 0 && <InfoRow label="Market Cap" value={formatNum(marketCap)} />}
              {volume24h > 0 && <InfoRow label="24h Volume" value={formatNum(volume24h)} />}
              {high24h > 0 && <InfoRow label="24h High" value={formatPrice(high24h)} />}
              {low24h > 0 && <InfoRow label="24h Low" value={formatPrice(low24h)} />}
              {token?.address && (
                <InfoRow label="Contract" value={`${token.address.slice(0, 6)}…${token.address.slice(-4)}`} />
              )}
            </div>
          </div>

          {/* 24h Performance */}
          {(change24h !== 0 || change1h !== 0 || volume24h > 0) && (
            <div className="px-5 pb-4">
              <h3 className="text-base font-bold text-white mb-3">24h Performance</h3>
              <div className="bg-secondary/20 rounded-2xl px-4 border border-border/20">
                {volume24h > 0 && (
                  <InfoRow
                    label="Volume"
                    value={formatNum(volume24h)}
                    valueClass="text-primary"
                  />
                )}
                {change1h !== 0 && (
                  <InfoRow
                    label="1h Change"
                    value={`${change1h >= 0 ? "+" : ""}${change1h.toFixed(2)}%`}
                    valueClass={change1h >= 0 ? "text-green-400" : "text-red-400"}
                  />
                )}
                {change24h !== 0 && (
                  <InfoRow
                    label="Price Change"
                    value={`${change24h >= 0 ? "+" : ""}${change24h.toFixed(2)}%`}
                    valueClass={change24h >= 0 ? "text-green-400" : "text-red-400"}
                  />
                )}
                {change7d !== 0 && (
                  <InfoRow
                    label="7d Change"
                    value={`${change7d >= 0 ? "+" : ""}${change7d.toFixed(2)}%`}
                    valueClass={change7d >= 0 ? "text-green-400" : "text-red-400"}
                  />
                )}
              </div>
            </div>
          )}

          {/* Bottom padding so content clears the sticky footer */}
          <div className="h-2" />
        </div>

        {/* Buy / Sell buttons */}
        <div className="grid grid-cols-2 gap-3 px-5 py-4 border-t border-border/20 shrink-0 bg-[#0f0f14]">
          <Button
            onClick={() => token && onBuy(token)}
            className="rounded-full font-bold tracking-wider bg-gradient-to-r from-primary to-[#8a9500] text-primary-foreground"
          >
            <ArrowDownLeft className="w-4 h-4 mr-1.5" />
            Buy
          </Button>
          <Button
            onClick={() => token && onSell(token)}
            variant="secondary"
            className="rounded-full font-bold tracking-wider"
          >
            <ArrowUpRight className="w-4 h-4 mr-1.5" />
            Sell
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
