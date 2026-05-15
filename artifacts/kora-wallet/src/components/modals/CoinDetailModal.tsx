import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Copy, Check } from "lucide-react";
import { useState } from "react";
import { CoinMarketData, useCoinChart } from "@/hooks/use-coingecko";
import { ResponsiveContainer, YAxis, Tooltip, AreaChart, Area } from "recharts";
import { useWallet } from "@/hooks/use-wallet";
import { BuyModal, type BuyModalToken } from "@/components/modals/BuyModal";

interface Props {
  coin: CoinMarketData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CoinDetailModal({ coin, open, onOpenChange }: Props) {
  const [copied, setCopied] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [buyMode, setBuyMode] = useState<"buy" | "sell">("buy");
  const { holdings } = useWallet();
  const chart = useCoinChart(coin?.id || "", "30");

  if (!coin) return null;

  const held = holdings[coin.id] || 0;
  const value = held * coin.current_price;
  const fakeContract = coin.id.slice(0, 6).toUpperCase() + "..." + coin.symbol.toUpperCase().slice(0, 4);

  const chartData = chart.data?.prices.map(([t, p]) => ({ time: t, price: p })) || [];

  const coinToken: BuyModalToken = {
    id: coin.id, name: coin.name, symbol: coin.symbol, image: coin.image,
    price: coin.current_price,
  };

  const handleBuy = () => { setBuyMode("buy"); setBuyOpen(true); };
  const handleSell = () => { setBuyMode("sell"); setBuyOpen(true); };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border border-primary/20 max-w-lg p-0 overflow-hidden">
        <div className="p-6">
          <div className="flex justify-end mb-2">
            <button onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col items-center text-center mb-5">
            <img src={coin.image} alt={coin.name} className="w-16 h-16 rounded-full mb-3 ring-2 ring-primary/30" />
            <h3 className="text-xl font-bold tracking-wider text-white flex items-center gap-2">
              {coin.name.toUpperCase()}
              <span className="w-4 h-4 rounded-full bg-primary/30 border border-primary flex items-center justify-center">
                <Check className="w-2.5 h-2.5 text-primary" />
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">{coin.symbol}</p>
          </div>

          {chartData.length > 0 && (
            <div className="h-32 mb-4 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="cgrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF2625" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#FF2625" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis hide domain={["dataMin", "dataMax"]} />
                  <Tooltip
                    contentStyle={{ background: "#14141B", border: "1px solid rgba(255,38,37,0.3)", borderRadius: 8, fontSize: 12 }}
                    labelFormatter={(t) => new Date(t).toLocaleDateString()}
                    formatter={(v: number) => [`$${v.toFixed(4)}`, "Price"]}
                  />
                  <Area type="monotone" dataKey="price" stroke="#FF2625" strokeWidth={2} fill="url(#cgrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="space-y-2 text-sm">
            <Row label="HOLDINGS" value={held.toFixed(4)} />
            <Row label="VALUE" valueClass="text-green-500 font-bold" value={`$${value.toFixed(2)}`} />
            <Row label="PRICE" value={`$${coin.current_price.toLocaleString(undefined, { maximumFractionDigits: 6 })}`} />
            <Row
              label="24H"
              value={`${coin.price_change_percentage_24h?.toFixed(2)}%`}
              valueClass={(coin.price_change_percentage_24h ?? 0) >= 0 ? "text-green-500" : "text-red-500"}
            />
            <div className="flex items-center justify-between border-b border-border/40 py-2">
              <span className="text-muted-foreground text-xs tracking-wider">CONTRACT</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(fakeContract);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1200);
                }}
                className="flex items-center gap-1.5 text-white text-xs font-mono"
              >
                {fakeContract}
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
              </button>
            </div>
            <Row label="CHAIN" value="KORA" valueClass="text-primary font-bold" />
          </div>

          <div className="grid grid-cols-2 gap-2 mt-5">
            <Button variant="secondary" className="rounded-full font-bold tracking-wider">RECEIVE</Button>
            <Button className="rounded-full font-bold tracking-wider bg-gradient-to-r from-primary to-red-800 text-white">SEND</Button>
            <Button onClick={handleBuy} className="rounded-full font-bold tracking-wider bg-green-600 hover:bg-green-700 text-white">BUY</Button>
            <Button onClick={handleSell} className="rounded-full font-bold tracking-wider bg-red-700 hover:bg-red-800 text-white">SELL</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <BuyModal
      open={buyOpen}
      onOpenChange={setBuyOpen}
      initialReceiveToken={buyMode === "buy" ? coinToken : undefined}
      initialPayToken={buyMode === "sell" ? coinToken : undefined}
    />
    </>
  );
}

function Row({ label, value, valueClass = "text-white" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 py-2">
      <span className="text-muted-foreground text-xs tracking-wider">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}
