import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ExternalLink, Copy, Check, Globe, Twitter, TrendingUp, TrendingDown } from "lucide-react";
import { CALiveData } from "@/hooks/use-ca-prices";
import { BuyModal, BuyModalToken } from "@/components/modals/BuyModal";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokenId: string;
  held: number;
  liveData: CALiveData | null;
}

const CHAIN_LABEL: Record<string, string> = {
  solana: "Solana", ethereum: "Ethereum", bsc: "BNB Chain",
  polygon: "Polygon", arbitrum: "Arbitrum", base: "Base",
  avalanche: "Avalanche", optimism: "Optimism", sui: "Sui",
};
const CHAIN_COLOR: Record<string, string> = {
  solana: "from-purple-500 to-violet-700",
  ethereum: "from-blue-400 to-indigo-600",
  bsc: "from-yellow-400 to-amber-600",
  base: "from-blue-500 to-blue-800",
};

function fmtPrice(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.000001) return `$${n.toExponential(2)}`;
  if (n < 0.001) return `$${n.toFixed(8)}`;
  if (n < 1) return `$${n.toFixed(6)}`;
  if (n < 1000) return `$${n.toFixed(4)}`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function fmtLarge(n: number): string {
  if (!n) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtQty(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function PctBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground text-xs">—</span>;
  const up = value >= 0;
  return (
    <span className={cn(
      "text-xs font-bold px-1.5 py-0.5 rounded-md",
      up ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
    )}>
      {up ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

export function CATokenDetailModal({ open, onOpenChange, tokenId, held, liveData }: Props) {
  const [copied, setCopied] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [buyMode, setBuyMode] = useState<"buy" | "sell">("buy");

  const address = tokenId.startsWith("ca:") ? tokenId.slice(3) : tokenId;
  const chain = liveData?.chain ?? "unknown";
  const chainGrad = CHAIN_COLOR[chain] ?? "from-secondary to-secondary/40";
  const price = liveData?.price ?? 0;
  const change24h = liveData?.priceChange24h ?? null;
  const isUp = (change24h ?? 0) >= 0;
  const value = held * price;

  const embedUrl = liveData?.pairAddress && liveData?.chain
    ? `https://dexscreener.com/${liveData.chain}/${liveData.pairAddress}?embed=1&theme=dark&info=0&trades=0`
    : null;

  const caToken: BuyModalToken | null = liveData
    ? {
        id: tokenId,
        name: liveData.name,
        symbol: liveData.symbol,
        image: liveData.image,
        price: liveData.price,
      }
    : null;

  const openBuy = () => {
    setBuyMode("buy");
    setBuyOpen(true);
  };

  const openSell = () => {
    setBuyMode("sell");
    setBuyOpen(true);
  };

  const copy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-[#0a0a10] border border-border/40 max-w-xl w-full p-0 gap-0 flex flex-col max-h-[95vh] overflow-hidden">

          <DialogTitle className="sr-only">{liveData?.name ?? tokenId} Detail</DialogTitle>

          {/* ── Header ── */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              {liveData?.image ? (
                <img src={liveData.image} alt={liveData.name} className="w-8 h-8 rounded-full shrink-0 object-cover" />
              ) : (
                <div className={cn("w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center text-[10px] font-black text-white shrink-0", chainGrad)}>
                  {(liveData?.symbol ?? "?").slice(0, 3)}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-white truncate">{liveData?.name ?? tokenId}</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-secondary/60 border border-border/40 text-muted-foreground tracking-wider shrink-0">
                    {liveData?.symbol ?? "—"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={cn(
                    "text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white",
                    `bg-gradient-to-r ${chainGrad}`
                  )}>
                    {CHAIN_LABEL[chain] ?? chain.toUpperCase()}
                  </span>
                  {liveData?.dexId && (
                    <span className="text-[9px] text-muted-foreground capitalize">{liveData.dexId}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {liveData?.dexUrl && (
                <a
                  href={liveData.dexUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-secondary/40 text-muted-foreground hover:text-white transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <button
                onClick={() => onOpenChange(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-secondary/40 text-muted-foreground hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ── Scrollable content ── */}
          <div className="flex-1 overflow-y-auto min-h-0">

            {/* Price hero */}
            <div className="px-4 pt-4 pb-3">
              <div className="text-3xl font-black text-white tracking-tight">{fmtPrice(price)}</div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground/60 tracking-widest">1H</span>
                  <PctBadge value={liveData?.priceChange1h ?? null} />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground/60 tracking-widest">6H</span>
                  <PctBadge value={liveData?.priceChange6h ?? null} />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground/60 tracking-widest">24H</span>
                  <PctBadge value={change24h} />
                </div>
              </div>
            </div>

            {/* DexScreener chart embed */}
            {embedUrl ? (
              <div className="mx-4 mb-3 rounded-xl overflow-hidden border border-border/30 bg-[#0d0d16]" style={{ height: 280 }}>
                <iframe
                  src={embedUrl}
                  title="DexScreener Chart"
                  className="w-full h-full"
                  allowFullScreen
                  style={{ border: "none" }}
                />
              </div>
            ) : (
              <div className="mx-4 mb-3 rounded-xl border border-border/30 bg-secondary/20 flex items-center justify-center" style={{ height: 160 }}>
                <span className="text-muted-foreground text-sm">Chart loading…</span>
              </div>
            )}

            {/* Stats grid */}
            <div className="px-4 mb-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Market Cap", value: fmtLarge(liveData?.marketCap ?? 0) },
                  { label: "FDV", value: fmtLarge(liveData?.fdv ?? 0) },
                  { label: "Liquidity", value: fmtLarge(liveData?.liquidity ?? 0) },
                  { label: "24H Volume", value: fmtLarge(liveData?.volume24h ?? 0) },
                ].map(s => (
                  <div key={s.label} className="p-3 rounded-xl bg-secondary/20 border border-border/30">
                    <div className="text-[10px] text-muted-foreground tracking-wider mb-1">{s.label}</div>
                    <div className="text-sm font-bold text-white">{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Transactions */}
              {(liveData?.txns24hBuys ?? 0) + (liveData?.txns24hSells ?? 0) > 0 && (
                <div className="mt-2 p-3 rounded-xl bg-secondary/20 border border-border/30">
                  <div className="text-[10px] text-muted-foreground tracking-wider mb-2">24H TRANSACTIONS</div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-sm font-bold text-green-400">{fmtQty(liveData?.txns24hBuys ?? 0)} buys</span>
                    </div>
                    <div className="w-px h-4 bg-border/40" />
                    <div className="flex items-center gap-1.5">
                      <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-sm font-bold text-red-400">{fmtQty(liveData?.txns24hSells ?? 0)} sells</span>
                    </div>
                    <div className="flex-1">
                      {(() => {
                        const total = (liveData?.txns24hBuys ?? 0) + (liveData?.txns24hSells ?? 0);
                        const buyPct = total > 0 ? ((liveData?.txns24hBuys ?? 0) / total) * 100 : 50;
                        return (
                          <div className="h-1.5 rounded-full bg-red-500/30 overflow-hidden">
                            <div className="h-full bg-green-400 rounded-full" style={{ width: `${buyPct}%` }} />
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* My Position */}
            {held > 0 && (
              <div className="px-4 mb-3">
                <div className="text-[10px] text-muted-foreground tracking-widest font-bold mb-2">MY POSITION</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
                    <div className="text-[10px] text-muted-foreground mb-1">Value</div>
                    <div className="text-base font-black text-white">
                      ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary/20 border border-border/30">
                    <div className="text-[10px] text-muted-foreground mb-1">Balance</div>
                    <div className="text-base font-black text-white">
                      {held < 0.0001 ? held.toFixed(8) : held >= 1000 ? fmtQty(held) : held.toFixed(4)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{liveData?.symbol ?? "tokens"}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Token Info */}
            <div className="px-4 mb-24">
              <div className="text-[10px] text-muted-foreground tracking-widest font-bold mb-2">TOKEN INFO</div>
              <div className="rounded-xl bg-secondary/20 border border-border/30 overflow-hidden divide-y divide-border/20">
                <div className="flex items-center justify-between px-3 py-2.5 gap-3">
                  <span className="text-xs text-muted-foreground shrink-0">Contract</span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-mono text-white truncate">
                      {address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-6)}` : address}
                    </span>
                    <button onClick={copy} className="text-muted-foreground hover:text-primary transition-colors shrink-0">
                      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
                {liveData?.pairAddress && (
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <span className="text-xs text-muted-foreground">Pair</span>
                    <span className="text-xs font-mono text-white">
                      {liveData.pairAddress.slice(0, 6)}…{liveData.pairAddress.slice(-6)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-xs text-muted-foreground">Chain</span>
                  <span className="text-xs text-white">{CHAIN_LABEL[chain] ?? chain}</span>
                </div>
                {liveData?.dexId && (
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <span className="text-xs text-muted-foreground">DEX</span>
                    <span className="text-xs text-white capitalize">{liveData.dexId}</span>
                  </div>
                )}
                {liveData?.websites && liveData.websites.length > 0 && (
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <span className="text-xs text-muted-foreground">Website</span>
                    <a
                      href={liveData.websites[0]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                    >
                      <Globe className="w-3 h-3" />
                      {new URL(liveData.websites[0]).hostname.replace("www.", "")}
                    </a>
                  </div>
                )}
                {liveData?.socials && liveData.socials.length > 0 && (
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <span className="text-xs text-muted-foreground">Socials</span>
                    <div className="flex items-center gap-2">
                      {liveData.socials.slice(0, 3).map((s, i) => (
                        <a
                          key={i}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-white transition-colors"
                          title={s.type}
                        >
                          {s.type === "twitter" || s.type === "x" ? (
                            <Twitter className="w-3.5 h-3.5" />
                          ) : (
                            <Globe className="w-3.5 h-3.5" />
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Fixed Buy / Sell bar ── */}
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-3 bg-gradient-to-t from-[#0a0a10] via-[#0a0a10]/95 to-transparent pointer-events-none">
            <div className="grid grid-cols-2 gap-3 pointer-events-auto">
              <Button
                onClick={openBuy}
                className="h-12 rounded-2xl font-bold text-sm bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:opacity-90 shadow-lg shadow-green-500/20"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                BUY
              </Button>
              <Button
                onClick={openSell}
                variant="secondary"
                className="h-12 rounded-2xl font-bold text-sm bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 hover:text-red-300"
              >
                <TrendingDown className="w-4 h-4 mr-2" />
                SELL
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {caToken && (
        <BuyModal
          open={buyOpen}
          onOpenChange={setBuyOpen}
          initialReceiveToken={buyMode === "buy" ? caToken : null}
          initialPayToken={buyMode === "sell" ? caToken : null}
        />
      )}
    </>
  );
}
