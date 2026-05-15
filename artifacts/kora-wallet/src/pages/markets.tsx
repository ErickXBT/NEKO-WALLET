import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useTopCoins } from "@/hooks/use-coingecko";
import { useWallet } from "@/hooks/use-wallet";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { AreaChart, Area, YAxis, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";

function fmt(n: number, max = 2) {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: max })}`;
}

export default function Markets() {
  const [, setLocation] = useLocation();
  const { walletId } = useWallet();
  const { data, isLoading } = useTopCoins();
  const [search, setSearch] = useState("");

  useEffect(() => { if (!walletId) setLocation("/"); }, [walletId, setLocation]);
  if (!walletId) return null;

  const coins = (data || []).filter(
    (c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.symbol.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 py-6 md:py-8">
        <div className="flex items-end justify-between mb-5 md:mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-wider text-white">MARKETS</h1>
            <p className="text-xs text-muted-foreground mt-1">Top 100 cryptocurrencies by market cap</p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search coins..."
              className="pl-9 bg-secondary/40 border-border/40 rounded-full"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-9 md:grid-cols-12 gap-2 px-4 md:px-5 py-3 text-[10px] tracking-widest text-muted-foreground font-bold border-b border-border/40 bg-secondary/30">
            <div className="col-span-1">#</div>
            <div className="col-span-4 md:col-span-3">NAME</div>
            <div className="col-span-2 text-right">PRICE</div>
            <div className="col-span-2 md:col-span-1 text-right">24H</div>
            <div className="col-span-2 text-right hidden md:block">MARKET CAP</div>
            <div className="col-span-1 text-right hidden md:block">VOLUME</div>
            <div className="col-span-2 text-right hidden sm:block">7D</div>
          </div>

          {isLoading ? (
            Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className="h-14 border-b border-border/20 bg-secondary/10 animate-pulse" />
            ))
          ) : (
            coins.map((c, i) => {
              const change = c.price_change_percentage_24h ?? 0;
              const sparkData = (c.sparkline_in_7d?.price || []).map((p, idx) => ({ idx, p }));
              const sparkUp = sparkData.length > 1 && sparkData[sparkData.length - 1].p >= sparkData[0].p;

              return (
                <motion.button
                  key={c.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.01, 0.3) }}
                  onClick={() => setLocation(`/coin/${c.id}`)}
                  className="w-full grid grid-cols-9 md:grid-cols-12 gap-2 items-center px-4 md:px-5 py-3 border-b border-border/20 hover:bg-secondary/30 transition-colors text-left"
                >
                  <div className="col-span-1 text-xs text-muted-foreground">{c.market_cap_rank}</div>
                  <div className="col-span-4 md:col-span-3 flex items-center gap-2">
                    <img src={c.image} alt="" className="w-6 h-6 md:w-7 md:h-7 rounded-full flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs md:text-sm font-bold text-white truncate">{c.name}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">{c.symbol}</div>
                    </div>
                  </div>
                  <div className="col-span-2 text-right text-xs md:text-sm text-white font-medium">{fmt(c.current_price, 6)}</div>
                  <div className={`col-span-2 md:col-span-1 text-right text-xs font-bold ${change >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                  </div>
                  <div className="col-span-2 text-right text-sm text-white hidden md:block">{fmt(c.market_cap)}</div>
                  <div className="col-span-1 text-right text-xs text-muted-foreground hidden md:block">{fmt(c.total_volume)}</div>
                  <div className="col-span-2 h-12 hidden sm:block">
                    {sparkData.length > 0 && (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sparkData} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
                          <defs>
                            <linearGradient id={`sg-${c.id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={sparkUp ? "#22c55e" : "#ef4444"} stopOpacity={0.3} />
                              <stop offset="95%" stopColor={sparkUp ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <YAxis hide domain={["dataMin", "dataMax"]} />
                          <Area
                            type="monotone"
                            dataKey="p"
                            stroke={sparkUp ? "#22c55e" : "#ef4444"}
                            strokeWidth={1.5}
                            fill={`url(#sg-${c.id})`}
                            dot={false}
                            isAnimationActive={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </motion.button>
              );
            })
          )}
        </div>
      </div>

    </AppLayout>
  );
}
