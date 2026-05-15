import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, X, Check, QrCode, ArrowLeft } from "lucide-react";
import { useWallet } from "@/hooks/use-wallet";
import { motion } from "framer-motion";
import nekoLogo from "@/assets/neko-logo.png";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Network {
  id: string;
  name: string;
  symbol: string;
  logoUrl: string | null;
  fallbackColor: string;
  getAddress: (base: string) => string;
}

function deriveEvm(base: string, salt: number): string {
  const hex = "0123456789abcdef";
  let r = "0x";
  for (let i = 0; i < 40; i++) r += hex[(base.charCodeAt(i % base.length) + salt * 7) % 16];
  return r;
}
function deriveBtc(base: string): string {
  const c = "abcdefghijklmnopqrstuvwxyz0123456789";
  let r = "bc1q";
  for (let i = 0; i < 38; i++) r += c[base.charCodeAt(i % base.length) % c.length];
  return r;
}
function deriveSui(base: string): string {
  const hex = "0123456789abcdef";
  let r = "0x";
  for (let i = 0; i < 64; i++) r += hex[(base.charCodeAt(i % base.length) + 31) % 16];
  return r;
}

const NETWORKS: Network[] = [
  {
    id: "solana",
    name: "Solana",
    symbol: "SOL",
    logoUrl: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
    fallbackColor: "from-violet-500 to-purple-700",
    getAddress: (b) => b,
  },
  {
    id: "ethereum",
    name: "Ethereum",
    symbol: "ETH",
    logoUrl: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    fallbackColor: "from-blue-500 to-indigo-700",
    getAddress: (b) => deriveEvm(b, 1),
  },
  {
    id: "bitcoin",
    name: "Bitcoin",
    symbol: "BTC",
    logoUrl: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
    fallbackColor: "from-orange-500 to-amber-600",
    getAddress: (b) => deriveBtc(b),
  },
  {
    id: "monad",
    name: "Monad",
    symbol: "MON",
    logoUrl: "https://assets.coingecko.com/coins/images/51042/small/monad_logo.png",
    fallbackColor: "from-purple-600 to-violet-900",
    getAddress: (b) => deriveEvm(b, 2),
  },
  {
    id: "base",
    name: "Ethereum Base",
    symbol: "BASE",
    logoUrl: "https://assets.coingecko.com/asset_platforms/images/131/small/base-network-logo.png",
    fallbackColor: "from-blue-600 to-blue-900",
    getAddress: (b) => deriveEvm(b, 3),
  },
  {
    id: "sui",
    name: "Sui",
    symbol: "SUI",
    logoUrl: "https://assets.coingecko.com/coins/images/26375/small/sui_asset.jpeg",
    fallbackColor: "from-teal-500 to-cyan-700",
    getAddress: (b) => deriveSui(b),
  },
  {
    id: "polygon",
    name: "Polygon",
    symbol: "POL",
    logoUrl: "https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png",
    fallbackColor: "from-purple-500 to-fuchsia-700",
    getAddress: (b) => deriveEvm(b, 4),
  },
  {
    id: "hype",
    name: "Hyperliquid",
    symbol: "HYPE",
    logoUrl: "https://assets.coingecko.com/coins/images/36982/small/photo_2024-11-01_18-09-43.jpg",
    fallbackColor: "from-[#00D4AA] to-[#00A884]",
    getAddress: (b) => deriveEvm(b, 5),
  },
];

function ChainIcon({ net }: { net: Network }) {
  const [err, setErr] = useState(false);

  if (net.logoUrl === "local:neko") {
    return (
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E1F311] to-[#8a9500] flex items-center justify-center overflow-hidden shadow-sm">
        <img src={nekoLogo} className="w-8 h-8 object-contain" alt="NEKO" />
      </div>
    );
  }

  if (net.logoUrl && !err) {
    return (
      <img
        src={net.logoUrl}
        alt={net.name}
        className="w-10 h-10 rounded-xl object-cover border border-border/20 shadow-sm"
        onError={() => setErr(true)}
      />
    );
  }

  return (
    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${net.fallbackColor} flex items-center justify-center font-black text-xs text-white shadow-sm`}>
      {net.symbol.slice(0, 3)}
    </div>
  );
}

function truncate(addr: string, n = 7) {
  if (addr.length <= n * 2) return addr;
  return `${addr.slice(0, n)}...${addr.slice(-n)}`;
}

export function DepositModal({ open, onOpenChange }: Props) {
  const { address } = useWallet();
  const base = address || "";

  const [qrNetwork, setQrNetwork] = useState<Network | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const close = () => {
    onOpenChange(false);
    setTimeout(() => setQrNetwork(null), 200);
  };

  const copy = (net: Network) => {
    navigator.clipboard.writeText(net.getAddress(base));
    setCopiedId(net.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const qrAddr = qrNetwork ? qrNetwork.getAddress(base) : "";

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="bg-card border border-primary/20 max-w-md p-0 overflow-hidden gap-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div className="flex items-center gap-2">
            {qrNetwork && (
              <button
                onClick={() => setQrNetwork(null)}
                className="text-muted-foreground hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h3 className="text-base font-bold tracking-wider text-white">
              {qrNetwork ? qrNetwork.name.toUpperCase() : "RECEIVE"}
            </h3>
          </div>
          <button onClick={close} className="text-muted-foreground hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* NETWORK LIST */}
        {!qrNetwork && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="text-xs text-muted-foreground px-5 pt-4 pb-1">
              Select a network to view your deposit address
            </p>
            <div className="py-1 max-h-[460px] overflow-auto">
              {NETWORKS.map((net) => {
                const addr = net.getAddress(base);
                const isCopied = copiedId === net.id;
                return (
                  <div
                    key={net.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors"
                  >
                    <ChainIcon net={net} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white">{net.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {truncate(addr, 6)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setQrNetwork(net)}
                        className="w-9 h-9 rounded-full bg-secondary/60 hover:bg-secondary/90 flex items-center justify-center text-muted-foreground hover:text-white transition-colors"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => copy(net)}
                        className="w-9 h-9 rounded-full bg-secondary/60 hover:bg-secondary/90 flex items-center justify-center text-muted-foreground hover:text-white transition-colors"
                      >
                        {isCopied ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-4 py-3 border-t border-border/40">
              <Button variant="secondary" onClick={close} className="w-full rounded-full font-bold tracking-wider">
                CLOSE
              </Button>
            </div>
          </motion.div>
        )}

        {/* QR CODE VIEW */}
        {qrNetwork && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-5"
          >
            <div className="flex flex-col items-center mb-5">
              <div className="mb-3">
                <ChainIcon net={qrNetwork} />
              </div>
              <div className="bg-white p-3 rounded-2xl shadow-lg">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrAddr)}`}
                  alt="QR Code"
                  className="w-48 h-48"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground tracking-widest font-bold">
                {qrNetwork.name.toUpperCase()} ADDRESS
              </label>
              <div className="mt-2 flex items-center gap-2 p-3 bg-secondary/50 border border-border/40 rounded-xl">
                <span className="text-xs text-white font-mono break-all flex-1">{qrAddr}</span>
                <button
                  onClick={() => copy(qrNetwork)}
                  className="text-muted-foreground hover:text-primary shrink-0 transition-colors"
                >
                  {copiedId === qrNetwork.id ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            <Button
              onClick={() => copy(qrNetwork)}
              className="w-full mt-4 rounded-full font-bold tracking-wider bg-gradient-to-r from-primary to-[#8a9500] text-primary-foreground"
            >
              {copiedId === qrNetwork.id ? (
                <><Check className="w-4 h-4 mr-2" /> COPIED</>
              ) : (
                <><Copy className="w-4 h-4 mr-2" /> COPY ADDRESS</>
              )}
            </Button>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
}
