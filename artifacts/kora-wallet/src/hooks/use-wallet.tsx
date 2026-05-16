import { createContext, useContext } from "react";
import {
  generateMnemonic, validateMnemonic, keypairFromMnemonic,
  bytesToBase64, fromBase58, keypairFromSecretBytes,
} from "@/lib/solana-keygen";

// ─── shared types ─────────────────────────────────────────────────────────────

export type AgentTier = "NANO" | "MICRO" | "PRO" | "ELITE";

export interface Agent {
  id: string;
  tier: AgentTier;
  purchasedAt: number;
  lastClaimedAt: number;
  earned: number;
}

export interface CreatorData {
  handle: string | null;
  verified: boolean;
  pin: string | null;
  earnings: number;
}

export interface SubAccount {
  id: string;
  name: string;
  address: string;
  phrase: string;
  privateKey: string;
  solBalance: number;
  lastChainSOL?: number;
  simDelta?: number;
  migrationVersion?: number;
  holdings: Record<string, number>;
  agents: Agent[];
  cardOrder: any | null;
}

export interface WalletState {
  walletId: string | null;
  accounts: SubAccount[];
  activeAccountId: string | null;
  creator: CreatorData;
}

export interface StoredWallet extends WalletState {
  passwordHash: string;
}

export interface WalletContextType {
  walletId: string | null;
  accounts: SubAccount[];
  activeAccountId: string | null;
  creator: CreatorData;
  address: string | null;
  solBalance: number;
  holdings: Record<string, number>;
  agents: Agent[];
  cardOrder: any | null;

  connect: (walletId: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  createWallet: (walletId: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  importWallet: (walletId: string, password: string, mnemonic: string) => Promise<{ ok: boolean; error?: string }>;
  walletIdExists: (walletId: string) => boolean;
  checkWalletIdRemote: (walletId: string) => Promise<boolean>;
  disconnect: () => void;
  deposit: (amount: number) => void;
  depositToAccount: (accountId: string, amount: number) => void;
  send: (amount: number, address: string) => boolean;
  updateHoldings: (coinId: string, change: number) => void;
  orderCard: (data: any) => void;
  updateCreator: (data: Partial<CreatorData>) => void;
  buyAgent: (tier: AgentTier, cost: number) => boolean;
  claimEarnings: () => void;

  addAccount: (name?: string) => void;
  addAccountFromPhrase: (phrase: string, name?: string) => { ok: boolean; error?: string };
  addAccountFromPrivateKey: (privateKeyBase58: string, name?: string) => { ok: boolean; error?: string };
  addWatchAddress: (address: string, name?: string) => void;
  switchAccount: (id: string) => void;
  removeAccount: (id: string) => boolean;
  renameAccount: (id: string, name: string) => void;
  getAccountPhrase: (id: string) => string | null;
  getAccountPrivateKey: (id: string) => string | null;
  syncSolBalance: (sol: number) => void;
  importDirect: (input: string) => { ok: boolean; error?: string };
}

// ─── context (exported so WalletProvider can share the same object) ───────────

export const WalletContext = createContext<WalletContextType | undefined>(undefined);

// ─── constants ────────────────────────────────────────────────────────────────

export const SESSION_KEY = "neko_wallet_session";
export const SESSION_PW_KEY = "neko_wallet_session_pw";
export const DB_PREFIX = "neko_wallet_db_";
export const REGISTRY_KEY = "neko_wallet_registry";
export const LEGACY_SESSION_KEY = "kora_wallet_session";
export const LEGACY_DB_PREFIX = "kora_wallet_db_";
export const LEGACY_REGISTRY_KEY = "kora_wallet_registry";

export const defaultCreator: CreatorData = {
  handle: null, verified: false, pin: null, earnings: 0,
};

export const defaultState: WalletState = {
  walletId: null,
  accounts: [],
  activeAccountId: null,
  creator: defaultCreator,
};

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Validate and, if necessary, re-derive the keypair for a stored sub-account.
 *
 * Rules:
 * - Watch addresses and private-key imports have phrase="" → keep untouched.
 * - Mnemonic accounts are always derived at path 0 (every account uses its own
 *   unique mnemonic, never a shared HD tree), so we re-derive at path 0.
 * - If re-derivation fails for any reason we keep the stored address rather
 *   than wiping it with a freshly-generated one.
 */
export function ensureRealKeypair(acc: SubAccount): SubAccount {
  if (!acc.phrase) return acc;
  if (validateMnemonic(acc.phrase)) {
    try {
      const { publicKey, secretKeyBytes } = keypairFromMnemonic(acc.phrase, 0);
      if (acc.address === publicKey) return acc;
      return { ...acc, address: publicKey, privateKey: bytesToBase64(secretKeyBytes) };
    } catch {
      return acc;
    }
  }
  return acc;
}

export function hashPassword(pw: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < pw.length; i++) {
    h ^= pw.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return "h_" + h.toString(16).padStart(8, "0");
}

export function createSubAccount(name: string): SubAccount {
  const phrase = generateMnemonic();
  const { publicKey, secretKeyBytes } = keypairFromMnemonic(phrase, 0);
  return {
    id: "acc_" + Math.random().toString(36).slice(2) + Date.now().toString(36),
    name,
    address: publicKey,
    phrase,
    privateKey: bytesToBase64(secretKeyBytes),
    solBalance: 0,
    holdings: {},
    agents: [],
    cardOrder: null,
  };
}

// ─── storage ──────────────────────────────────────────────────────────────────

export function getRegistry(): string[] {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY) || localStorage.getItem(LEGACY_REGISTRY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function setRegistry(ids: string[]) {
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(ids));
}

export function migrateIfNeeded(data: any, walletId: string): StoredWallet {
  if (data.accounts && Array.isArray(data.accounts)) {
    const migrated = (data.accounts as SubAccount[]).map((acc) => ensureRealKeypair(acc));
    return { ...data, accounts: migrated } as StoredWallet;
  }
  const base = createSubAccount("Account 1");
  base.solBalance = data.solBalance || 0;
  base.holdings = data.holdings || {};
  base.agents = data.agents || [];
  base.cardOrder = data.cardOrder || null;
  return {
    walletId,
    accounts: [base],
    activeAccountId: base.id,
    creator: data.creator || defaultCreator,
    passwordHash: data.passwordHash || "",
  };
}

export function loadStored(walletId: string): StoredWallet | null {
  try {
    const id = walletId.toUpperCase();
    const raw = localStorage.getItem(DB_PREFIX + id) || localStorage.getItem(LEGACY_DB_PREFIX + id);
    if (!raw) return null;
    return migrateIfNeeded(JSON.parse(raw), id);
  } catch { return null; }
}

export function saveStored(walletId: string, data: StoredWallet) {
  localStorage.setItem(DB_PREFIX + walletId.toUpperCase(), JSON.stringify(data));
}

// ─── API helpers ──────────────────────────────────────────────────────────────

export async function apiRegister(
  walletId: string, password: string, walletData: WalletState,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/wallets/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletId, password, walletData }),
    });
    const json = await res.json() as { ok?: boolean; error?: string };
    if (!res.ok) return { ok: false, error: json.error || "Server error" };
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error — could not reach server" };
  }
}

export async function apiLogin(
  walletId: string, password: string,
): Promise<{ ok: boolean; walletData?: WalletState; error?: string }> {
  try {
    const res = await fetch("/api/wallets/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletId, password }),
    });
    const json = await res.json() as { ok?: boolean; walletData?: WalletState; error?: string };
    if (!res.ok) return { ok: false, error: json.error || "Server error" };
    return { ok: true, walletData: json.walletData };
  } catch {
    return { ok: false, error: null as any };
  }
}

export async function apiCheckExists(walletId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/wallets/${encodeURIComponent(walletId)}/exists`);
    const json = await res.json() as { exists: boolean };
    return json.exists;
  } catch {
    return false;
  }
}

export async function apiSync(
  walletId: string, password: string, walletData: WalletState,
): Promise<void> {
  try {
    await fetch(`/api/wallets/${encodeURIComponent(walletId)}/sync`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, walletData }),
    });
  } catch { /* best-effort */ }
}

// ─── Private-key helpers (re-exported for AccountSwitcher etc.) ───────────────

export { fromBase58, keypairFromSecretBytes, validateMnemonic, keypairFromMnemonic, bytesToBase64 };

// ─── hook ─────────────────────────────────────────────────────────────────────

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used within WalletProvider");
  return context;
}
