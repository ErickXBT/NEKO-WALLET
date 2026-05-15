import { useQuery } from "@tanstack/react-query";

// These endpoints return Access-Control-Allow-Origin: * — safe to call directly from browser
const RPCS = [
  "https://solana.publicnode.com",
  "https://solana-rpc.publicnode.com",
  // Vite dev proxy as last-resort fallback (works in dev if browser can reach it)
  "/api/sol-rpc",
];

async function tryRpc(url: string, address: string): Promise<number | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [address, { commitment: "confirmed" }],
      }),
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.result?.value === "number") {
      return data.result.value / 1_000_000_000;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchOnChainSOL(address: string): Promise<number> {
  for (const rpc of RPCS) {
    const result = await tryRpc(rpc, address);
    if (result !== null) return result;
  }
  console.warn("[useSolanaBalance] all RPC endpoints failed for", address);
  return 0;
}

/** Looks like a valid Solana base58 address (32–44 chars). */
function isSolanaAddress(addr: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

/**
 * Fetches the real on-chain SOL balance for a Solana mainnet address.
 * Uses CORS-enabled public RPC endpoints so the browser can call directly.
 * Polls every 20 s.
 */
export function useSolanaBalance(address: string | null) {
  return useQuery({
    queryKey: ["solana-onchain", address],
    queryFn: () => (address ? fetchOnChainSOL(address) : 0),
    enabled: !!address && isSolanaAddress(address),
    staleTime: 15_000,
    refetchInterval: 20_000,
    refetchIntervalInBackground: true,
    retry: 1,
    retryDelay: 2000,
  });
}
