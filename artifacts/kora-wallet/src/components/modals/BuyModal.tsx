import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, ChevronDown, ArrowUpDown, Search, Loader2, AlertCircle, ExternalLink, Zap } from "lucide-react";
import { useWallet } from "@/hooks/use-wallet";
import { useTopCoins } from "@/hooks/use-coingecko";
import { useToast } from "@/hooks/use-toast";
import { addActivity } from "@/lib/activity";
import { Logo } from "@/components/Logo";
import { motion, AnimatePresence } from "framer-motion";
import {
  getSwapQuote, buildSwapTransaction, getTokenInfo, formatTokenAmount,
  TOKEN_MINTS, type JupiterQuote,
} from "@/lib/jupiter";
import { signVersionedTransaction, sendRawTransaction, getMintDecimals } from "@/lib/solana-tx";
import { TxSignModal, type TxDetail } from "./TxSignModal";

// ─── token model ──────────────────────────────────────────────────────────────

interface SwapToken {
  id: string;
  name: string;
  symbol: string;
  image: string | null;
  price: number;
  balance: number;
  chain?: string;
  address?: string;
}

const NEKO_ID = "neko";

// Known CoinGecko IDs → Solana mint addresses + decimals
const SOLANA_MINT_MAP: Record<string, { mint: string; decimals: number }> = {
  [NEKO_ID]:                     { mint: TOKEN_MINTS.SOL,    decimals: 9 },
  "solana":                      { mint: TOKEN_MINTS.SOL,    decimals: 9 },
  "usd-coin":                    { mint: TOKEN_MINTS.USDC,   decimals: 6 },
  "tether":                      { mint: TOKEN_MINTS.USDT,   decimals: 6 },
  "bonk":                        { mint: TOKEN_MINTS.BONK,   decimals: 5 },
  "jupiter-exchange-solana":     { mint: TOKEN_MINTS.JUP,    decimals: 6 },
  "dogwifcoin":                  { mint: TOKEN_MINTS.WIF,    decimals: 6 },
  "popcat":                      { mint: TOKEN_MINTS.POPCAT, decimals: 9 },
};

/** Get Solana mint + decimals for a token ID, or null if not on Solana */
async function getMintInfo(
  id: string,
  customTokens: Record<string, SwapToken>,
): Promise<{ mint: string; decimals: number } | null> {
  if (SOLANA_MINT_MAP[id]) return SOLANA_MINT_MAP[id];
  if (id.startsWith("ca:")) {
    const addr = id.slice(3);
    try {
      const info = await getTokenInfo(addr);
      if (info) return { mint: addr, decimals: info.decimals };
      const decimals = await getMintDecimals(addr);
      return { mint: addr, decimals };
    } catch { return null; }
  }
  return null;
}

function detectCA(s: string): "evm" | "solana" | null {
  const t = s.trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(t)) return "evm";
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(t) && !t.startsWith("0x")) return "solana";
  return null;
}

async function lookupCA(address: string): Promise<SwapToken | null> {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${address.trim()}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const pairs: any[] = data.pairs ?? [];
    if (!pairs.length) return null;
    const top = pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
    return {
      id: `ca:${address.toLowerCase()}`,
      name: top.baseToken?.name ?? "Unknown",
      symbol: top.baseToken?.symbol ?? "???",
      image: top.info?.imageUrl ?? null,
      price: parseFloat(top.priceUsd ?? "0") || 0,
      balance: 0,
      chain: top.chainId,
      address,
    };
  } catch { return null; }
}

const SOL_LOGO_URL = "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png";

// CoinGecko IDs that are real Solana SPL tokens (excludes "solana" since NEKO_ID represents it)
const SOLANA_CG_IDS = new Set([
  "usd-coin", "tether", "bonk", "jupiter-exchange-solana", "dogwifcoin", "popcat",
]);

function buildToken(
  id: string,
  coins: ReturnType<typeof useTopCoins>["data"],
  solBalance: number,
  holdings: Record<string, number>,
  customTokens: Record<string, SwapToken> = {}
): SwapToken {
  if (id === NEKO_ID) {
    const solData = coins?.find(c => c.id === "solana");
    return {
      id: NEKO_ID, name: "Solana", symbol: "SOL",
      image: solData?.image ?? SOL_LOGO_URL,
      price: solData?.current_price ?? 145,
      balance: solBalance,
    };
  }
  if (customTokens[id]) {
    return { ...customTokens[id], balance: holdings[id] ?? 0 };
  }
  const c = coins?.find((x) => x.id === id);
  return {
    id,
    name: c?.name ?? id,
    symbol: c?.symbol?.toUpperCase() ?? id.toUpperCase(),
    image: c?.image ?? null,
    price: c?.current_price ?? 0,
    balance: holdings[id] ?? 0,
  };
}

// ─── TokenLogo ────────────────────────────────────────────────────────────────

function TokenLogo({ token, size = 8 }: { token: SwapToken; size?: number }) {
  const [err, setErr] = useState(false);
  const px = `w-${size} h-${size}`;

  if (token.image && !err) {
    return (
      <img src={token.image} alt={token.name} className={`${px} rounded-full shrink-0 object-cover`} onError={() => setErr(true)} />
    );
  }
  return (
    <div className={`${px} rounded-full bg-secondary/60 flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground`}>
      {token.symbol.slice(0, 2)}
    </div>
  );
}

// ─── CoinPicker ───────────────────────────────────────────────────────────────

interface CoinPickerProps {
  open: boolean;
  onClose: () => void;
  coins: ReturnType<typeof useTopCoins>["data"];
  solBalance: number;
  holdings: Record<string, number>;
  customTokens: Record<string, SwapToken>;
  excludeId: string;
  onSelect: (id: string) => void;
  onRegisterToken: (token: SwapToken) => void;
}

const CHAIN_LABEL: Record<string, string> = {
  solana: "Solana", ethereum: "Ethereum", bsc: "BNB Chain",
  polygon: "Polygon", arbitrum: "Arbitrum", base: "Base",
  avalanche: "Avalanche", optimism: "Optimism",
};

function CoinPicker({
  open, onClose, coins, solBalance, holdings, customTokens,
  excludeId, onSelect, onRegisterToken,
}: CoinPickerProps) {
  const [search, setSearch] = useState("");
  const [caState, setCaState] = useState<{
    loading: boolean; token: SwapToken | null; error: string | null; query: string;
  }>({ loading: false, token: null, error: null, query: "" });
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) { setSearch(""); setCaState({ loading: false, token: null, error: null, query: "" }); return; }
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const t = search.trim();
    if (!detectCA(t)) { setCaState({ loading: false, token: null, error: null, query: "" }); return; }
    setCaState({ loading: true, token: null, error: null, query: t });
    debounceRef.current = setTimeout(async () => {
      const result = await lookupCA(t);
      if (result) {
        setCaState({ loading: false, token: result, error: null, query: t });
      } else {
        setCaState({ loading: false, token: null, error: "Token not found on DexScreener", query: t });
      }
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const isCA = !!detectCA(search.trim());
  const nekoToken = buildToken(NEKO_ID, coins, solBalance, holdings, customTokens);
  // Only include real Solana SPL tokens from CoinGecko (not BTC, ETH, etc.)
  const cgTokens = (coins ?? [])
    .filter(c => SOLANA_CG_IDS.has(c.id))
    .map((c) => buildToken(c.id, coins, solBalance, holdings, customTokens));
  // Custom tokens are always shown (they're SPL tokens from contract address)
  const customList = Object.values(customTokens);

  const allOptions: SwapToken[] = [nekoToken, ...customList, ...cgTokens]
    .filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i)
    .filter((t) => t.id !== excludeId);

  const filtered = isCA
    ? []
    : search
    ? allOptions.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.symbol.toLowerCase().includes(search.toLowerCase())
      )
    : allOptions;

  const handleSelectCA = () => {
    if (!caState.token) return;
    onRegisterToken(caState.token);
    onSelect(caState.token.id);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.14 }}
          className="absolute top-full left-0 right-0 mt-2 bg-card border border-primary/30 rounded-xl z-30 shadow-2xl overflow-hidden"
        >
          <div className="p-2 border-b border-border/40">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-secondary/60 rounded-lg">
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search token or paste contract address…"
                className="bg-transparent text-sm text-white placeholder:text-muted-foreground outline-none flex-1 min-w-0"
              />
              {caState.loading && <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />}
            </div>
            {isCA && !caState.loading && (
              <p className="text-[10px] text-primary mt-1.5 px-1">
                Contract address detected — looking up on DexScreener…
              </p>
            )}
          </div>
          <div className="max-h-56 overflow-auto">
            {isCA && (
              <>
                {caState.loading && (
                  <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Searching DexScreener…</span>
                  </div>
                )}
                {!caState.loading && caState.error && (
                  <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <p className="text-sm text-red-400">{caState.error}</p>
                  </div>
                )}
                {!caState.loading && caState.token && (
                  <div>
                    <div className="px-3 pt-2 pb-1">
                      <span className="text-[10px] text-primary font-bold tracking-wider flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> FOUND ON DEXSCREENER
                        {caState.token.chain && (
                          <span className="ml-1 text-muted-foreground normal-case font-normal">
                            · {CHAIN_LABEL[caState.token.chain] ?? caState.token.chain}
                          </span>
                        )}
                      </span>
                    </div>
                    <button
                      onClick={handleSelectCA}
                      className="w-full flex items-center gap-3 px-3 py-3 hover:bg-secondary/60 transition-colors text-left border border-primary/20 mx-2 rounded-xl mb-2 bg-primary/5"
                      style={{ width: "calc(100% - 1rem)" }}
                    >
                      <TokenLogo token={caState.token} size={9} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white font-bold">{caState.token.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {caState.token.symbol} · {caState.token.address?.slice(0, 6)}…{caState.token.address?.slice(-4)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm text-white font-medium">
                          ${caState.token.price > 0
                            ? caState.token.price < 0.001
                              ? caState.token.price.toFixed(8)
                              : caState.token.price.toLocaleString("en-US", { maximumFractionDigits: 4 })
                            : "—"}
                        </div>
                        <div className="text-[10px] text-primary">Tap to select</div>
                      </div>
                    </button>
                  </div>
                )}
              </>
            )}
            {!isCA && (
              <>
                {filtered.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-6">No results</div>
                )}
                {filtered.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { onSelect(t.id); onClose(); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/60 transition-colors text-left"
                  >
                    <TokenLogo token={t} size={7} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white font-bold truncate">{t.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.symbol}
                        {t.chain && <span className="ml-1 opacity-60">· {CHAIN_LABEL[t.chain] ?? t.chain}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-muted-foreground">
                        ${t.price > 0 ? t.price.toLocaleString("en-US", { maximumFractionDigits: 4 }) : "—"}
                      </div>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── BuyModal ─────────────────────────────────────────────────────────────────

export interface BuyModalToken {
  id: string;
  name: string;
  symbol: string;
  image: string | null;
  price: number;
  address?: string;
  chain?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialReceiveToken?: BuyModalToken | null;
  initialPayToken?: BuyModalToken | null;
}

export function BuyModal({ open, onOpenChange, initialReceiveToken, initialPayToken }: Props) {
  const {
    walletId, accounts, activeAccountId, address,
    solBalance, holdings, send, updateHoldings, deposit, syncSolBalance,
  } = useWallet();
  const { data: coins } = useTopCoins();
  const { toast } = useToast();

  const seedCustom = useCallback((): Record<string, SwapToken> => {
    const m: Record<string, SwapToken> = {};
    if (initialReceiveToken && initialReceiveToken.id !== NEKO_ID && !SOLANA_MINT_MAP[initialReceiveToken.id]) {
      m[initialReceiveToken.id] = { ...initialReceiveToken, balance: 0 };
    }
    if (initialPayToken && initialPayToken.id !== NEKO_ID && !SOLANA_MINT_MAP[initialPayToken.id]) {
      m[initialPayToken.id] = { ...initialPayToken, balance: 0 };
    }
    return m;
  }, [initialReceiveToken?.id, initialPayToken?.id]);

  const [payId, setPayId] = useState<string>(() => initialPayToken?.id ?? NEKO_ID);
  const [receiveId, setReceiveId] = useState<string>(() => initialReceiveToken?.id ?? "usd-coin");
  const [payAmount, setPayAmount] = useState("");
  const [payPickerOpen, setPayPickerOpen] = useState(false);
  const [receivePickerOpen, setReceivePickerOpen] = useState(false);
  const [switchRotate, setSwitchRotate] = useState(0);
  const [customTokens, setCustomTokens] = useState<Record<string, SwapToken>>(seedCustom);

  // ── Jupiter on-chain state ──────────────────────────────────────────────────
  const [payMint, setPayMint] = useState<{ mint: string; decimals: number } | null>(null);
  const [receiveMint, setReceiveMint] = useState<{ mint: string; decimals: number } | null>(null);
  const [quote, setQuote] = useState<JupiterQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [txDetails, setTxDetails] = useState<TxDetail[]>([]);
  const pendingQuoteRef = useRef<JupiterQuote | null>(null);

  // Active account's private key for signing
  const activeAccount = accounts.find(a => a.id === activeAccountId);
  const privateKey = activeAccount?.privateKey ?? null;

  // ── Modal open: apply initial tokens ───────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (initialReceiveToken) {
      setReceiveId(initialReceiveToken.id);
      setCustomTokens(prev => ({ ...prev, [initialReceiveToken.id]: { ...initialReceiveToken, balance: 0 } }));
    } else {
      setReceiveId("usd-coin");
    }
    if (initialPayToken) {
      setPayId(initialPayToken.id);
      setCustomTokens(prev => ({ ...prev, [initialPayToken.id]: { ...initialPayToken, balance: 0 } }));
    } else {
      setPayId(NEKO_ID);
    }
    setPayAmount("");
    setQuote(null);
    setQuoteError(null);
  }, [open, initialReceiveToken?.id, initialPayToken?.id]);

  const registerToken = useCallback((t: SwapToken) => {
    setCustomTokens((prev) => ({ ...prev, [t.id]: t }));
  }, []);

  // ── Resolve mint info whenever token selection changes ──────────────────────
  useEffect(() => {
    getMintInfo(payId, customTokens).then(setPayMint);
  }, [payId]);

  useEffect(() => {
    getMintInfo(receiveId, customTokens).then(setReceiveMint);
  }, [receiveId]);

  // Whether this is a real Solana-on-chain swap
  const isSolanaSwap = !!payMint && !!receiveMint && payMint.mint !== receiveMint.mint;

  // ── Debounced Jupiter quote fetching ───────────────────────────────────────
  useEffect(() => {
    if (!isSolanaSwap || !payMint || !receiveMint) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) { setQuote(null); return; }

    const amtRaw = amt * Math.pow(10, payMint.decimals);
    setQuoteLoading(true);
    setQuoteError(null);

    const timer = setTimeout(async () => {
      try {
        const q = await getSwapQuote(payMint.mint, receiveMint.mint, amtRaw);
        setQuote(q);
      } catch (e) {
        setQuoteError((e as Error).message.slice(0, 80));
        setQuote(null);
      } finally {
        setQuoteLoading(false);
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [payAmount, payMint, receiveMint, isSolanaSwap]);

  const payToken = buildToken(payId, coins, solBalance, holdings, customTokens);
  const receiveToken = buildToken(receiveId, coins, solBalance, holdings, customTokens);

  const payNum = parseFloat(payAmount) || 0;

  // Show Jupiter output when available, otherwise fall back to price estimate
  const jupiterReceiveNum = quote && receiveMint
    ? Number(quote.outAmount) / Math.pow(10, receiveMint.decimals)
    : null;
  const priceReceiveNum =
    payToken.price > 0 && receiveToken.price > 0
      ? (payNum * payToken.price) / receiveToken.price
      : 0;
  const receiveNum = jupiterReceiveNum ?? priceReceiveNum;

  const rate =
    payToken.price > 0 && receiveToken.price > 0
      ? payToken.price / receiveToken.price
      : null;

  const handleSwitch = () => {
    setPayId(receiveId);
    setReceiveId(payId);
    setPayAmount(receiveNum > 0 ? receiveNum.toFixed(6) : "");
    setSwitchRotate((r) => r + 180);
    setPayPickerOpen(false);
    setReceivePickerOpen(false);
    setQuote(null);
  };

  // ── Persist CA metadata to localStorage ────────────────────────────────────
  const persistCAMetadata = useCallback(() => {
    if (!walletId) return;
    const caKey = `neko_custom_coins_${walletId.toUpperCase()}`;
    const tokensToSave = [payToken, receiveToken].filter(
      t => t.id.startsWith("ca:") && customTokens[t.id],
    );
    if (!tokensToSave.length) return;
    try {
      const existing: any[] = JSON.parse(localStorage.getItem(caKey) ?? "[]");
      let updated = [...existing];
      for (const t of tokensToSave) {
        if (!updated.some(c => c.id === t.id)) {
          updated = [{
            id: t.id, name: t.name, symbol: t.symbol,
            image: t.image ?? null,
            address: (t as any).address ?? t.id.replace("ca:", ""),
            chain: (t as any).chain ?? "unknown",
            price: t.price, addedAt: Date.now(),
          }, ...updated];
        }
      }
      localStorage.setItem(caKey, JSON.stringify(updated));
    } catch { /* ignore */ }
  }, [walletId, payToken, receiveToken, customTokens]);

  // ── Execute on-chain swap (called by TxSignModal) ──────────────────────────
  const executeSwap = async (): Promise<string> => {
    if (!address || !privateKey || !pendingQuoteRef.current || !receiveMint) {
      throw new Error("Missing wallet data");
    }
    const q = pendingQuoteRef.current;

    const { swapTransaction } = await buildSwapTransaction(q, address);
    const signedTx = signVersionedTransaction(swapTransaction, privateKey);
    const signature = await sendRawTransaction(signedTx);

    // Log activity
    if (walletId) {
      addActivity(walletId, {
        type: "swap", status: "completed", accountId: walletId,
        symbol: payToken.symbol, amount: payNum,
        usdValue: payNum * (payToken.price ?? 0),
        toSymbol: receiveToken.symbol,
        toAmount: Number(q.outAmount) / Math.pow(10, receiveMint.decimals),
        txSignature: signature,
      });
    }
    persistCAMetadata();
    setTimeout(() => syncSolBalance(0), 3000);
    return signature;
  };

  // ── handleSwap: route to on-chain or simulated ─────────────────────────────
  const handleSwap = () => {
    if (payNum <= 0) { toast({ title: "Enter an amount", variant: "destructive" }); return; }
    if (payNum > payToken.balance) { toast({ title: `Insufficient ${payToken.symbol} balance`, variant: "destructive" }); return; }

    // ── Real on-chain via Jupiter ─────────────────────────────────────────────
    if (isSolanaSwap && quote && payMint && receiveMint && address && privateKey) {
      const outAmt = Number(quote.outAmount) / Math.pow(10, receiveMint.decimals);
      const impact = parseFloat(quote.priceImpactPct || "0");
      setTxDetails([
        { label: "FROM",           value: `${payNum} ${payToken.symbol}` },
        { label: "TO (ESTIMATED)", value: `${formatTokenAmount(quote.outAmount, receiveMint.decimals)} ${receiveToken.symbol}`, highlight: true },
        { label: "PRICE IMPACT",   value: `${impact.toFixed(3)}%`, danger: impact > 2 },
        { label: "SLIPPAGE",       value: `${(quote.slippageBps / 100).toFixed(1)}%` },
        { label: "MINIMUM OUT",    value: `${formatTokenAmount(quote.otherAmountThreshold, receiveMint.decimals)} ${receiveToken.symbol}` },
        { label: "ROUTE",          value: quote.routePlan.map(r => r.swapInfo.label).join(" → ") || "Jupiter" },
        { label: "NETWORK FEE",    value: "~0.000005 SOL" },
      ]);
      pendingQuoteRef.current = quote;
      setSignOpen(true);
      return;
    }

    // ── Simulated fallback (cross-chain or non-Solana tokens) ─────────────────
    if (receiveNum <= 0) { toast({ title: "Cannot determine exchange rate", variant: "destructive" }); return; }

    if (payId === NEKO_ID) { send(payNum, "swap"); } else { updateHoldings(payId, -payNum); }
    if (receiveId === NEKO_ID) { deposit(receiveNum); } else { updateHoldings(receiveId, receiveNum); }
    persistCAMetadata();

    if (walletId) {
      addActivity(walletId, {
        type: "swap", status: "completed", accountId: walletId,
        symbol: payToken.symbol, amount: payNum,
        usdValue: payNum * (payToken.price ?? 0),
        toSymbol: receiveToken.symbol, toAmount: receiveNum,
      });
    }
    toast({
      title: "Swap successful",
      description: `${payNum.toFixed(4)} ${payToken.symbol} → ${receiveNum.toFixed(4)} ${receiveToken.symbol}`,
    });
    setPayAmount("");
    onOpenChange(false);
  };

  const handleClose = () => {
    setPayAmount("");
    setPayPickerOpen(false);
    setReceivePickerOpen(false);
    setQuote(null);
    setQuoteError(null);
    onOpenChange(false);
  };

  const canSwap = payNum > 0 && payNum <= payToken.balance && (
    isSolanaSwap ? (!!quote && !quoteLoading) : (receiveNum > 0)
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-sm p-0 bg-card border border-primary/20 overflow-visible gap-0" style={{ boxShadow: "0 0 40px rgba(225,243,17,0.08)" }}>
          <DialogTitle className="sr-only">Swap</DialogTitle>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
            <div className="text-[10px] text-muted-foreground tracking-widest font-bold">SWAP</div>
            {isSolanaSwap && (
              <div className="flex items-center gap-1 text-[9px] text-emerald-400 font-bold tracking-wider">
                <Zap className="w-2.5 h-2.5" />
                MAINNET · JUPITER
              </div>
            )}
            <button onClick={handleClose} className="text-muted-foreground hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Swap body */}
          <div className="p-4 space-y-1">

            {/* YOU PAY */}
            <div className="p-4 rounded-xl bg-secondary/40 border border-border/40 relative">
              <div className="text-[10px] text-muted-foreground font-bold tracking-wider mb-2">YOU PAY</div>
              <div className="flex items-center gap-2">
                <TokenLogo token={payToken} size={8} />
                <Input
                  type="number"
                  value={payAmount}
                  onChange={(e) => { setPayAmount(e.target.value); setQuote(null); }}
                  placeholder="0"
                  className="flex-1 bg-transparent border-0 h-9 text-2xl font-bold text-white p-0 focus-visible:ring-0"
                />
                <button
                  onClick={() => setPayAmount(payToken.balance.toString())}
                  className="text-[10px] px-2 py-1 rounded-full bg-primary/20 text-primary font-bold shrink-0 hover:bg-primary/30 transition-colors"
                >
                  MAX
                </button>
                <button
                  onClick={() => { setPayPickerOpen((o) => !o); setReceivePickerOpen(false); }}
                  className="flex items-center gap-1 shrink-0 px-2.5 py-1.5 rounded-xl bg-secondary/60 hover:bg-secondary/80 transition-colors border border-border/30"
                >
                  <span className="text-sm font-bold text-white">{payToken.symbol}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
              <div className="text-xs text-muted-foreground mt-1.5 flex items-center justify-between">
                <span>Balance: {payToken.balance.toFixed(4)} {payToken.symbol}</span>
                {payNum > 0 && payToken.price > 0 && (
                  <span>≈ ${(payNum * payToken.price).toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
                )}
              </div>
              <CoinPicker
                open={payPickerOpen}
                onClose={() => setPayPickerOpen(false)}
                coins={coins}
                solBalance={solBalance}
                holdings={holdings}
                customTokens={customTokens}
                excludeId={receiveId}
                onSelect={(id) => { setPayId(id); setPayAmount(""); setQuote(null); }}
                onRegisterToken={registerToken}
              />
            </div>

            {/* Switch button */}
            <div className="flex justify-center py-1 relative z-10">
              <motion.button
                onClick={handleSwitch}
                animate={{ rotate: switchRotate }}
                transition={{ type: "spring", stiffness: 320, damping: 22 }}
                className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
              >
                <ArrowUpDown className="w-4 h-4 text-primary-foreground" />
              </motion.button>
            </div>

            {/* YOU RECEIVE */}
            <div className="p-4 rounded-xl bg-secondary/40 border border-border/40 relative">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] text-muted-foreground font-bold tracking-wider">YOU RECEIVE</div>
                {quoteLoading && (
                  <div className="flex items-center gap-1 text-[9px] text-primary">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    Fetching quote…
                  </div>
                )}
                {jupiterReceiveNum !== null && !quoteLoading && (
                  <div className="text-[9px] text-emerald-400 font-bold tracking-wider">LIVE QUOTE</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <TokenLogo token={receiveToken} size={8} />
                <span className="text-2xl font-bold text-white flex-1">
                  {quoteLoading
                    ? <span className="text-muted-foreground text-lg">···</span>
                    : receiveNum > 0 ? receiveNum.toFixed(6) : "0"}
                </span>
                <button
                  onClick={() => { setReceivePickerOpen((o) => !o); setPayPickerOpen(false); }}
                  className="flex items-center gap-1 shrink-0 px-2.5 py-1.5 rounded-xl bg-secondary/60 hover:bg-secondary/80 transition-colors border border-border/30"
                >
                  <span className="text-sm font-bold text-white">{receiveToken.symbol}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
              {receiveNum > 0 && receiveToken.price > 0 && (
                <div className="text-xs text-muted-foreground mt-1.5 flex justify-end">
                  ≈ ${(receiveNum * receiveToken.price).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </div>
              )}
              {quoteError && (
                <div className="mt-1.5 flex items-center gap-1 text-[10px] text-red-400">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {quoteError}
                </div>
              )}
              <CoinPicker
                open={receivePickerOpen}
                onClose={() => setReceivePickerOpen(false)}
                coins={coins}
                solBalance={solBalance}
                holdings={holdings}
                customTokens={customTokens}
                excludeId={payId}
                onSelect={(id) => { setReceiveId(id); setQuote(null); }}
                onRegisterToken={registerToken}
              />
            </div>

            {/* Route / rate hint */}
            {isSolanaSwap && quote && !quoteLoading && (
              <div className="text-[10px] text-muted-foreground text-center py-0.5">
                via {quote.routePlan.map(r => r.swapInfo.label).join(" → ") || "Jupiter"} · {(quote.slippageBps / 100).toFixed(1)}% slippage
              </div>
            )}
            {!isSolanaSwap && rate !== null && payToken.price > 0 && (
              <div className="text-[11px] text-muted-foreground text-center py-0.5">
                1 {payToken.symbol} ≈ {rate.toFixed(6)} {receiveToken.symbol}
              </div>
            )}

            {/* Watch-only warning */}
            {isSolanaSwap && !privateKey && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <p className="text-[10px] text-amber-300">Watch-only account — cannot sign transactions.</p>
              </div>
            )}

            <Button
              onClick={handleSwap}
              disabled={!canSwap || (isSolanaSwap && !privateKey)}
              className="w-full rounded-full font-bold tracking-wider bg-gradient-to-r from-primary to-[#8a9500] hover:opacity-90 text-primary-foreground mt-2 disabled:opacity-40"
            >
              {isSolanaSwap && quote
                ? `SIGN & SWAP ${payToken.symbol} → ${receiveToken.symbol}`
                : `SWAP ${payToken.symbol} → ${receiveToken.symbol}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* On-chain signing modal */}
      <TxSignModal
        open={signOpen}
        onOpenChange={setSignOpen}
        title={`SIGN SWAP · ${payToken.symbol} → ${receiveToken.symbol}`}
        details={txDetails}
        onConfirm={executeSwap}
        onSuccess={(sig) => {
          setSignOpen(false);
          handleClose();
          toast({
            title: "Swap confirmed on-chain!",
            description: `Signature: ${sig.slice(0, 12)}…`,
          });
        }}
      />
    </>
  );
}
