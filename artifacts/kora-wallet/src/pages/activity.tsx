import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWallet } from "@/hooks/use-wallet";
import {
  ActivityItem, ActivityType,
  loadActivity, clearActivity,
  formatRelativeTime, formatDateGroup,
} from "@/lib/activity";
import {
  ArrowUpRight, ArrowDownLeft, ArrowLeftRight,
  Package, Trash2, Filter, RefreshCw, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<ActivityType, string> = {
  send: "Send",
  receive: "Receive",
  swap: "Swap",
  deposit: "Deposit",
};

const TYPE_COLOR: Record<ActivityType, string> = {
  send: "text-red-400",
  receive: "text-green-400",
  swap: "text-blue-400",
  deposit: "text-green-400",
};

const TYPE_BG: Record<ActivityType, string> = {
  send: "bg-red-500/10 border-red-500/20",
  receive: "bg-green-500/10 border-green-500/20",
  swap: "bg-blue-500/10 border-blue-500/20",
  deposit: "bg-green-500/10 border-green-500/20",
};

function ActivityIcon({ type }: { type: ActivityType }) {
  const bg = TYPE_BG[type];
  const color = TYPE_COLOR[type];
  const Icon =
    type === "send" ? ArrowUpRight :
    type === "receive" || type === "deposit" ? ArrowDownLeft :
    ArrowLeftRight;
  return (
    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center border shrink-0", bg)}>
      <Icon className={cn("w-5 h-5", color)} />
    </div>
  );
}

function fmt(n: number, dec = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function isSolanaAddress(s: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
}

function solscanAccountUrl(address: string) {
  return `https://solscan.io/account/${address}`;
}

function ActivityRow({ item, walletAddress }: { item: ActivityItem; walletAddress?: string | null }) {
  const color = TYPE_COLOR[item.type];
  const isSwap = item.type === "swap";
  const isOutgoing = item.type === "send";
  const usd = item.usdValue;

  const solscanTarget =
    (item.type === "send" || item.type === "receive") && item.counterparty && isSolanaAddress(item.counterparty)
      ? solscanAccountUrl(item.counterparty)
      : walletAddress
        ? solscanAccountUrl(walletAddress)
        : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-4 rounded-xl bg-secondary/20 border border-border/30 hover:bg-secondary/40 transition-colors"
    >
      <ActivityIcon type={item.type} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white">{TYPE_LABEL[item.type]}</span>
          <span className={cn(
            "text-[9px] font-bold px-1.5 py-0.5 rounded-full border tracking-wider",
            item.status === "completed"
              ? "text-green-400 bg-green-500/10 border-green-500/20"
              : "text-red-400 bg-red-500/10 border-red-500/20"
          )}>
            {item.status.toUpperCase()}
          </span>
          {solscanTarget && (
            <a
              href={solscanTarget}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-0.5 text-[9px] text-muted-foreground/60 hover:text-[#9945FF] transition-colors ml-0.5"
              title="View on Solscan"
            >
              <ExternalLink className="w-2.5 h-2.5" />
              <span className="tracking-wider font-bold">SOLSCAN</span>
            </a>
          )}
        </div>

        {isSwap ? (
          <div className="text-xs text-muted-foreground mt-0.5">
            {item.amount < 0.0001 ? item.amount.toFixed(8) : item.amount.toFixed(4)}{" "}
            <span className="font-medium text-white/70">{item.symbol}</span>
            {" → "}
            {(item.toAmount ?? 0) < 0.0001 ? (item.toAmount ?? 0).toFixed(8) : (item.toAmount ?? 0).toFixed(4)}{" "}
            <span className="font-medium text-white/70">{item.toSymbol}</span>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground mt-0.5">
            {item.counterparty ? (
              <span className="font-mono">
                {item.counterparty.length > 12
                  ? `${item.counterparty.slice(0, 6)}…${item.counterparty.slice(-4)}`
                  : item.counterparty}
              </span>
            ) : (
              <span>{item.note ?? TYPE_LABEL[item.type]}</span>
            )}
          </div>
        )}

        <div className="text-[10px] text-muted-foreground/60 mt-0.5">
          {new Date(item.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          {" · "}
          {formatRelativeTime(item.timestamp)}
        </div>
      </div>

      <div className="text-right shrink-0">
        {isSwap ? (
          <>
            <div className="text-sm font-bold text-green-400">
              +{(item.toAmount ?? 0) < 0.0001
                ? (item.toAmount ?? 0).toFixed(8)
                : fmt(item.toAmount ?? 0, (item.toAmount ?? 0) < 1 ? 6 : 4)}{" "}
              <span className="text-xs font-semibold">{item.toSymbol ?? item.symbol}</span>
            </div>
            <div className="text-[10px] text-muted-foreground/60 mt-0.5">
              −{item.amount < 0.0001 ? item.amount.toFixed(8) : fmt(item.amount, item.amount < 1 ? 6 : 4)} {item.symbol}
            </div>
          </>
        ) : (
          <>
            <div className={cn("text-sm font-bold", color)}>
              {isOutgoing ? "−" : "+"}{item.amount < 0.0001 ? item.amount.toFixed(8) : fmt(item.amount, item.amount < 1 ? 6 : 4)}{" "}
              <span className="text-xs font-semibold">{item.symbol}</span>
            </div>
            {usd > 0 && (
              <div className="text-[10px] text-muted-foreground mt-0.5">${fmt(usd)}</div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

const FILTER_OPTIONS: { label: string; value: ActivityType | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Send", value: "send" },
  { label: "Receive", value: "receive" },
  { label: "Swap", value: "swap" },
  { label: "Deposit", value: "deposit" },
];

export default function Activity() {
  const [, setLocation] = useLocation();
  const { walletId, activeAccountId, address } = useWallet();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [filter, setFilter] = useState<ActivityType | "all">("all");
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!walletId) setLocation("/");
  }, [walletId]);

  useEffect(() => {
    if (!walletId) return;
    setItems(loadActivity(walletId));
  }, [walletId, activeAccountId]);

  const filtered = useMemo(() =>
    filter === "all" ? items : items.filter(i => i.type === filter),
    [items, filter]
  );

  const grouped = useMemo(() => {
    const groups: { label: string; items: ActivityItem[] }[] = [];
    for (const item of filtered) {
      const label = formatDateGroup(item.timestamp);
      const last = groups[groups.length - 1];
      if (last && last.label === label) {
        last.items.push(item);
      } else {
        groups.push({ label, items: [item] });
      }
    }
    return groups;
  }, [filtered]);

  const handleClear = () => {
    if (!walletId) return;
    clearActivity(walletId);
    setItems([]);
    setConfirmClear(false);
  };

  if (!walletId) return null;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto w-full px-4 md:px-6 py-6 md:py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-wider text-white">ACTIVITY</h1>
            <p className="text-xs text-muted-foreground mt-1">{items.length} transaction{items.length !== 1 ? "s" : ""} recorded</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => { if (walletId) setItems(loadActivity(walletId)); }}
              className="rounded-full border-border/40"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            {items.length > 0 && (
              confirmClear ? (
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleClear}
                    className="rounded-full text-xs font-bold"
                  >
                    Confirm
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmClear(false)}
                    className="rounded-full text-xs border-border/40"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setConfirmClear(true)}
                  className="rounded-full border-border/40 text-muted-foreground hover:text-red-400 hover:border-red-400/40"
                  title="Clear history"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1.5 mb-6 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-bold tracking-wider transition-all",
                filter === opt.value
                  ? "bg-gradient-to-r from-primary to-[#8a9500] text-primary-foreground shadow-[0_0_8px_rgba(225,243,17,0.25)]"
                  : "bg-secondary/40 text-muted-foreground hover:text-white border border-border/40"
              )}
            >
              {opt.label}
              {opt.value !== "all" && (
                <span className="ml-1.5 text-[10px] opacity-70">
                  {items.filter(i => i.type === opt.value).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 text-muted-foreground"
            >
              <div className="w-20 h-20 rounded-full bg-secondary/40 border border-border/40 flex items-center justify-center mb-4">
                <Package className="w-10 h-10 opacity-30" />
              </div>
              <p className="text-base font-bold text-white/50 tracking-wide">No activity yet</p>
              <p className="text-sm text-muted-foreground mt-1 text-center max-w-xs">
                {filter === "all"
                  ? "Transactions will appear here after you send, receive, or swap tokens."
                  : `No ${filter} transactions yet.`}
              </p>
              <Button
                variant="outline"
                className="mt-6 rounded-full border-border/40 text-sm"
                onClick={() => setLocation("/wallet")}
              >
                Go to Wallet
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {grouped.map(group => (
                <div key={group.label}>
                  <div className="text-[10px] text-muted-foreground/70 tracking-widest font-bold mb-2 pl-1">
                    {group.label.toUpperCase()}
                  </div>
                  <div className="space-y-2">
                    {group.items.map(item => (
                      <ActivityRow key={item.id} item={item} walletAddress={address} />
                    ))}
                  </div>
                </div>
              ))}

              <p className="text-center text-[10px] text-muted-foreground/40 tracking-wider py-4">
                SHOWING {filtered.length} TRANSACTION{filtered.length !== 1 ? "S" : ""}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
