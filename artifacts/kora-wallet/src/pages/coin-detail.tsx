import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useTopCoins, useCoinChart } from "@/hooks/use-coingecko";
import { useWallet } from "@/hooks/use-wallet";
import { useSolanaBalance } from "@/hooks/use-solana-balance";
import { useSolanaTransactions } from "@/hooks/use-solana-transactions";
import { BuyModal, type BuyModalToken } from "@/components/modals/BuyModal";
import { AreaChart, Area, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import {
  ArrowLeft, Send, TrendingUp, TrendingDown, MoreHorizontal,
  RefreshCw, ExternalLink, ArrowDownLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Period = "1" | "7" | "30" | "365" | "max";

const PERIODS: { key: Period; label: string }[] = [
  { key: "1", label: "1D" },
  { key: "7", label: "1W" },
  { key: "30", label: "1M" },
  { key: "365", label: "1Y" },
  { key: "max", label: "ALL" },
];

function fmtLarge(n: number) {
  if (!n) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtSupply(n: number) {
  if (!n) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function fmtTime(ts: number) {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export default function CoinDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const coinId = params.id ?? "";
  const isSol = coinId === "solana";

  const { data: coins } = useTopCoins();
  const { holdings, address } = useWallet();
  const { data: chainSOL, isLoading: balanceLoading, refetch: refetchSOL } = useSolanaBalance(address);

  const [period, setPeriod] = useState<Period>("1");
  const { data: chartData, isLoading: chartLoading } = useCoinChart(coinId, period);

  const coin = coins?.find(c => c.id === coinId) ?? null;
  const held = isSol ? (chainSOL ?? 0) : (holdings[coinId] ?? 0);
  const price = coin?.current_price ?? 0;
  const value = held * price;
  const change24h = coin?.price_change_percentage_24h ?? 0;
  const change24hAbs = coin?.price_change_24h ?? 0;
  const isUp = change24h >= 0;

  const chartPoints = chartData?.prices.map(([t, p]) => ({ time: t, price: p })) ?? [];
  const chartIsUp = chartPoints.length >= 2
    ? chartPoints[chartPoints.length - 1].price >= chartPoints[0].price
    : isUp;
  const chartColor = chartIsUp ? "#22c55e" : "#ef4444";

  const { data: solTxs, isLoading: txLoading } = useSolanaTransactions(isSol ? address : null, 10);

  const [buyOpen, setBuyOpen] = useState(false);
  const [buyMode, setBuyMode] = useState<"buy" | "sell">("buy");

  const coinToken: BuyModalToken | null = coin ? {
    id: coinId, name: coin.name, symbol: coin.symbol,
    image: coin.image, price: coin.current_price,
  } : null;

  const handleBuy = () => {
    if (isSol) { setLocation("/wallet"); return; }
    setBuyMode("buy"); setBuyOpen(true);
  };

  const handleSell = () => {
    if (isSol) { toast({ title: "Use Send button to transfer SOL" }); return; }
    setBuyMode("sell"); setBuyOpen(true);
  };

  return (
    <>
    <AppLayout>
      <div className="max-w-2xl mx-auto w-full pb-28">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border/30 sticky top-0 bg-background/95 backdrop-blur z-10">
          <button
            onClick={() => setLocation("/wallet")}
            className="p-2 rounded-full hover:bg-secondary/60 text-muted-foreground hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          {coin ? (
            <div className="flex items-center gap-2">
              <img src={coin.image} alt={coin.name} className="w-6 h-6 rounded-full" />
              <span className="font-bold text-white text-sm">{coin.name}</span>
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-500/20 border border-blue-400/60">
                <svg className="w-2.5 h-2.5 text-blue-400" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M10.28 2.28L4 8.56 1.72 6.28a1 1 0 00-1.41 1.41l3 3a1 1 0 001.41 0l7-7a1 1 0 00-1.41-1.41z" />
                </svg>
              </span>
            </div>
          ) : (
            <span className="text-sm font-bold text-muted-foreground">{coinId}</span>
          )}
          <a
            href={`https://www.coingecko.com/en/coins/${coinId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full hover:bg-secondary/60 text-muted-foreground hover:text-white transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* Price */}
        <div className="px-5 pt-6 pb-3">
          <div className="text-4xl font-black text-white tracking-tight">
            {price > 0
              ? `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: price < 0.01 ? 6 : price < 1 ? 4 : 2 })}`
              : "···"}
          </div>
          {coin && (
            <div className={cn("flex items-center gap-2 mt-1.5 text-sm font-semibold", isUp ? "text-green-400" : "text-red-400")}>
              <span>{isUp ? "+" : ""}${Math.abs(change24hAbs).toFixed(2)}</span>
              <span className={cn("px-2 py-0.5 rounded-md text-xs font-bold", isUp ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400")}>
                {isUp ? "+" : ""}{change24h.toFixed(2)}%
              </span>
            </div>
          )}
        </div>

        {/* Chart */}
        <div className="h-52 mb-1">
          {chartLoading ? (
            <div className="h-full flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" />
            </div>
          ) : chartPoints.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartPoints} margin={{ top: 4, right: 0, bottom: 4, left: 0 }}>
                <defs>
                  <linearGradient id={`cg-${coinId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis hide domain={["dataMin", "dataMax"]} />
                <Tooltip
                  contentStyle={{ background: "#0e0e16", border: `1px solid ${chartColor}50`, borderRadius: 10, fontSize: 11, padding: "6px 10px" }}
                  labelFormatter={(t) => new Date(t).toLocaleString()}
                  formatter={(v: number) => [
                    `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: v < 0.01 ? 6 : 2 })}`,
                    "Price",
                  ]}
                />
                <Area type="monotone" dataKey="price" stroke={chartColor} strokeWidth={2.5} fill={`url(#cg-${coinId})`} dot={false} activeDot={{ r: 4, fill: chartColor }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No chart data</div>
          )}
        </div>

        {/* Period selector */}
        <div className="flex items-center justify-center gap-1 px-4 mb-6">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-bold transition-all",
                period === p.key ? "bg-secondary text-white" : "text-muted-foreground hover:text-white"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-4 gap-2 px-4 mb-6">
          {[
            { icon: Send, label: "Send", onClick: () => setLocation("/wallet") },
            { icon: ArrowDownLeft, label: "Receive", onClick: () => setLocation("/wallet") },
            { icon: TrendingUp, label: "Long", onClick: handleBuy },
            { icon: TrendingDown, label: "Short", onClick: handleSell },
          ].map(({ icon: Icon, label, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-secondary/40 hover:bg-secondary/70 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-secondary/70 flex items-center justify-center">
                <Icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <span className="text-[11px] text-muted-foreground">{label}</span>
            </button>
          ))}
        </div>

        {/* Position (if holding) */}
        {held > 0 && (
          <div className="px-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-white">Position</h3>
              {isSol && (
                <button onClick={() => refetchSOL()} className="text-muted-foreground hover:text-white">
                  <RefreshCw className={cn("w-3.5 h-3.5", balanceLoading && "animate-spin")} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-secondary/40">
                <div className="text-xs text-muted-foreground mb-1">Value</div>
                <div className="text-lg font-bold text-white">
                  ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-secondary/40">
                <div className="text-xs text-muted-foreground mb-1">Balance</div>
                <div className="text-lg font-bold text-white">
                  {held < 0.0001 ? held.toFixed(8) : held >= 1000 ? held.toLocaleString("en-US", { maximumFractionDigits: 2 }) : held.toFixed(4)} {coin?.symbol.toUpperCase()}
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-secondary/40">
                <div className="text-xs text-muted-foreground mb-1">24h Change</div>
                <div className={cn("text-lg font-bold", isUp ? "text-green-400" : "text-red-400")}>
                  {isUp ? "+" : "-"}${(held * Math.abs(change24hAbs)).toFixed(2)}
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-secondary/40">
                <div className="text-xs text-muted-foreground mb-1">Unrealized P&L</div>
                <div className={cn("text-lg font-bold", isUp ? "text-green-400" : "text-red-400")}>
                  {isUp ? "+" : "-"}${(held * Math.abs(change24hAbs) * 3).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Token Info */}
        {coin && (
          <div className="px-4 mb-6">
            <h3 className="font-bold text-white mb-3">Info</h3>
            <div className="rounded-2xl bg-secondary/40 overflow-hidden divide-y divide-border/20">
              {[
                { label: "Name", value: coin.name },
                { label: "Symbol", value: coin.symbol.toUpperCase() },
                { label: "Network", value: isSol ? "Solana" : "Multi-chain" },
                { label: "Market Cap", value: fmtLarge(coin.market_cap) },
                { label: "24h Volume", value: fmtLarge(coin.total_volume) },
                { label: "Circulating Supply", value: `${fmtSupply(coin.circulating_supply)} ${coin.symbol.toUpperCase()}` },
                { label: "Total Supply", value: coin.total_supply ? `${fmtSupply(coin.total_supply)} ${coin.symbol.toUpperCase()}` : "—" },
                { label: "24h High", value: `$${coin.high_24h?.toLocaleString("en-US", { maximumFractionDigits: 4 }) ?? "—"}` },
                { label: "24h Low", value: `$${coin.low_24h?.toLocaleString("en-US", { maximumFractionDigits: 4 }) ?? "—"}` },
                { label: "All Time High", value: `$${coin.ath?.toLocaleString("en-US", { maximumFractionDigits: 4 }) ?? "—"}` },
                { label: "Rank", value: `#${coin.market_cap_rank}` },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className="text-sm font-medium text-white">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 24h Performance */}
        {coin && (
          <div className="px-4 mb-6">
            <h3 className="font-bold text-white mb-3">24h Performance</h3>
            <div className="rounded-2xl bg-secondary/40 overflow-hidden divide-y divide-border/20">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted-foreground">Volume</span>
                <span className={cn("text-sm font-medium", isUp ? "text-green-400" : "text-red-400")}>{fmtLarge(coin.total_volume)}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted-foreground">Price Change</span>
                <span className={cn("text-sm font-medium", isUp ? "text-green-400" : "text-red-400")}>
                  {isUp ? "+" : ""}{change24h.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Activity */}
        <div className="px-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-white">Activity</h3>
            {isSol && solTxs && solTxs.length > 0 && (
              <a
                href={`https://solscan.io/account/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
              >
                See More <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {isSol ? (
            txLoading ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : solTxs && solTxs.length > 0 ? (
              <div className="space-y-2">
                {solTxs.map(tx => (
                  <a
                    key={tx.signature}
                    href={`https://solscan.io/tx/${tx.signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-2xl bg-secondary/40 hover:bg-secondary/60 transition-colors"
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center shrink-0 relative",
                      tx.type === "received" ? "bg-green-500/15" : "bg-secondary/70"
                    )}>
                      {coin && <img src={coin.image} alt="SOL" className="w-6 h-6 rounded-full" />}
                      <div className={cn(
                        "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-card",
                        tx.type === "received" ? "bg-green-500" : "bg-blue-500"
                      )}>
                        {tx.type === "received"
                          ? <ArrowDownLeft className="w-2 h-2 text-white" />
                          : <Send className="w-2 h-2 text-white" />}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white capitalize">{tx.type === "received" ? "Received" : "Sent"}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {tx.type === "received" ? "From" : "To"} {tx.counterparty}
                      </div>
                      {tx.blockTime > 0 && (
                        <div className="text-[10px] text-muted-foreground/60">{fmtTime(tx.blockTime)}</div>
                      )}
                    </div>
                    <div className={cn("text-sm font-bold shrink-0", tx.type === "received" ? "text-green-400" : "text-white")}>
                      {tx.type === "received" ? "+" : "-"}{tx.amount.toFixed(5)} SOL
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">No transaction history</div>
            )
          ) : (
            <div className="rounded-2xl bg-secondary/40 p-6 text-center">
              {held > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Holding <span className="text-white font-bold">{held.toFixed(4)} {coin?.symbol.toUpperCase()}</span> · valued at <span className="text-green-400 font-bold">${value.toFixed(2)}</span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No activity yet</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fixed Buy / Sell */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-gradient-to-t from-background via-background/95 to-transparent pointer-events-none">
        <div className="max-w-2xl mx-auto grid grid-cols-2 gap-3 pointer-events-auto">
          <Button
            onClick={handleBuy}
            className="h-14 rounded-2xl font-bold text-base bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Buy
          </Button>
          <Button
            onClick={handleSell}
            variant="secondary"
            className="h-14 rounded-2xl font-bold text-base"
          >
            Sell
          </Button>
        </div>
      </div>
    </AppLayout>

    {coinToken && (
      <BuyModal
        open={buyOpen}
        onOpenChange={setBuyOpen}
        initialReceiveToken={buyMode === "buy" ? coinToken : undefined}
        initialPayToken={buyMode === "sell" ? coinToken : undefined}
      />
    )}
    </>
  );
}
