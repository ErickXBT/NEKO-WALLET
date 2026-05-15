import { useQuery } from "@tanstack/react-query";

// ─── shared types ─────────────────────────────────────────────────────────────

export interface TrendingToken {
  address: string;
  chainId: string;
  pairAddress: string;
  name: string;
  symbol: string;
  image: string | null;
  price: number;
  priceChange1h: number;
  priceChange24h: number;
  priceChange7d: number;
  marketCap: number;
  volume24h: number;
}

export interface LaunchToken {
  address: string;
  chainId: string;
  name: string;
  symbol: string;
  image: string | null;
  marketCap: number;
  price: number;
  volume24h: number;
  createdAt: number;
  status: "new" | "migrating" | "migrated";
  bondingProgress?: number;  // 0-100
  holders?: number;
}

// ─── low-level fetchers ───────────────────────────────────────────────────────

async function dexGet(url: string): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchTokenPairs(addresses: string[]): Promise<any[]> {
  if (!addresses.length) return [];
  // DexScreener allows up to 30 per request
  const chunks: string[][] = [];
  for (let i = 0; i < addresses.length; i += 30) {
    chunks.push(addresses.slice(i, i + 30));
  }
  const results = await Promise.allSettled(
    chunks.map(chunk =>
      dexGet(`https://api.dexscreener.com/latest/dex/tokens/${chunk.join(",")}`)
        .then(d => (d.pairs ?? []) as any[])
    )
  );
  return results.flatMap(r => r.status === "fulfilled" ? r.value : []);
}

// Pick best pair for each base-token address (highest liquidity)
function buildBestPairMap(pairs: any[]): Map<string, any> {
  const m = new Map<string, any>();
  for (const p of pairs) {
    const k = (p.baseToken?.address ?? "").toLowerCase();
    if (!k) continue;
    const cur = m.get(k);
    if (!cur || (p.liquidity?.usd ?? 0) > (cur.liquidity?.usd ?? 0)) {
      m.set(k, p);
    }
  }
  return m;
}

// ─── TOKENS hook ─────────────────────────────────────────────────────────────

export function useDexTokens() {
  return useQuery({
    queryKey: ["dex-tokens-boost"],
    queryFn: async (): Promise<TrendingToken[]> => {
      const boosts: any[] = await dexGet("https://api.dexscreener.com/token-boosts/top/v1");

      // De-duplicate by address, take top 60
      const seen = new Map<string, string>(); // addr -> chainId
      for (const b of boosts) {
        const k = (b.tokenAddress ?? "").toLowerCase();
        if (k && !seen.has(k)) seen.set(k, b.chainId);
        if (seen.size >= 60) break;
      }

      const addrs = [...seen.keys()];
      const pairs = await fetchTokenPairs(addrs);
      const best = buildBestPairMap(pairs);

      const tokens: TrendingToken[] = [];
      for (const [addr, chainId] of seen) {
        const p = best.get(addr);
        if (!p?.priceUsd) continue;
        tokens.push({
          address: p.baseToken.address,
          chainId: p.chainId ?? chainId,
          pairAddress: p.pairAddress,
          name: p.baseToken.name ?? addr.slice(0, 8),
          symbol: (p.baseToken.symbol ?? "???").toUpperCase(),
          image: p.info?.imageUrl ?? null,
          price: parseFloat(p.priceUsd) || 0,
          priceChange1h: p.priceChange?.h1 ?? 0,
          priceChange24h: p.priceChange?.h24 ?? 0,
          priceChange7d: p.priceChange?.d7 ?? 0,
          marketCap: p.marketCap ?? p.fdv ?? 0,
          volume24h: p.volume?.h24 ?? 0,
        });
      }
      return tokens;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

// ─── LAUNCHES hook ────────────────────────────────────────────────────────────

// Try Pump.fun API first; falls back to DexScreener profiles
async function fetchPumpFun(status: "new" | "migrating" | "migrated"): Promise<LaunchToken[]> {
  const sortKey = status === "new" ? "creation_time" : "last_trade_timestamp";
  const raw: any[] = await fetch(
    `https://frontend-api.pump.fun/coins?offset=0&limit=50&sort=${sortKey}&order=DESC&includeNsfw=false`,
    { signal: AbortSignal.timeout(5000) }
  ).then(r => { if (!r.ok) throw new Error("pump.fun unavailable"); return r.json(); });

  let filtered = raw;
  if (status === "new") {
    filtered = raw.filter(c => !c.complete && c.raydium_pool === null);
  } else if (status === "migrating") {
    filtered = raw.filter(c =>
      !c.complete && (c.king_of_the_hill_timestamp !== null || (c.bonding_curve_progress ?? 0) > 0.5)
    );
  } else {
    filtered = raw.filter(c => c.complete === true || c.raydium_pool !== null);
  }

  return filtered.slice(0, 40).map((c: any): LaunchToken => ({
    address: c.mint ?? "",
    chainId: "solana",
    name: c.name ?? c.mint?.slice(0, 8) ?? "Unknown",
    symbol: (c.symbol ?? "???").toUpperCase(),
    image: c.image_uri ?? null,
    marketCap: c.usd_market_cap ?? c.market_cap ?? 0,
    price: 0,
    volume24h: c.volume_24h ?? 0,
    createdAt: (c.created_timestamp ?? 0) * 1000,
    status,
    bondingProgress: (c.bonding_curve_progress ?? 0) * 100,
    holders: c.holder_count,
  }));
}

async function fetchDexScreenerLaunches(status: "new" | "migrating" | "migrated"): Promise<LaunchToken[]> {
  const profiles: any[] = await dexGet("https://api.dexscreener.com/token-profiles/latest/v1");
  const slice = profiles.slice(0, 50);
  const addrs = [...new Set(slice.map((p: any) => p.tokenAddress as string))];
  const pairs = await fetchTokenPairs(addrs);
  const best = buildBestPairMap(pairs);
  const now = Date.now();

  return slice
    .map((prof: any): LaunchToken | null => {
      const p = best.get((prof.tokenAddress ?? "").toLowerCase());
      const name = p?.baseToken?.name ?? "";
      if (!name) return null;
      return {
        address: prof.tokenAddress ?? "",
        chainId: prof.chainId ?? p?.chainId ?? "unknown",
        name,
        symbol: (p?.baseToken?.symbol ?? "???").toUpperCase(),
        image: prof.icon ?? p?.info?.imageUrl ?? null,
        marketCap: p?.marketCap ?? p?.fdv ?? 0,
        price: parseFloat(p?.priceUsd ?? "0"),
        volume24h: p?.volume?.h24 ?? 0,
        createdAt: p?.pairCreatedAt ?? now - Math.random() * 3_600_000,
        status: "new" as const,
      };
    })
    .filter((t): t is LaunchToken => t !== null);
}

export function useDexLaunches(status: "new" | "migrating" | "migrated") {
  return useQuery({
    queryKey: ["dex-launches", status],
    queryFn: async (): Promise<LaunchToken[]> => {
      try {
        return await fetchPumpFun(status);
      } catch {
        // DexScreener fallback (only meaningful for "new")
        return fetchDexScreenerLaunches(status);
      }
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}
