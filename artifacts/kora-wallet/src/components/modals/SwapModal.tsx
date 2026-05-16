/**
 * Real on-chain swap modal using Jupiter Aggregator.
 * Fetches quote → shows TxSignModal for approval → signs versioned tx → submits.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ArrowDownUp, Loader2, ChevronDown, AlertTriangle, Lock,
} from "lucide-react";
import { useWallet } from "@/hooks/use-wallet";
import { useToast } from "@/hooks/use-toast";
import { addActivity } from "@/lib/activity";
import {
  getSwapQuote, buildSwapTransaction, getTokenInfo, formatTokenAmount,
  TOKEN_MINTS, type JupiterQuote, type JupiterToken,
} from "@/lib/jupiter";
import { signVersionedTransaction, sendRawTransaction } from "@/lib/solana-tx";
import { TxSignModal, type TxDetail } from "./TxSignModal";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TokenOption {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  balance?: number;
}

interface DisplayToken {
  symbol: string;
  name: string;
  logoURI: string;
  mint?: string;
  decimals?: number;
  available: boolean;
}

type BuyChain = "solana" | "ethereum" | "base";

const SOL_DECIMALS = 9;
const SOL_MINT = TOKEN_MINTS.SOL;

const SOLANA_TOKENS: TokenOption[] = [
  {
    mint: TOKEN_MINTS.SOL, symbol: "SOL", name: "Solana", decimals: 9,
    logoURI: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
  },
  {
    mint: TOKEN_MINTS.USDC, symbol: "USDC", name: "USD Coin", decimals: 6,
    logoURI: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
  },
  {
    mint: TOKEN_MINTS.USDT, symbol: "USDT", name: "Tether", decimals: 6,
    logoURI: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
  },
  {
    mint: TOKEN_MINTS.BONK, symbol: "BONK", name: "Bonk", decimals: 5,
    logoURI: "https://assets.coingecko.com/coins/images/28600/small/bonk.jpg",
  },
  {
    mint: TOKEN_MINTS.JUP, symbol: "JUP", name: "Jupiter", decimals: 6,
    logoURI: "https://assets.coingecko.com/coins/images/34529/small/jup.png",
  },
  {
    mint: TOKEN_MINTS.WIF, symbol: "WIF", name: "dogwifhat", decimals: 6,
    logoURI: "https://assets.coingecko.com/coins/images/33566/small/dogwifhat.jpg",
  },
  {
    mint: TOKEN_MINTS.POPCAT, symbol: "POPCAT", name: "Popcat", decimals: 9,
    logoURI: "https://assets.coingecko.com/coins/images/33760/small/popcat.jpg",
  },
];

const ETH_TOKENS: DisplayToken[] = [
  { symbol: "ETH",  name: "Ethereum",      logoURI: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",                    available: false },
  { symbol: "USDC", name: "USD Coin",       logoURI: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",                       available: false },
  { symbol: "USDT", name: "Tether",         logoURI: "https://assets.coingecko.com/coins/images/325/small/Tether.png",                      available: false },
  { symbol: "WBTC", name: "Wrapped Bitcoin",logoURI: "https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png",       available: false },
  { symbol: "LINK", name: "Chainlink",      logoURI: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png",          available: false },
  { symbol: "UNI",  name: "Uniswap",        logoURI: "https://assets.coingecko.com/coins/images/12504/small/uniswap-uni.png",               available: false },
  { symbol: "AAVE", name: "Aave",           logoURI: "https://assets.coingecko.com/coins/images/12645/small/AAVE.png",                      available: false },
  { symbol: "DAI",  name: "Dai",            logoURI: "https://assets.coingecko.com/coins/images/9956/small/4943.png",                       available: false },
];

const BASE_TOKENS: DisplayToken[] = [
  { symbol: "ETH",   name: "Ethereum",      logoURI: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",                    available: false },
  { symbol: "USDC",  name: "USD Coin",       logoURI: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",                       available: false },
  { symbol: "USDT",  name: "Tether",         logoURI: "https://assets.coingecko.com/coins/images/325/small/Tether.png",                      available: false },
  { symbol: "cbBTC", name: "Coinbase BTC",   logoURI: "https://assets.coingecko.com/coins/images/39239/small/cbbtc.webp",                    available: false },
  { symbol: "AERO",  name: "Aerodrome",      logoURI: "https://assets.coingecko.com/coins/images/31745/small/token.png",                     available: false },
  { symbol: "BRETT", name: "Brett",          logoURI: "https://assets.coingecko.com/coins/images/35529/small/Brett.png",                     available: false },
  { symbol: "VIRTUAL","name": "Virtuals",    logoURI: "https://assets.coingecko.com/coins/images/34738/small/virtual.jpg",                   available: false },
];

const CHAIN_META: Record<BuyChain, { label: string; color: string; dotColor: string }> = {
  solana:   { label: "Solana",   color: "text-purple-400",  dotColor: "bg-purple-500"  },
  ethereum: { label: "Ethereum", color: "text-blue-400",    dotColor: "bg-blue-500"    },
  base:     { label: "Base",     color: "text-blue-300",    dotColor: "bg-blue-400"    },
};

function TokenLogo({ symbol, logoURI, size = 8 }: { symbol: string; logoURI?: string; size?: number }) {
  const [err, setErr] = useState(false);
  const cls = `w-${size} h-${size} rounded-full shrink-0 object-cover`;
  if (logoURI && !err) {
    return <img src={logoURI} className={cls} onError={() => setErr(true)} alt={symbol} />;
  }
  return (
    <div className={`w-${size} h-${size} rounded-full shrink-0 bg-gradient-to-br from-primary/40 to-primary/10 flex items-center justify-center text-[9px] font-black text-primary`}>
      {symbol.slice(0, 3)}
    </div>
  );
}

export function SwapModal({ open, onOpenChange }: Props) {
  const { address, accounts, activeAccountId, solBalance, holdings, walletId, syncSolBalance } = useWallet();
  const { toast } = useToast();

  const [sellToken, setSellToken] = useState<TokenOption>(SOLANA_TOKENS[0]);
  const [buyToken, setBuyToken] = useState<TokenOption>(SOLANA_TOKENS[1]);
  const [sellAmount, setSellAmount] = useState("");
  const [caInput, setCaInput] = useState("");
  const [caLoading, setCaLoading] = useState(false);
  const [showBuyPicker, setShowBuyPicker] = useState(false);
  const [showSellPicker, setShowSellPicker] = useState(false);
  const [buyChain, setBuyChain] = useState<BuyChain>("solana");

  const [quote, setQuote] = useState<JupiterQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [signOpen, setSignOpen] = useState(false);
  const [txDetails, setTxDetails] = useState<TxDetail[]>([]);
  const pendingQuoteRef = useRef<JupiterQuote | null>(null);

  const getBalance = useCallback((token: TokenOption): number => {
    if (token.mint === SOL_MINT) return solBalance;
    const held = Object.entries(holdings).find(([id]) =>
      id.toLowerCase().includes(token.mint.toLowerCase().slice(0, 8))
    );
    return held?.[1] ?? 0;
  }, [solBalance, holdings]);

  const activeAccount = accounts.find(a => a.id === activeAccountId);
  const privateKey = activeAccount?.privateKey ?? null;

  useEffect(() => {
    const amt = parseFloat(sellAmount);
    if (!amt || amt <= 0 || !sellToken || !buyToken || sellToken.mint === buyToken.mint) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    const amtRaw = amt * Math.pow(10, sellToken.decimals);
    setQuoteLoading(true);
    setQuoteError(null);

    const timer = setTimeout(async () => {
      try {
        const q = await getSwapQuote(sellToken.mint, buyToken.mint, amtRaw);
        setQuote(q);
      } catch (e) {
        setQuoteError((e as Error).message);
        setQuote(null);
      } finally {
        setQuoteLoading(false);
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [sellAmount, sellToken, buyToken]);

  const flip = () => {
    setSellToken(buyToken);
    setBuyToken(sellToken);
    setSellAmount("");
    setQuote(null);
  };

  const handleLookupCA = async () => {
    if (!caInput.trim()) return;
    setCaLoading(true);
    try {
      const info = await getTokenInfo(caInput.trim());
      if (info) {
        const tok: TokenOption = {
          mint: info.address,
          symbol: info.symbol,
          name: info.name,
          decimals: info.decimals,
          logoURI: info.logoURI,
        };
        setBuyToken(tok);
        setShowBuyPicker(false);
        setCaInput("");
      } else {
        toast({ title: "Token not found", description: "Could not find token for that CA address", variant: "destructive" });
      }
    } finally {
      setCaLoading(false);
    }
  };

  const handleSwap = () => {
    if (!quote || !address || !privateKey) return;
    const sellAmt = parseFloat(sellAmount);
    const impact = parseFloat(quote.priceImpactPct || "0");

    setTxDetails([
      { label: "FROM",           value: `${sellAmt} ${sellToken.symbol}` },
      { label: "TO (ESTIMATED)", value: `${formatTokenAmount(quote.outAmount, buyToken.decimals)} ${buyToken.symbol}`, highlight: true },
      { label: "PRICE IMPACT",   value: `${impact.toFixed(3)}%`, danger: impact > 2 },
      { label: "SLIPPAGE",       value: `${(quote.slippageBps / 100).toFixed(1)}%` },
      { label: "MINIMUM OUT",    value: `${formatTokenAmount(quote.otherAmountThreshold, buyToken.decimals)} ${buyToken.symbol}` },
      { label: "ROUTE",          value: quote.routePlan.map(r => r.swapInfo.label).join(" → ") || "Jupiter" },
      { label: "NETWORK FEE",    value: "~0.000005 SOL" },
    ]);
    pendingQuoteRef.current = quote;
    setSignOpen(true);
  };

  const executeSwap = async (): Promise<string> => {
    if (!address || !privateKey || !pendingQuoteRef.current) throw new Error("Missing wallet data");
    const q = pendingQuoteRef.current;

    const { swapTransaction } = await buildSwapTransaction(q, address);
    const signedTxBase64 = signVersionedTransaction(swapTransaction, privateKey);
    const signature = await sendRawTransaction(signedTxBase64);

    const sellAmt = parseFloat(sellAmount);
    if (walletId) {
      addActivity(walletId, {
        type: "swap",
        status: "completed",
        accountId: walletId,
        symbol: sellToken.symbol,
        amount: sellAmt,
        usdValue: 0,
        toSymbol: buyToken.symbol,
        toAmount: Number(q.outAmount) / Math.pow(10, buyToken.decimals),
        txSignature: signature,
      });
    }

    setTimeout(() => syncSolBalance(0), 3000);
    return signature;
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(() => {
      setSellAmount("");
      setQuote(null);
      setQuoteError(null);
    }, 300);
  };

  const sellBalance = getBalance(sellToken);
  const sellAmt = parseFloat(sellAmount) || 0;
  const canSwap = !!quote && !quoteLoading && sellAmt > 0 && sellAmt <= sellBalance && !!privateKey;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => (o ? undefined : close())}>
        <DialogContent className="bg-[#0f0f14] border border-border/40 w-full max-w-sm p-0 gap-0">
          <DialogTitle className="sr-only">Swap Tokens</DialogTitle>

          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border/30">
            <span className="text-sm font-black tracking-widest text-white flex-1">SWAP</span>
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold mr-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              MAINNET • Jupiter
            </div>
            <button onClick={close} className="text-muted-foreground hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-3">

            {/* SELL box */}
            <div className="rounded-2xl border border-border/30 bg-secondary/20 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground tracking-widest font-bold">SELL</span>
                <button
                  onClick={() => setSellAmount(String(sellBalance))}
                  className="text-[10px] text-primary font-bold hover:underline"
                >
                  MAX: {sellBalance.toFixed(sellToken.decimals === 9 ? 4 : 2)} {sellToken.symbol}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={sellAmount}
                  onChange={e => setSellAmount(e.target.value)}
                  placeholder="0.00"
                  className="bg-transparent text-2xl font-bold text-white outline-none flex-1 min-w-0 w-0"
                />
                <button
                  onClick={() => { setShowSellPicker(!showSellPicker); setShowBuyPicker(false); }}
                  className="flex items-center gap-2 bg-secondary/60 hover:bg-secondary/80 rounded-full px-3 py-1.5 transition-colors shrink-0"
                >
                  <TokenLogo symbol={sellToken.symbol} logoURI={sellToken.logoURI} size={6} />
                  <span className="text-sm font-bold text-white">{sellToken.symbol}</span>
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Flip button */}
            <div className="flex justify-center -my-1">
              <button
                onClick={flip}
                className="w-8 h-8 rounded-full bg-secondary/60 hover:bg-secondary/80 border border-border/30 flex items-center justify-center transition-all hover:rotate-180 duration-300"
              >
                <ArrowDownUp className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>

            {/* BUY box */}
            <div className="rounded-2xl border border-border/30 bg-secondary/20 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground tracking-widest font-bold">BUY</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  {quoteLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Fetching quote…</span>
                    </div>
                  ) : quote ? (
                    <div>
                      <p className="text-2xl font-bold text-white">
                        {formatTokenAmount(quote.outAmount, buyToken.decimals)}
                      </p>
                      {parseFloat(quote.priceImpactPct) > 1 && (
                        <p className="text-[10px] text-amber-400 font-bold">
                          ⚠ {parseFloat(quote.priceImpactPct).toFixed(2)}% price impact
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-2xl font-bold text-muted-foreground/40">0.00</p>
                  )}
                </div>
                <button
                  onClick={() => { setShowBuyPicker(!showBuyPicker); setShowSellPicker(false); }}
                  className="flex items-center gap-2 bg-secondary/60 hover:bg-secondary/80 rounded-full px-3 py-1.5 transition-colors shrink-0"
                >
                  <TokenLogo symbol={buyToken.symbol} logoURI={buyToken.logoURI} size={6} />
                  <span className="text-sm font-bold text-white">{buyToken.symbol}</span>
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Token pickers */}
            <AnimatePresence>
              {showSellPicker && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-2xl border border-border/30 bg-secondary/20 p-3 space-y-1">
                    <p className="text-[10px] text-muted-foreground tracking-widest font-bold px-1 pb-1">
                      SELECT SELL TOKEN
                    </p>
                    {SOLANA_TOKENS.map(tok => (
                      <button
                        key={tok.mint}
                        onClick={() => { setSellToken(tok); setShowSellPicker(false); setQuote(null); }}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-secondary/40 rounded-xl transition-colors text-left"
                      >
                        <TokenLogo symbol={tok.symbol} logoURI={tok.logoURI} size={7} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white">{tok.symbol}</p>
                          <p className="text-[10px] text-muted-foreground">{tok.name}</p>
                        </div>
                        {tok.mint === SOL_MINT && (
                          <span className="text-[10px] text-muted-foreground shrink-0">{solBalance.toFixed(4)} SOL</span>
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {showBuyPicker && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-2xl border border-border/30 bg-secondary/20 p-3 space-y-2">
                    <p className="text-[10px] text-muted-foreground tracking-widest font-bold px-1">
                      SELECT BUY TOKEN
                    </p>

                    {/* Chain tabs */}
                    <div className="flex gap-1.5 px-1">
                      {(["solana", "ethereum", "base"] as BuyChain[]).map(chain => {
                        const meta = CHAIN_META[chain];
                        const active = buyChain === chain;
                        return (
                          <button
                            key={chain}
                            onClick={() => setBuyChain(chain)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${
                              active
                                ? "bg-secondary/80 text-white"
                                : "text-muted-foreground hover:text-white hover:bg-secondary/40"
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dotColor}`} />
                            {meta.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Solana chain tokens */}
                    {buyChain === "solana" && (
                      <div className="space-y-0.5">
                        {/* CA input */}
                        <div className="flex gap-2 mb-2">
                          <Input
                            value={caInput}
                            onChange={e => setCaInput(e.target.value)}
                            placeholder="Paste CA address…"
                            className="bg-secondary/40 border-border/30 text-white h-9 text-xs rounded-xl"
                          />
                          <Button
                            onClick={handleLookupCA}
                            disabled={caLoading || !caInput.trim()}
                            size="sm"
                            className="rounded-xl shrink-0 bg-primary/20 hover:bg-primary/30 text-primary font-bold"
                          >
                            {caLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "ADD"}
                          </Button>
                        </div>
                        {SOLANA_TOKENS.map(tok => (
                          <button
                            key={tok.mint}
                            onClick={() => { setBuyToken(tok); setShowBuyPicker(false); setQuote(null); }}
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-secondary/40 rounded-xl transition-colors text-left"
                          >
                            <TokenLogo symbol={tok.symbol} logoURI={tok.logoURI} size={7} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-white">{tok.symbol}</p>
                              <p className="text-[10px] text-muted-foreground">{tok.name}</p>
                            </div>
                            <span className="text-[10px] text-purple-400 font-bold shrink-0">SOL</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Ethereum chain tokens */}
                    {buyChain === "ethereum" && (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 px-3 py-2 mb-1 rounded-xl bg-blue-500/5 border border-blue-500/20">
                          <Lock className="w-3 h-3 text-blue-400 shrink-0" />
                          <p className="text-[10px] text-blue-300">Cross-chain swaps coming soon</p>
                        </div>
                        {ETH_TOKENS.map(tok => (
                          <div
                            key={tok.symbol}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl opacity-40 cursor-not-allowed"
                          >
                            <TokenLogo symbol={tok.symbol} logoURI={tok.logoURI} size={7} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-white">{tok.symbol}</p>
                              <p className="text-[10px] text-muted-foreground">{tok.name}</p>
                            </div>
                            <span className="text-[10px] text-blue-400 font-bold shrink-0">ETH</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Base chain tokens */}
                    {buyChain === "base" && (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 px-3 py-2 mb-1 rounded-xl bg-blue-500/5 border border-blue-500/20">
                          <Lock className="w-3 h-3 text-blue-300 shrink-0" />
                          <p className="text-[10px] text-blue-200">Cross-chain swaps coming soon</p>
                        </div>
                        {BASE_TOKENS.map(tok => (
                          <div
                            key={tok.symbol + "-base"}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl opacity-40 cursor-not-allowed"
                          >
                            <TokenLogo symbol={tok.symbol} logoURI={tok.logoURI} size={7} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-white">{tok.symbol}</p>
                              <p className="text-[10px] text-muted-foreground">{tok.name}</p>
                            </div>
                            <span className="text-[10px] text-blue-300 font-bold shrink-0">BASE</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Quote error */}
            {quoteError && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-red-300 leading-relaxed">{quoteError}</p>
              </div>
            )}

            {/* No private key warning */}
            {!privateKey && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-300 leading-relaxed">
                  Watch-only account — no private key available for signing.
                </p>
              </div>
            )}

            {/* Swap button */}
            <Button
              onClick={handleSwap}
              disabled={!canSwap}
              className="w-full h-12 rounded-full font-bold tracking-wider bg-gradient-to-r from-primary to-[#8a9500] text-primary-foreground disabled:opacity-40"
            >
              {quoteLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />FETCHING QUOTE…</>
              ) : !sellAmount || sellAmt === 0 ? (
                "ENTER AMOUNT"
              ) : sellAmt > sellBalance ? (
                "INSUFFICIENT BALANCE"
              ) : !quote ? (
                "NO ROUTE FOUND"
              ) : (
                `SWAP ${sellToken.symbol} → ${buyToken.symbol}`
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <TxSignModal
        open={signOpen}
        onOpenChange={setSignOpen}
        title="APPROVE SWAP"
        details={txDetails}
        warningMessage={
          txDetails.find(d => d.danger)
            ? "High price impact detected. You may receive significantly less than expected."
            : undefined
        }
        onConfirm={executeSwap}
        onSuccess={(sig) => {
          setSignOpen(false);
          close();
          toast({
            title: "Swap confirmed on-chain!",
            description: `Signature: ${sig.slice(0, 12)}…`,
          });
        }}
      />
    </>
  );
}
