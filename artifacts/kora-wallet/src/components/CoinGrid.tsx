import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search, Plus, Loader2, AlertCircle, ExternalLink,
  X, Check, Copy, Trash2, ChevronDown, ChevronUp,
} from "lucide-react";
import { useTopCoins, CoinMarketData } from "@/hooks/use-coingecko";
import { useWallet } from "@/hooks/use-wallet";
import { useSolanaBalance } from "@/hooks/use-solana-balance";
import { useCAPrices } from "@/hooks/use-ca-prices";
import { CATokenDetailModal } from "@/components/modals/CATokenDetailModal";
import { BuyModal, type BuyModalToken } from "@/components/modals/BuyModal";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// ─── CA detection ─────────────────────────────────────────────────────────────

function detectCA(s: string): "evm" | "solana" | null {
  const t = s.trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(t)) return "evm";
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(t) && !t.startsWith("0x")) return "solana";
  return null;
}

// ─── DexScreener lookup ───────────────────────────────────────────────────────

interface CustomCoin {
  id: string;
  name: string;
  symbol: string;
  image: string | null;
  address: string;
  chain: string;
  price: number;
  addedAt: number;
}

async function lookupCA(address: string): Promise<CustomCoin | null> {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${address.trim()}`,
      { signal: AbortSignal.timeout(7000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const pairs: any[] = data?.pairs ?? [];
    if (pairs.length === 0) return null;
    const best = pairs.reduce((a: any, b: any) =>
      (b.liquidity?.usd ?? 0) > (a.liquidity?.usd ?? 0) ? b : a
    );
    const base = best.baseToken;
    return {
      id: `ca:${base.address.toLowerCase()}`,
      name: base.name,
      symbol: base.symbol.toUpperCase(),
      image: best.info?.imageUrl ?? null,
      address: base.address,
      chain: best.chainId ?? "unknown",
      price: parseFloat(best.priceUsd ?? "0"),
      addedAt: Date.now(),
    };
  } catch { return null; }
}

const CHAIN_LABEL: Record<string, string> = {
  solana: "Solana", ethereum: "Ethereum", bsc: "BNB Chain",
  polygon: "Polygon", arbitrum: "Arbitrum", base: "Base",
  avalanche: "Avalanche", optimism: "Optimism", sui: "SUI",
};

// ─── localStorage helpers ─────────────────────────────────────────────────────

function storageKey(walletId: string) {
  return `neko_custom_coins_${walletId.toUpperCase()}`;
}
function loadCustomCoins(walletId: string): CustomCoin[] {
  try {
    const raw = localStorage.getItem(storageKey(walletId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveCustomCoins(walletId: string, coins: CustomCoin[]) {
  localStorage.setItem(storageKey(walletId), JSON.stringify(coins));
}

// ─── CA lookup hook ───────────────────────────────────────────────────────────

type CAState = { loading: boolean; token: CustomCoin | null; error: string | null };
const CA_IDLE: CAState = { loading: false, token: null, error: null };

function useCALookup(query: string): CAState {
  const [state, setState] = useState<CAState>(CA_IDLE);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const t = query.trim();
    if (!detectCA(t)) { setState(CA_IDLE); return; }
    setState({ loading: true, token: null, error: null });
    timerRef.current = setTimeout(async () => {
      const result = await lookupCA(t);
      setState(result
        ? { loading: false, token: result, error: null }
        : { loading: false, token: null, error: "Token not found on DexScreener" }
      );
    }, 600);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  return state;
}

// ─── Custom coin detail modal ─────────────────────────────────────────────────

function CustomCoinModal({
  coin,
  open,
  onOpenChange,
  onRemove,
}: {
  coin: CustomCoin | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onRemove: () => void;
}) {
  const { holdings } = useWallet();
  const [imgErr, setImgErr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [buyMode, setBuyMode] = useState<"buy" | "sell">("buy");

  if (!coin) return null;
  const held = holdings[coin.id] ?? 0;
  const value = held * coin.price;

  function Row({ label, value: v, cls = "text-white" }: { label: string; value: string; cls?: string }) {
    return (
      <div className="flex items-center justify-between border-b border-border/40 py-2">
        <span className="text-muted-foreground text-xs tracking-wider">{label}</span>
        <span className={cn("text-sm font-medium", cls)}>{v}</span>
      </div>
    );
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border border-primary/20 max-w-sm p-0 overflow-hidden">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] text-primary font-bold tracking-widest flex items-center gap-1">
              <ExternalLink className="w-3 h-3" />
              {CHAIN_LABEL[coin.chain] ?? coin.chain} · DEXSCREENER
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { onRemove(); onOpenChange(false); }}
                className="text-red-400 hover:text-red-300 transition-colors"
                title="Remove token"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center text-center mb-5">
            {coin.image && !imgErr ? (
              <img src={coin.image} alt={coin.name} className="w-16 h-16 rounded-full mb-3 ring-2 ring-primary/30 object-cover" onError={() => setImgErr(true)} />
            ) : (
              <div className="w-16 h-16 rounded-full mb-3 ring-2 ring-primary/30 bg-secondary/60 flex items-center justify-center text-xl font-black text-muted-foreground">
                {coin.symbol.slice(0, 2)}
              </div>
            )}
            <h3 className="text-xl font-bold tracking-wider text-white">{coin.name.toUpperCase()}</h3>
            <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">{coin.symbol}</p>
          </div>

          <div className="space-y-0 text-sm">
            <Row label="HOLDINGS" value={held.toFixed(6)} />
            <Row label="VALUE" value={`$${value.toFixed(4)}`} cls="text-green-500 font-bold" />
            <Row label="PRICE" value={coin.price > 0 ? `$${coin.price < 0.001 ? coin.price.toFixed(8) : coin.price.toLocaleString("en-US", { maximumFractionDigits: 6 })}` : "—"} />
            <Row label="CHAIN" value={CHAIN_LABEL[coin.chain] ?? coin.chain} cls="text-primary font-bold" />
            <div className="flex items-center justify-between border-b border-border/40 py-2">
              <span className="text-muted-foreground text-xs tracking-wider">CONTRACT</span>
              <button
                onClick={() => { navigator.clipboard.writeText(coin.address); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                className="flex items-center gap-1.5 text-white text-xs font-mono hover:text-primary transition-colors"
              >
                {coin.address.slice(0, 6)}…{coin.address.slice(-4)}
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-5">
            <Button
              onClick={() => { setBuyMode("buy"); setBuyOpen(true); }}
              className="rounded-full font-bold tracking-wider bg-green-600 hover:bg-green-700 text-white"
            >
              BUY
            </Button>
            <Button
              onClick={() => { setBuyMode("sell"); setBuyOpen(true); }}
              className="rounded-full font-bold tracking-wider bg-red-700 hover:bg-red-800 text-white"
            >
              SELL
            </Button>
          </div>

          <a
            href={`https://dexscreener.com/${coin.chain}/${coin.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <ExternalLink className="w-3 h-3" /> View on DexScreener
          </a>
        </div>
      </DialogContent>
    </Dialog>

    {coin && (
      <BuyModal
        open={buyOpen}
        onOpenChange={setBuyOpen}
        initialReceiveToken={buyMode === "buy" ? ({
          id: coin.id, name: coin.name, symbol: coin.symbol,
          image: coin.image ?? null, price: coin.price,
          address: coin.address, chain: coin.chain,
        } satisfies BuyModalToken) : undefined}
        initialPayToken={buyMode === "sell" ? ({
          id: coin.id, name: coin.name, symbol: coin.symbol,
          image: coin.image ?? null, price: coin.price,
          address: coin.address, chain: coin.chain,
        } satisfies BuyModalToken) : undefined}
      />
    )}
    </>
  );
}

// ─── CA result card ───────────────────────────────────────────────────────────

function CAResultCard({
  caState,
  alreadyAdded,
  onAdd,
  compact = false,
}: {
  caState: CAState;
  alreadyAdded: boolean;
  onAdd: (coin: CustomCoin) => void;
  compact?: boolean;
}) {
  const [imgErr, setImgErr] = useState(false);

  if (caState.loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span className="text-sm">Searching DexScreener…</span>
      </div>
    );
  }
  if (caState.error) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
        <AlertCircle className="w-5 h-5 text-red-400" />
        <p className="text-sm text-red-400">{caState.error}</p>
        <p className="text-xs text-center px-4 text-muted-foreground">Check the address and make sure the token is listed on DexScreener.</p>
      </div>
    );
  }
  if (!caState.token) return null;

  const coin = caState.token;
  return (
    <div className={cn("border border-primary/30 rounded-xl p-3 bg-primary/5", compact ? "mb-2" : "mb-4")}>
      <div className="flex items-center gap-1.5 mb-2">
        <ExternalLink className="w-3 h-3 text-primary" />
        <span className="text-[10px] text-primary font-bold tracking-wider">FOUND ON DEXSCREENER</span>
        <span className="text-[10px] text-muted-foreground">· {CHAIN_LABEL[coin.chain] ?? coin.chain}</span>
      </div>
      <div className="flex items-center gap-3">
        {coin.image && !imgErr ? (
          <img src={coin.image} alt={coin.name} className="w-10 h-10 rounded-full shrink-0 object-cover" onError={() => setImgErr(true)} />
        ) : (
          <div className="w-10 h-10 rounded-full shrink-0 bg-secondary/60 flex items-center justify-center text-sm font-black text-muted-foreground">
            {coin.symbol.slice(0, 2)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white">{coin.name}</div>
          <div className="text-xs text-muted-foreground font-mono">
            {coin.symbol} · {coin.address.slice(0, 6)}…{coin.address.slice(-4)}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-medium text-white">
            {coin.price > 0
              ? `$${coin.price < 0.001 ? coin.price.toFixed(8) : coin.price.toLocaleString("en-US", { maximumFractionDigits: 6 })}`
              : "—"}
          </div>
          {alreadyAdded ? (
            <div className="flex items-center gap-1 text-[10px] text-green-500 justify-end mt-0.5">
              <Check className="w-2.5 h-2.5" /> Already added
            </div>
          ) : (
            <button
              onClick={() => onAdd(coin)}
              className="text-[10px] text-primary font-bold hover:underline mt-0.5"
            >
              + Add to wallet
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Request Coin Panel ───────────────────────────────────────────────────────

function RequestCoinPanel({
  customCoins,
  onAdd,
  onClose,
}: {
  customCoins: CustomCoin[];
  onAdd: (coin: CustomCoin) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const caState = useCALookup(query);
  const isCA = !!detectCA(query.trim());
  const alreadyAdded = caState.token ? customCoins.some(c => c.id === caState.token!.id) : false;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className="overflow-hidden mb-4"
    >
      <div className="p-4 rounded-xl bg-secondary/40 border border-primary/30">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-bold text-white">Add Token by Contract Address</div>
            <div className="text-xs text-muted-foreground mt-0.5">Paste any EVM (0x…) or Solana contract address</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 bg-card/60 rounded-lg border border-border/40 mb-3">
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Paste contract address (CA)…"
            className="bg-transparent text-sm text-white placeholder:text-muted-foreground outline-none flex-1 font-mono"
          />
          {caState.loading && <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />}
          {query && !caState.loading && (
            <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {isCA && (
          <CAResultCard
            caState={caState}
            alreadyAdded={alreadyAdded}
            onAdd={(coin) => { onAdd(coin); setQuery(""); }}
            compact
          />
        )}

        {!isCA && query.length > 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Enter a valid contract address (42-char EVM 0x… or 32–44 char Solana base58)
          </p>
        )}

        {!query && (
          <p className="text-xs text-muted-foreground text-center py-1">
            Supports all chains: Solana, Ethereum, Base, BSC, Polygon, Arbitrum, and more
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ─── Custom coin grid card ────────────────────────────────────────────────────

function CustomCoinCard({
  coin, held, index, onClick,
}: { coin: CustomCoin; held: number; index: number; onClick: () => void }) {
  const [imgErr, setImgErr] = useState(false);
  const value = held * coin.price;
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      onClick={onClick}
      className="flex items-center gap-3 p-3 bg-secondary/30 hover:bg-secondary/60 border border-primary/20 hover:border-primary/50 rounded-xl transition-all text-left group relative overflow-hidden"
    >
      <div className="absolute top-1.5 right-1.5">
        <span className="text-[8px] text-primary font-bold tracking-wider px-1 py-0.5 rounded bg-primary/10 border border-primary/20">
          {(CHAIN_LABEL[coin.chain] ?? coin.chain).slice(0, 3).toUpperCase()}
        </span>
      </div>
      {coin.image && !imgErr ? (
        <img src={coin.image} alt={coin.name} className="w-9 h-9 rounded-full shrink-0 object-cover" onError={() => setImgErr(true)} />
      ) : (
        <div className="w-9 h-9 rounded-full shrink-0 bg-secondary/60 flex items-center justify-center text-xs font-black text-muted-foreground">
          {coin.symbol.slice(0, 2)}
        </div>
      )}
      <div className="flex-1 min-w-0 pr-6">
        <span className="text-sm font-bold text-white truncate block">{coin.name}</span>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{coin.symbol}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm text-white font-medium">{held.toFixed(4)}</div>
        <div className="text-[10px] text-muted-foreground">${value.toFixed(4)}</div>
      </div>
    </motion.button>
  );
}

// ─── main CoinGrid ─────────────────────────────────────────────────────────────

export function CoinGrid({ initialCount = 12 }: { initialCount?: number }) {
  const { data, isLoading } = useTopCoins();
  const { holdings, walletId, address, solBalance } = useWallet();
  const { data: chainSOL } = useSolanaBalance(address);
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [selectedCustom, setSelectedCustom] = useState<CustomCoin | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [customCoins, setCustomCoins] = useState<CustomCoin[]>([]);
  const [caDetailId, setCaDetailId] = useState<string | null>(null);

  // Load custom coins from localStorage on mount / walletId change
  useEffect(() => {
    if (!walletId) return;
    setCustomCoins(loadCustomCoins(walletId));
  }, [walletId]);

  const addCustomCoin = useCallback((coin: CustomCoin) => {
    if (!walletId) return;
    setCustomCoins(prev => {
      if (prev.some(c => c.id === coin.id)) return prev;
      const next = [coin, ...prev];
      saveCustomCoins(walletId, next);
      return next;
    });
    setRequestOpen(false);
  }, [walletId]);

  const removeCustomCoin = useCallback((id: string) => {
    if (!walletId) return;
    setCustomCoins(prev => {
      const next = prev.filter(c => c.id !== id);
      saveCustomCoins(walletId, next);
      return next;
    });
  }, [walletId]);

  // Use full solBalance (on-chain + simulated) so Solana row matches AVAILABLE BALANCE
  const realSOL = solBalance > 0 ? solBalance : (chainSOL ?? 0);
  const solCoin = data?.find(c => c.id === "solana");
  const solPrice = solCoin?.current_price ?? 0;

  // Live prices for all CA tokens in holdings — polled from DexScreener every 60s.
  // This also auto-discovers orphaned CA tokens (swapped before metadata fix) and
  // persists fresh metadata back to localStorage.
  const caIds = Object.keys(holdings).filter(id => id.startsWith("ca:"));
  const liveCA = useCAPrices(caIds, walletId ?? null);

  // MY TOKENS — built from holdings directly (source of truth after every swap).
  // Priority: CoinGecko data > live DexScreener data > cached localStorage data.
  const myHeldTokens = Object.entries(holdings)
    .filter(([, amt]) => amt > 0)
    .map(([coinId, amt]) => {
      const cgCoin = data?.find(c => c.id === coinId);
      const live = liveCA[coinId];
      const customCoin = customCoins.find(c => c.id === coinId);

      // Friendly fallback for CA tokens whose metadata hasn't loaded yet
      const rawAddr = coinId.startsWith("ca:") ? coinId.slice(3) : null;
      const shortAddr = rawAddr ? `${rawAddr.slice(0, 4)}…${rawAddr.slice(-4)}` : null;

      return {
        id: coinId,
        name: cgCoin?.name ?? live?.name ?? customCoin?.name ?? (shortAddr ? `Token ${shortAddr}` : coinId),
        symbol: (cgCoin?.symbol ?? live?.symbol ?? customCoin?.symbol ?? (shortAddr ?? coinId)).toUpperCase(),
        image: cgCoin?.image ?? live?.image ?? customCoin?.image ?? null,
        price: cgCoin?.current_price ?? live?.price ?? customCoin?.price ?? 0,
        priceChange: cgCoin?.price_change_percentage_24h ?? live?.priceChange24h ?? null,
        held: amt,
      };
    });

  // CA lookup on the main search bar
  const caState = useCALookup(search);
  const isCA = !!detectCA(search.trim());
  const searchCAAlreadyAdded = caState.token ? customCoins.some(c => c.id === caState.token!.id) : false;

  // Filter CoinGecko coins
  const coins = data?.slice(0, 50) ?? [];
  const filteredCG = search && !isCA
    ? coins.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.symbol.toLowerCase().includes(search.toLowerCase())
      )
    : isCA ? [] : coins;

  // Filter custom coins by name/symbol
  const filteredCustom = search && !isCA
    ? customCoins.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.symbol.toLowerCase().includes(search.toLowerCase())
      )
    : isCA ? [] : customCoins;

  const totalFiltered = filteredCG.length + filteredCustom.length;
  const visibleCG = showAll ? filteredCG : filteredCG.slice(0, Math.max(0, initialCount - filteredCustom.length));
  const visibleCustom = filteredCustom.slice(0, showAll ? undefined : initialCount);

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center gap-3 mb-4">
        <div className="text-xs text-muted-foreground tracking-wider font-bold shrink-0">COINS</div>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setRequestOpen(false); }}
            placeholder="Search by CA or name"
            className="pl-9 h-9 bg-secondary/40 border-border/40 text-sm rounded-full"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {isCA && caState.loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary animate-spin" />
          )}
        </div>
        <Button
          onClick={() => { setRequestOpen(o => !o); setSearch(""); }}
          variant={requestOpen ? "default" : "secondary"}
          size="sm"
          className={cn(
            "rounded-full text-xs font-bold gap-1.5 flex-shrink-0 transition-all",
            requestOpen && "bg-primary text-primary-foreground"
          )}
        >
          {requestOpen ? <ChevronUp className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
          <span className="hidden sm:inline">REQUEST COIN</span>
        </Button>
      </div>

      {/* Request coin panel */}
      <AnimatePresence>
        {requestOpen && (
          <RequestCoinPanel
            customCoins={customCoins}
            onAdd={addCustomCoin}
            onClose={() => setRequestOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* CA lookup result in main search */}
      <AnimatePresence>
        {isCA && (caState.loading || caState.token || caState.error) && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            <CAResultCard
              caState={caState}
              alreadyAdded={searchCAAlreadyAdded}
              onAdd={addCustomCoin}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── My Tokens ── */}
      {!search && (realSOL > 0 || myHeldTokens.length > 0) && (
        <div className="mb-5">
          <div className="text-[10px] text-muted-foreground tracking-widest font-bold mb-2">MY TOKENS</div>
          <div className="space-y-2">
            {/* SOL row — always shown when there is a balance */}
            {(realSOL > 0 || solCoin) && (
              <button
                onClick={() => setLocation("/coin/solana")}
                className="w-full flex items-center gap-3 p-3 bg-secondary/30 hover:bg-secondary/60 border border-primary/20 hover:border-primary/50 rounded-xl transition-all text-left"
              >
                {solCoin ? (
                  <img src={solCoin.image} alt="SOL" className="w-9 h-9 rounded-full shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full shrink-0 bg-violet-600/30 flex items-center justify-center text-xs font-black text-violet-300">SOL</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-white">Solana</span>
                    <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[9px] font-bold tracking-wider">SOL</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {realSOL > 0 ? `${realSOL.toFixed(4)} SOL` : "—"}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm text-white font-medium">
                    ${(realSOL * solPrice).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  {solCoin && (
                    <div className={cn("text-[10px] font-medium", (solCoin.price_change_percentage_24h ?? 0) >= 0 ? "text-green-400" : "text-red-400")}>
                      {(solCoin.price_change_percentage_24h ?? 0) >= 0 ? "+" : ""}{(solCoin.price_change_percentage_24h ?? 0).toFixed(2)}%
                    </div>
                  )}
                </div>
              </button>
            )}

            {/* All other held tokens — derived from holdings directly */}
            {myHeldTokens.map(token => {
              const value = token.held * token.price;
              const isCGCoin = !!data?.find(c => c.id === token.id);
              const isCA = token.id.startsWith("ca:");
              return (
                <button
                  key={token.id}
                  onClick={() => {
                    if (isCGCoin) setLocation(`/coin/${token.id}`);
                    else if (isCA) setCaDetailId(token.id);
                  }}
                  className="w-full flex items-center gap-3 p-3 bg-secondary/30 hover:bg-secondary/60 border border-border/40 hover:border-primary/30 rounded-xl transition-all text-left"
                >
                  {token.image ? (
                    <img src={token.image} alt={token.name} className="w-9 h-9 rounded-full shrink-0 object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full shrink-0 bg-secondary/60 flex items-center justify-center text-xs font-black text-muted-foreground">
                      {token.symbol.slice(0, 3)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-bold text-white truncate block">{token.name}</span>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{token.symbol}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm text-white font-medium">
                      ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-[10px] text-muted-foreground">
                        {token.held < 0.0001
                          ? token.held.toFixed(8)
                          : token.held.toFixed(4)} {token.symbol}
                      </span>
                      {token.priceChange !== null && (
                        <span className={cn("text-[10px] font-medium", token.priceChange >= 0 ? "text-green-400" : "text-red-400")}>
                          {token.priceChange >= 0 ? "+" : ""}{token.priceChange.toFixed(2)}%
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── All Coins ── */}
      <div className="text-[10px] text-muted-foreground tracking-widest font-bold mb-2">
        {search ? "SEARCH RESULTS" : "ALL COINS"}
      </div>

      {/* Coin grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-[68px] rounded-xl bg-secondary/30 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <motion.div layout className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Custom coins (DexScreener-added) */}
            {visibleCustom.map((coin, i) => (
              <CustomCoinCard
                key={coin.id}
                coin={coin}
                held={holdings[coin.id] ?? 0}
                index={i}
                onClick={() => setSelectedCustom(coin)}
              />
            ))}

            {/* CoinGecko coins */}
            {visibleCG.map((coin, i) => {
              const held = holdings[coin.id] || 0;
              const value = held * coin.current_price;
              return (
                <motion.button
                  key={coin.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (visibleCustom.length + i) * 0.02 }}
                  onClick={() => setLocation(`/coin/${coin.id}`)}
                  className="flex items-center gap-3 p-3 bg-secondary/30 hover:bg-secondary/60 border border-border/40 hover:border-primary/30 rounded-xl transition-all text-left group"
                >
                  <img src={coin.image} alt={coin.name} className="w-9 h-9 rounded-full shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-white truncate">{coin.name}</span>
                      <span className="w-3 h-3 rounded-full bg-primary/20 border border-primary/50 shrink-0" />
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{coin.symbol}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm text-white font-medium">{held.toFixed(2)}</div>
                    <div className="text-[10px] text-muted-foreground">${value.toFixed(2)}</div>
                  </div>
                </motion.button>
              );
            })}

            {/* Empty state */}
            {!isCA && totalFiltered === 0 && !isLoading && (
              <div className="col-span-3 flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Search className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">No coins match "{search}"</p>
                <p className="text-xs mt-1">Try pasting a contract address to look up any token</p>
              </div>
            )}
          </motion.div>

          {totalFiltered > initialCount && !isCA && (
            <div className="mt-4 text-center">
              <button
                onClick={() => setShowAll(s => !s)}
                className="text-xs text-muted-foreground hover:text-primary tracking-widest font-bold py-3 px-6 border border-border/40 rounded-full hover:border-primary/40 transition-colors"
              >
                {showAll ? "SHOW LESS" : `SHOW MORE (${totalFiltered - initialCount} more)`}
              </button>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <CustomCoinModal
        coin={selectedCustom}
        open={!!selectedCustom}
        onOpenChange={(o) => !o && setSelectedCustom(null)}
        onRemove={() => { if (selectedCustom) removeCustomCoin(selectedCustom.id); }}
      />

      {caDetailId && (
        <CATokenDetailModal
          open={!!caDetailId}
          onOpenChange={(o) => { if (!o) setCaDetailId(null); }}
          tokenId={caDetailId}
          held={holdings[caDetailId] ?? 0}
          liveData={liveCA[caDetailId] ?? null}
        />
      )}
    </div>
  );
}
