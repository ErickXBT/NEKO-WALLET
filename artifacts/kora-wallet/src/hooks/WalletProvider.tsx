import { useState, useEffect, useRef, ReactNode } from "react";
import {
  WalletContext,
  WalletState,
  SubAccount,
  Agent,
  AgentTier,
  CreatorData,
  StoredWallet,
  defaultCreator,
  defaultState,
  SESSION_KEY,
  SESSION_PW_KEY,
  DB_PREFIX,
  LEGACY_SESSION_KEY,
  REGISTRY_KEY,
  LEGACY_REGISTRY_KEY,
  hashPassword,
  createSubAccount,
  getRegistry,
  setRegistry,
  loadStored,
  saveStored,
  migrateIfNeeded,
  apiRegister,
  apiLogin,
  apiCheckExists,
  apiSync,
  validateMnemonic,
  keypairFromMnemonic,
  bytesToBase64,
  fromBase58,
  keypairFromSecretBytes,
} from "@/hooks/use-wallet";

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>(() => {
    const session = localStorage.getItem(SESSION_KEY) || localStorage.getItem(LEGACY_SESSION_KEY);
    if (session) {
      const stored = loadStored(session);
      if (stored) {
        const { passwordHash: _omit, ...rest } = stored;
        return rest;
      }
    }
    return defaultState;
  });

  const passwordRef = useRef<string>("");

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_PW_KEY);
    if (saved) passwordRef.current = saved;
  }, []);

  useEffect(() => {
    if (state.walletId) {
      localStorage.setItem(SESSION_KEY, state.walletId);
    } else {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_PW_KEY);
      passwordRef.current = "";
    }
  }, [state.walletId]);

  useEffect(() => {
    if (!state.walletId) return;
    const existing = loadStored(state.walletId);
    if (!existing) return;
    saveStored(state.walletId, { ...existing, ...state } as StoredWallet);
  }, [state]);

  // Migration v2: recompute simDelta from Activity log, correctly excluding
  // self-sends (sends to own address) so they don't drain the balance.
  useEffect(() => {
    if (!state.walletId || !state.activeAccountId) return;
    const acc = state.accounts.find(a => a.id === state.activeAccountId) ?? state.accounts[0];
    if (!acc) return;
    if ((acc.migrationVersion ?? 0) >= 2) return; // already on latest

    const allAddresses = new Set(state.accounts.map(a => a.address).filter(Boolean));

    try {
      const raw = localStorage.getItem(`neko_activity_${state.walletId.toUpperCase()}`);
      const activities: any[] = raw ? JSON.parse(raw) : [];
      let delta = 0;
      for (const act of activities) {
        if (act.status !== "completed") continue;
        if (act.type === "swap") {
          if (act.toSymbol === "SOL" && typeof act.toAmount === "number") delta += act.toAmount;
          if (act.symbol === "SOL" && typeof act.amount === "number") delta -= act.amount;
        } else if (act.type === "deposit" && act.symbol === "SOL") {
          delta += act.amount ?? 0;
        } else if (act.type === "send" && act.symbol === "SOL") {
          const isSelfOrInternal = act.counterparty && allAddresses.has(act.counterparty);
          if (!isSelfOrInternal) delta -= act.amount ?? 0;
        }
      }
      updateActiveAccount(a => ({
        ...a,
        simDelta: delta,
        migrationVersion: 2,
        solBalance: (a.lastChainSOL ?? a.solBalance) + delta,
      }));
    } catch {}
  }, [state.walletId, state.activeAccountId]);

  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!state.walletId || !passwordRef.current) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      apiSync(state.walletId!, passwordRef.current, state);
    }, 2000);
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [state]);

  const activeAccount = state.accounts.find(a => a.id === state.activeAccountId) ?? state.accounts[0] ?? null;

  const walletIdExists = (walletId: string) => {
    const id = walletId.trim().toUpperCase();
    if (!id) return false;
    return (
      getRegistry().includes(id) ||
      !!localStorage.getItem(DB_PREFIX + id) ||
      !!localStorage.getItem(LEGACY_SESSION_KEY.replace("session", "db_") + id)
    );
  };

  const checkWalletIdRemote = async (walletId: string): Promise<boolean> => {
    const id = walletId.trim().toUpperCase();
    if (!id) return false;
    if (walletIdExists(id)) return true;
    return apiCheckExists(id);
  };

  const connect = async (walletId: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    const id = walletId.trim().toUpperCase();
    if (!id) return { ok: false, error: "Enter a Wallet ID" };

    const serverResult = await apiLogin(id, password);

    if (serverResult.ok && serverResult.walletData) {
      const walletData = migrateIfNeeded({ ...serverResult.walletData, passwordHash: "" }, id);
      const { passwordHash: _omit, ...rest } = walletData;
      saveStored(id, { ...walletData, passwordHash: hashPassword(password) });
      if (!getRegistry().includes(id)) setRegistry([...getRegistry(), id]);
      passwordRef.current = password;
      sessionStorage.setItem(SESSION_PW_KEY, password);
      setState(rest);
      return { ok: true };
    }

    if (serverResult.error) {
      return { ok: false, error: serverResult.error };
    }

    const stored = loadStored(id);
    if (!stored) return { ok: false, error: "Wallet ID not found" };
    if (stored.passwordHash !== hashPassword(password)) {
      return { ok: false, error: "Incorrect password" };
    }
    const { passwordHash: _omit, ...rest } = stored;
    passwordRef.current = password;
    sessionStorage.setItem(SESSION_PW_KEY, password);
    setState(rest);
    return { ok: true };
  };

  const importWallet = async (
    walletId: string, password: string, mnemonic: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    const id = walletId.trim().toUpperCase();
    if (!/^[A-Z0-9_]{4,20}$/.test(id))
      return { ok: false, error: "ID must be 4–20 chars (A–Z, 0–9, _)" };
    if (password.length < 6)
      return { ok: false, error: "Password must be at least 6 characters" };

    const cleanMnemonic = mnemonic.trim().toLowerCase().replace(/\s+/g, " ");
    if (!validateMnemonic(cleanMnemonic))
      return { ok: false, error: "Invalid seed phrase — check all 12 or 24 words" };

    const { publicKey, secretKeyBytes } = keypairFromMnemonic(cleanMnemonic, 0);
    const importedAccount: SubAccount = {
      id: "acc_" + Math.random().toString(36).slice(2) + Date.now().toString(36),
      name: "Account 1",
      address: publicKey,
      phrase: cleanMnemonic,
      privateKey: bytesToBase64(secretKeyBytes),
      solBalance: 0,
      holdings: {},
      agents: [],
      cardOrder: null,
    };

    const newState: WalletState = {
      walletId: id,
      accounts: [importedAccount],
      activeAccountId: importedAccount.id,
      creator: defaultCreator,
    };

    const serverResult = await apiRegister(id, password, newState);
    if (!serverResult.ok) return { ok: false, error: serverResult.error };

    saveStored(id, { ...newState, passwordHash: hashPassword(password) });
    setRegistry([...getRegistry(), id]);
    passwordRef.current = password;
    sessionStorage.setItem(SESSION_PW_KEY, password);
    setState(newState);
    return { ok: true };
  };

  const createWallet = async (
    walletId: string, password: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    const id = walletId.trim().toUpperCase();
    if (!/^[A-Z0-9_]{4,20}$/.test(id))
      return { ok: false, error: "ID must be 4–20 chars (A–Z, 0–9, _)" };
    if (password.length < 6)
      return { ok: false, error: "Password must be at least 6 characters" };

    const firstAccount = createSubAccount("Account 1");
    const newState: WalletState = {
      walletId: id,
      accounts: [firstAccount],
      activeAccountId: firstAccount.id,
      creator: defaultCreator,
    };

    const serverResult = await apiRegister(id, password, newState);
    if (!serverResult.ok) return { ok: false, error: serverResult.error };

    saveStored(id, { ...newState, passwordHash: hashPassword(password) });
    setRegistry([...getRegistry(), id]);
    passwordRef.current = password;
    sessionStorage.setItem(SESSION_PW_KEY, password);
    setState(newState);
    return { ok: true };
  };

  const disconnect = () => setState(defaultState);

  const updateActiveAccount = (updater: (acc: SubAccount) => SubAccount) => {
    setState(prev => ({
      ...prev,
      accounts: prev.accounts.map(a =>
        a.id === prev.activeAccountId ? updater(a) : a
      ),
    }));
  };

  const deposit = (amount: number) =>
    updateActiveAccount(a => ({
      ...a,
      solBalance: a.solBalance + amount,
      simDelta: (a.simDelta ?? 0) + amount,
    }));

  const depositToAccount = (accountId: string, amount: number) =>
    setState(prev => ({
      ...prev,
      accounts: prev.accounts.map(a =>
        a.id === accountId
          ? { ...a, solBalance: a.solBalance + amount, simDelta: (a.simDelta ?? 0) + amount }
          : a
      ),
    }));

  const send = (amount: number, _address: string): boolean => {
    if (!activeAccount || activeAccount.solBalance < amount) return false;
    updateActiveAccount(a => ({
      ...a,
      solBalance: a.solBalance - amount,
      simDelta: (a.simDelta ?? 0) - amount,
    }));
    return true;
  };

  const updateHoldings = (coinId: string, change: number) =>
    updateActiveAccount(a => ({
      ...a,
      holdings: { ...a.holdings, [coinId]: Math.max(0, (a.holdings[coinId] || 0) + change) },
    }));

  const orderCard = (data: any) =>
    updateActiveAccount(a => ({ ...a, cardOrder: data }));

  const updateCreator = (data: Partial<CreatorData>) =>
    setState(prev => ({ ...prev, creator: { ...prev.creator, ...data } }));

  const buyAgent = (tier: AgentTier, cost: number): boolean => {
    if (!activeAccount || activeAccount.solBalance < cost) return false;
    const newAgent: Agent = {
      id: "AGT" + Math.floor(1000 + Math.random() * 9000),
      tier,
      purchasedAt: Date.now(),
      lastClaimedAt: Date.now(),
      earned: 0,
    };
    updateActiveAccount(a => ({
      ...a,
      solBalance: a.solBalance - cost,
      simDelta: (a.simDelta ?? 0) - cost,
      agents: [...a.agents, newAgent],
    }));
    return true;
  };

  const claimEarnings = () => {
    updateActiveAccount(a => {
      let totalClaimed = 0;
      const now = Date.now();
      const updatedAgents = a.agents.map(ag => {
        const daysElapsed = (now - ag.lastClaimedAt) / (1000 * 60 * 60 * 24);
        const rates: Record<AgentTier, number> = { NANO: 0.002, MICRO: 0.02, PRO: 0.1, ELITE: 1 };
        const earned = rates[ag.tier] * daysElapsed;
        totalClaimed += earned;
        return { ...ag, earned: ag.earned + earned, lastClaimedAt: now };
      });
      return {
        ...a,
        solBalance: a.solBalance + totalClaimed,
        simDelta: (a.simDelta ?? 0) + totalClaimed,
        agents: updatedAgents,
      };
    });
  };

  // syncSolBalance: called every ~20 s with the real on-chain value.
  // We keep the simulated delta (deposits/sends from trades) intact by
  // storing it separately — displayed balance = chainSOL + simDelta.
  const syncSolBalance = (chainSOL: number) =>
    updateActiveAccount(a => ({
      ...a,
      solBalance: chainSOL + (a.simDelta ?? 0),
      lastChainSOL: chainSOL,
    }));

  const addAccount = (name?: string) => {
    const accountName = name || `Account ${state.accounts.length + 1}`;
    const newAccount = createSubAccount(accountName);
    setState(prev => ({
      ...prev,
      accounts: [...prev.accounts, newAccount],
      activeAccountId: newAccount.id,
    }));
  };

  const addAccountFromPhrase = (phrase: string, name?: string): { ok: boolean; error?: string } => {
    const trimmed = phrase.trim().replace(/\s+/g, " ");
    if (!validateMnemonic(trimmed))
      return { ok: false, error: "Invalid recovery phrase. Please enter a valid 12 or 24-word mnemonic." };

    const accountName = name?.trim() || `Account ${state.accounts.length + 1}`;
    const { publicKey, secretKeyBytes } = keypairFromMnemonic(trimmed, 0);
    const newAccount: SubAccount = {
      id: "acc_" + Math.random().toString(36).slice(2) + Date.now().toString(36),
      name: accountName,
      address: publicKey,
      phrase: trimmed,
      privateKey: bytesToBase64(secretKeyBytes),
      solBalance: 0,
      holdings: {},
      agents: [],
      cardOrder: null,
    };
    setState(prev => ({
      ...prev,
      accounts: [...prev.accounts, newAccount],
      activeAccountId: newAccount.id,
    }));
    return { ok: true };
  };

  const addAccountFromPrivateKey = (privateKeyBase58: string, name?: string): { ok: boolean; error?: string } => {
    try {
      const trimmed = privateKeyBase58.trim();
      const rawBytes = fromBase58(trimmed);
      if (rawBytes.length !== 64)
        return { ok: false, error: "Invalid private key. Expected a 64-byte Solana private key in base58 format." };

      const { publicKey, secretKeyBytes } = keypairFromSecretBytes(rawBytes);
      const accountName = name?.trim() || `Account ${state.accounts.length + 1}`;
      const newAccount: SubAccount = {
        id: "acc_" + Math.random().toString(36).slice(2) + Date.now().toString(36),
        name: accountName,
        address: publicKey,
        phrase: "",
        privateKey: bytesToBase64(secretKeyBytes),
        solBalance: 0,
        holdings: {},
        agents: [],
        cardOrder: null,
      };
      setState(prev => ({
        ...prev,
        accounts: [...prev.accounts, newAccount],
        activeAccountId: newAccount.id,
      }));
      return { ok: true };
    } catch {
      return { ok: false, error: "Invalid private key format. Please provide a valid base58-encoded Solana private key." };
    }
  };

  const addWatchAddress = (address: string, name?: string) => {
    const trimmed = address.trim();
    const accountName = name?.trim() || `Watch ${state.accounts.length + 1}`;
    const newAccount: SubAccount = {
      id: "acc_" + Math.random().toString(36).slice(2) + Date.now().toString(36),
      name: accountName,
      address: trimmed,
      phrase: "",
      privateKey: "",
      solBalance: 0,
      holdings: {},
      agents: [],
      cardOrder: null,
    };
    setState(prev => ({
      ...prev,
      accounts: [...prev.accounts, newAccount],
      activeAccountId: newAccount.id,
    }));
  };

  const switchAccount = (id: string) => {
    if (state.accounts.find(a => a.id === id))
      setState(prev => ({ ...prev, activeAccountId: id }));
  };

  const removeAccount = (id: string): boolean => {
    if (state.accounts.length <= 1) return false;
    const remaining = state.accounts.filter(a => a.id !== id);
    const newActiveId = state.activeAccountId === id ? remaining[0].id : state.activeAccountId;
    setState(prev => ({ ...prev, accounts: remaining, activeAccountId: newActiveId }));
    return true;
  };

  const renameAccount = (id: string, name: string) =>
    setState(prev => ({
      ...prev,
      accounts: prev.accounts.map(a => a.id === id ? { ...a, name } : a),
    }));

  const getAccountPhrase = (id: string): string | null =>
    state.accounts.find(a => a.id === id)?.phrase ?? null;

  const getAccountPrivateKey = (id: string): string | null =>
    state.accounts.find(a => a.id === id)?.privateKey ?? null;

  useEffect(() => {
    if (!activeAccount || activeAccount.agents.length === 0) return;
    const interval = setInterval(() => claimEarnings(), 5000);
    return () => clearInterval(interval);
  }, [activeAccount?.agents.length, state.activeAccountId]);

  return (
    <WalletContext.Provider
      value={{
        walletId: state.walletId,
        accounts: state.accounts,
        activeAccountId: state.activeAccountId,
        creator: state.creator,
        address: activeAccount?.address ?? null,
        solBalance: activeAccount?.solBalance ?? 0,
        holdings: activeAccount?.holdings ?? {},
        agents: activeAccount?.agents ?? [],
        cardOrder: activeAccount?.cardOrder ?? null,
        connect,
        createWallet,
        importWallet,
        walletIdExists,
        checkWalletIdRemote,
        disconnect,
        deposit,
        send,
        updateHoldings,
        orderCard,
        updateCreator,
        buyAgent,
        claimEarnings,
        addAccount,
        addAccountFromPhrase,
        addAccountFromPrivateKey,
        addWatchAddress,
        switchAccount,
        removeAccount,
        renameAccount,
        getAccountPhrase,
        getAccountPrivateKey,
        syncSolBalance,
        depositToAccount,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
