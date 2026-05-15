import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, ArrowLeft, Search, Send } from "lucide-react";
import { useWallet } from "@/hooks/use-wallet";
import { useTopCoins } from "@/hooks/use-coingecko";
import { useToast } from "@/hooks/use-toast";
import { addActivity } from "@/lib/activity";
import { transferSOL, transferSPL, getMintDecimals } from "@/lib/solana-tx";
import { TOKEN_MINTS } from "@/lib/jupiter";
import { TxSignModal, type TxDetail } from "./TxSignModal";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeposit?: () => void;
}

type View = "picker" | "send";

interface CoinOption {
  id: string;
  name: string;
  symbol: string;
  logoUrl: string | null;
  fallbackColor: string;
  cgId: string | null;
  mintAddress: string | null;
  decimals: number;
  balance: number;
  price: number;
}

// Only real Solana on-chain SPL tokens (non-SOL)
const SOLANA_SPL_TOKENS: Omit<CoinOption, "balance" | "price">[] = [
  {
    id: "usd-coin",
    name: "USD Coin",
    symbol: "USDC",
    logoUrl: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
    fallbackColor: "from-blue-500 to-blue-700",
    cgId: "usd-coin",
    mintAddress: TOKEN_MINTS.USDC,
    decimals: 6,
  },
  {
    id: "tether",
    name: "Tether",
    symbol: "USDT",
    logoUrl: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
    fallbackColor: "from-green-500 to-green-700",
    cgId: "tether",
    mintAddress: TOKEN_MINTS.USDT,
    decimals: 6,
  },
  {
    id: "bonk",
    name: "Bonk",
    symbol: "BONK",
    logoUrl: "https://assets.coingecko.com/coins/images/28600/small/bonk.jpg",
    fallbackColor: "from-orange-500 to-red-600",
    cgId: "bonk",
    mintAddress: TOKEN_MINTS.BONK,
    decimals: 5,
  },
  {
    id: "jupiter-exchange-solana",
    name: "Jupiter",
    symbol: "JUP",
    logoUrl: "https://static.jup.ag/jup/icon.png",
    fallbackColor: "from-green-500 to-emerald-700",
    cgId: "jupiter-exchange-solana",
    mintAddress: TOKEN_MINTS.JUP,
    decimals: 6,
  },
  {
    id: "dogwifcoin",
    name: "dogwifhat",
    symbol: "WIF",
    logoUrl: "https://assets.coingecko.com/coins/images/33566/small/dogwifhat.jpg",
    fallbackColor: "from-pink-500 to-rose-700",
    cgId: "dogwifcoin",
    mintAddress: TOKEN_MINTS.WIF,
    decimals: 6,
  },
  {
    id: "popcat",
    name: "Popcat",
    symbol: "POPCAT",
    logoUrl: "https://assets.coingecko.com/coins/images/33760/small/image.png",
    fallbackColor: "from-yellow-500 to-amber-700",
    cgId: "popcat",
    mintAddress: TOKEN_MINTS.POPCAT,
    decimals: 9,
  },
];

const SOL_LOGO = "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png";

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function isSolanaAddress(addr: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

function TokenIcon({ coin, size = 10 }: { coin: CoinOption; size?: number }) {
  const [err, setErr] = useState(false);
  const cls = `w-${size} h-${size} rounded-full shrink-0`;

  if (coin.logoUrl && !err) {
    return (
      <img
        src={coin.logoUrl} alt={coin.name}
        className={`${cls} object-cover border border-border/20`}
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <div className={`${cls} bg-gradient-to-br ${coin.fallbackColor} flex items-center justify-center font-black text-[10px] text-white`}>
      {coin.symbol.slice(0, 3)}
    </div>
  );
}

export function SendModal({ open, onOpenChange, onDeposit }: Props) {
  const { walletId, address, accounts, activeAccountId, solBalance, holdings, send, updateHoldings, depositToAccount } = useWallet();
  const { data: coins } = useTopCoins();
  const { toast } = useToast();

  const [view, setView] = useState<View>("picker");
  const [search, setSearch] = useState("");
  const [selectedCoin, setSelectedCoin] = useState<CoinOption | null>(null);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");

  // On-chain signing state
  const [signOpen, setSignOpen] = useState(false);
  const [txDetails, setTxDetails] = useState<TxDetail[]>([]);
  const [mintForSend, setMintForSend] = useState<string | null>(null);
  const [decimalsForSend, setDecimalsForSend] = useState<number>(9);

  const activeAccount = accounts.find(a => a.id === activeAccountId);
  const privateKey = activeAccount?.privateKey ?? null;

  const solPrice = coins?.find(c => c.id === "solana")?.current_price ?? 145;

  const coinOptions = useMemo<CoinOption[]>(() => {
    const solOption: CoinOption = {
      id: "neko",
      name: "Solana",
      symbol: "SOL",
      logoUrl: SOL_LOGO,
      fallbackColor: "from-violet-500 to-purple-700",
      cgId: "solana",
      mintAddress: null,
      decimals: 9,
      balance: solBalance,
      price: solPrice,
    };

    const splOptions: CoinOption[] = SOLANA_SPL_TOKENS.map((bt) => {
      const cgData = bt.cgId ? coins?.find((c) => c.id === bt.cgId) : null;
      return {
        ...bt,
        balance: holdings[bt.id] ?? holdings[bt.cgId ?? ""] ?? 0,
        price: cgData?.current_price ?? 0,
      };
    });

    // Add user-held CA tokens (SPL tokens added via contract address)
    const knownIds = new Set(["neko", ...SOLANA_SPL_TOKENS.map((b) => b.id)]);
    const caHoldings: CoinOption[] = Object.entries(holdings)
      .filter(([id, bal]) => bal > 0 && !knownIds.has(id) && id.startsWith("ca:"))
      .map(([id, bal]) => {
        return {
          id,
          name: id.slice(3, 9) + "…",
          symbol: "SPL",
          logoUrl: null,
          fallbackColor: "from-secondary to-secondary/40",
          cgId: null,
          mintAddress: id.slice(3),
          decimals: 9,
          balance: bal,
          price: 0,
        };
      });

    return [solOption, ...splOptions, ...caHoldings];
  }, [solBalance, solPrice, holdings, coins]);

  const filtered = search.trim()
    ? coinOptions.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.symbol.toLowerCase().includes(search.toLowerCase())
      )
    : coinOptions;

  const close = () => {
    onOpenChange(false);
    setTimeout(() => {
      setView("picker"); setSearch(""); setSelectedCoin(null);
      setRecipient(""); setAmount("");
    }, 200);
  };

  const selectCoin = (coin: CoinOption) => {
    setSelectedCoin(coin); setAmount(""); setRecipient(""); setView("send");
  };

  const handleSend = () => {
    if (!selectedCoin || !recipient.trim()) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    if (amt > selectedCoin.balance) {
      toast({ title: "Insufficient balance", variant: "destructive" }); return;
    }

    const dest = recipient.trim();
    const isSelf = dest === address;
    const internalAccount = !isSelf ? accounts.find(a => a.address === dest) : null;

    if (isSelf) {
      toast({ title: "Self-transfer", description: "You sent to your own address — balance unchanged.", variant: "destructive" });
      return;
    }

    if (internalAccount) {
      if (selectedCoin.id === "neko") {
        if (!send(amt, dest)) { toast({ title: "Insufficient balance", variant: "destructive" }); return; }
        depositToAccount(internalAccount.id, amt);
      } else {
        const key = holdings[selectedCoin.id] !== undefined ? selectedCoin.id : selectedCoin.cgId ?? selectedCoin.id;
        updateHoldings(key, -amt);
      }
      if (walletId) {
        addActivity(walletId, {
          type: "send", status: "completed", accountId: walletId,
          symbol: selectedCoin.symbol, amount: amt,
          usdValue: amt * selectedCoin.price, counterparty: dest,
        });
        addActivity(walletId, {
          type: "receive", status: "completed", accountId: internalAccount.id,
          symbol: selectedCoin.symbol, amount: amt,
          usdValue: amt * selectedCoin.price, counterparty: address ?? "",
        });
      }
      toast({ title: "Transferred", description: `${amt} ${selectedCoin.symbol} → ${internalAccount.name}` });
      close();
      return;
    }

    // ── External send — all tokens here are Solana on-chain ──────────────────
    if (!address || !privateKey) {
      toast({ title: "Cannot send", description: "Watch-only account has no signing key.", variant: "destructive" });
      return;
    }
    if (!isSolanaAddress(dest)) {
      toast({ title: "Invalid address", description: "Not a valid Solana address.", variant: "destructive" });
      return;
    }

    if (selectedCoin.id === "neko") {
      setTxDetails([
        { label: "FROM",         value: `${address.slice(0, 8)}…${address.slice(-6)}`, mono: true },
        { label: "TO",           value: `${dest.slice(0, 8)}…${dest.slice(-6)}`,       mono: true },
        { label: "AMOUNT",       value: `${amt} SOL`,     highlight: true },
        { label: "USD VALUE",    value: `≈ $${fmt(amt * solPrice)}` },
        { label: "NETWORK FEE",  value: "~0.000005 SOL (paid from balance)" },
      ]);
      setMintForSend(null);
      setSignOpen(true);
    } else {
      // SPL token (USDC, BONK, WIF, etc. or ca: token)
      const mint = selectedCoin.mintAddress ?? (selectedCoin.id.startsWith("ca:") ? selectedCoin.id.slice(3) : null);
      if (!mint) {
        toast({ title: "Cannot send", description: "Token mint address unknown.", variant: "destructive" });
        return;
      }
      setMintForSend(mint);
      setDecimalsForSend(selectedCoin.decimals);
      setTxDetails([
        { label: "TOKEN",        value: `${selectedCoin.name} (${selectedCoin.symbol})` },
        { label: "FROM",         value: `${address.slice(0, 8)}…${address.slice(-6)}`, mono: true },
        { label: "TO",           value: `${dest.slice(0, 8)}…${dest.slice(-6)}`,       mono: true },
        { label: "AMOUNT",       value: `${amt} ${selectedCoin.symbol}`, highlight: true },
        { label: "USD VALUE",    value: `≈ $${fmt(amt * selectedCoin.price)}` },
        { label: "NETWORK FEE",  value: "~0.000005 SOL (paid from SOL balance)" },
        { label: "NOTE",         value: "Recipient ATA will be created if needed" },
      ]);
      setSignOpen(true);
    }
  };

  // ── Execute on-chain transfer (SOL or SPL) ───────────────────────────────────
  const executeOnChainSend = async (): Promise<string> => {
    if (!address || !privateKey || !selectedCoin) throw new Error("Missing wallet data");
    const amt = parseFloat(amount);
    const dest = recipient.trim();
    let signature: string;

    if (mintForSend) {
      const decimals = decimalsForSend || await getMintDecimals(mintForSend);
      signature = await transferSPL(address, dest, mintForSend, amt, decimals, privateKey);

      const key = holdings[selectedCoin.id] !== undefined ? selectedCoin.id : selectedCoin.cgId ?? selectedCoin.id;
      updateHoldings(key, -amt);
      if (walletId) {
        addActivity(walletId, {
          type: "send", status: "completed", accountId: walletId,
          symbol: selectedCoin.symbol, amount: amt,
          usdValue: amt * selectedCoin.price,
          counterparty: dest,
          txSignature: signature,
        });
      }
    } else {
      signature = await transferSOL(address, dest, amt, privateKey);
      send(amt, dest);
      if (walletId) {
        addActivity(walletId, {
          type: "send", status: "completed", accountId: walletId,
          symbol: "SOL", amount: amt,
          usdValue: amt * solPrice,
          counterparty: dest,
          txSignature: signature,
        });
      }
    }

    setMintForSend(null);
    return signature;
  };

  const usdValue = selectedCoin ? (parseFloat(amount) || 0) * selectedCoin.price : 0;
  const amtNum = parseFloat(amount) || 0;
  const canSend = !!recipient.trim() && amtNum > 0 && selectedCoin && amtNum <= selectedCoin.balance;

  const dest = recipient.trim();
  const isInternal = !!accounts.find(a => a.address === dest);
  const isOnChainSend =
    !!dest && dest !== address && !isInternal && !!selectedCoin;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
        <DialogContent className="bg-[#0f0f14] border border-border/40 w-full max-w-md p-0 gap-0 flex flex-col max-h-[90vh]">
          <DialogTitle className="sr-only">{view === "picker" ? "Select Token" : "Send"}</DialogTitle>

          {/* ── Header ── */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border/30 shrink-0">
            {view === "send" && (
              <button onClick={() => setView("picker")} className="text-muted-foreground hover:text-white transition-colors -ml-1">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <span className="text-sm font-bold tracking-wider text-white flex-1">
              {view === "picker" ? "SELECT TOKEN" : "SEND"}
            </span>
            {view === "send" && isOnChainSend && isSolanaAddress(dest) && (
              <span className="text-[9px] text-emerald-400 font-bold tracking-wider bg-emerald-400/10 border border-emerald-400/30 rounded-full px-2 py-0.5">
                ON-CHAIN
              </span>
            )}
            <button onClick={close} className="text-muted-foreground hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── PICKER VIEW ── */}
          {view === "picker" && (
            <>
              <div className="px-4 pt-3 pb-2 shrink-0">
                <div className="flex items-center gap-2 px-3 py-2.5 bg-secondary/40 border border-border/30 rounded-xl">
                  <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search token…"
                    className="bg-transparent text-sm text-white placeholder:text-muted-foreground outline-none flex-1 min-w-0"
                    autoFocus
                  />
                  {search && (
                    <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-y-auto flex-1 min-h-0">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <p className="text-sm">No tokens found</p>
                  </div>
                ) : (
                  filtered.map((coin) => {
                    const usd = coin.balance * coin.price;
                    return (
                      <button
                        key={coin.id}
                        onClick={() => selectCoin(coin)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors text-left border-b border-border/10 last:border-0"
                      >
                        <TokenIcon coin={coin} size={10} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white truncate">{coin.name}</span>
                            <span className="text-[8px] text-emerald-400 font-bold tracking-wider bg-emerald-400/10 border border-emerald-400/20 rounded-full px-1.5 py-0.5">
                              ON-CHAIN
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {coin.balance > 0
                              ? `${coin.balance.toFixed(Math.min(4, coin.balance < 1 ? 6 : 4))} ${coin.symbol}`
                              : `0 ${coin.symbol}`
                            }
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <div className="text-sm font-semibold text-white whitespace-nowrap">
                            ${fmt(usd)}
                          </div>
                          {coin.price > 0 && (
                            <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                              ${coin.price < 0.01 ? coin.price.toFixed(6) : fmt(coin.price)}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="px-4 py-3 border-t border-border/30 shrink-0">
                <Button variant="secondary" onClick={close} className="w-full rounded-full font-bold tracking-wider">
                  CLOSE
                </Button>
              </div>
            </>
          )}

          {/* ── SEND VIEW ── */}
          {view === "send" && selectedCoin && (
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Selected coin card */}
              <div className="flex items-center gap-3 p-4 bg-secondary/30 border border-border/30 rounded-2xl">
                <TokenIcon coin={selectedCoin} size={12} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{selectedCoin.name}</span>
                    <span className="text-[8px] text-emerald-400 font-bold tracking-wider bg-emerald-400/10 border border-emerald-400/20 rounded-full px-1.5 py-0.5">
                      REAL ON-CHAIN
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Balance: {selectedCoin.balance.toFixed(4)} {selectedCoin.symbol}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-white">${fmt(selectedCoin.balance * selectedCoin.price)}</div>
                </div>
              </div>

              {selectedCoin.balance <= 0 ? (
                <div className="text-center space-y-3 py-4">
                  <p className="text-sm text-white font-medium">No {selectedCoin.symbol} to send</p>
                  <p className="text-xs text-muted-foreground">Deposit or swap to get {selectedCoin.symbol} first.</p>
                  {selectedCoin.id === "neko" && (
                    <Button
                      onClick={() => { onOpenChange(false); onDeposit?.(); }}
                      className="w-full rounded-full font-bold tracking-wider bg-gradient-to-r from-primary to-[#8a9500] text-primary-foreground"
                    >
                      DEPOSIT SOL
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {/* Recipient */}
                  <div className="space-y-2">
                    <label className="text-[10px] text-muted-foreground tracking-widest font-bold block">
                      RECIPIENT ADDRESS
                    </label>
                    <Input
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      placeholder="Enter Solana wallet address…"
                      className="bg-secondary/40 border-border/30 text-white h-11 rounded-xl focus-visible:ring-primary/40"
                    />
                    {isOnChainSend && isSolanaAddress(dest) && (
                      <p className="text-[10px] text-emerald-400 font-bold pl-1">
                        ✓ Real on-chain transfer — will be signed and submitted to Solana
                      </p>
                    )}
                    {dest && !isSolanaAddress(dest) && (
                      <p className="text-[10px] text-red-400 font-bold pl-1">
                        ✗ Not a valid Solana address
                      </p>
                    )}
                  </div>

                  {/* Amount */}
                  <div className="space-y-2">
                    <label className="text-[10px] text-muted-foreground tracking-widest font-bold block">
                      AMOUNT
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="0.00"
                          className="bg-secondary/40 border-border/30 text-white h-11 pr-16 rounded-xl focus-visible:ring-primary/40"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-bold pointer-events-none">
                          {selectedCoin.symbol}
                        </span>
                      </div>
                      <Button
                        variant="secondary"
                        onClick={() => setAmount(String(selectedCoin.balance))}
                        className="rounded-xl px-4 font-bold text-xs shrink-0"
                      >
                        MAX
                      </Button>
                    </div>
                    {usdValue > 0 && (
                      <p className="text-xs text-muted-foreground pl-1">≈ ${fmt(usdValue)}</p>
                    )}
                    {amtNum > selectedCoin.balance && (
                      <p className="text-[10px] text-red-400 font-bold pl-1">Insufficient balance</p>
                    )}
                  </div>

                  <Button
                    onClick={handleSend}
                    disabled={!canSend}
                    className="w-full h-14 rounded-2xl font-bold text-base bg-gradient-to-r from-primary to-[#8a9500] text-primary-foreground disabled:opacity-40"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Send {selectedCoin.symbol}
                  </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <TxSignModal
        open={signOpen}
        onOpenChange={setSignOpen}
        title={`APPROVE SEND`}
        details={txDetails}
        onConfirm={executeOnChainSend}
        onSuccess={(sig) => {
          setSignOpen(false);
          close();
          toast({
            title: "Sent on-chain!",
            description: `Signature: ${sig.slice(0, 12)}…`,
          });
        }}
      />
    </>
  );
}
