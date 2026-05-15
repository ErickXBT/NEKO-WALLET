export type ActivityType = "send" | "receive" | "swap" | "deposit";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  timestamp: number;
  status: "completed" | "failed";
  accountId: string;

  symbol: string;
  amount: number;
  usdValue: number;

  toSymbol?: string;
  toAmount?: number;
  counterparty?: string;
  note?: string;
  txSignature?: string;
}

function storageKey(walletId: string) {
  return `neko_activity_${walletId.toUpperCase()}`;
}

export function loadActivity(walletId: string): ActivityItem[] {
  try {
    const raw = localStorage.getItem(storageKey(walletId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function addActivity(
  walletId: string,
  item: Omit<ActivityItem, "id" | "timestamp">,
): ActivityItem {
  const existing = loadActivity(walletId);
  const newItem: ActivityItem = {
    ...item,
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  };
  const updated = [newItem, ...existing].slice(0, 1000);
  localStorage.setItem(storageKey(walletId), JSON.stringify(updated));
  return newItem;
}

export function clearActivity(walletId: string) {
  localStorage.removeItem(storageKey(walletId));
}

export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return "Just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDateGroup(ts: number): string {
  const now = new Date();
  const d = new Date(ts);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const txDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (txDay.getTime() === today.getTime()) return "Today";
  if (txDay.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}
