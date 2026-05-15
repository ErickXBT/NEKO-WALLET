import { useState, useEffect } from "react";

export interface CALiveData {
  name: string;
  symbol: string;
  image: string | null;
  price: number;
  chain: string;
  priceChange1h: number | null;
  priceChange6h: number | null;
  priceChange24h: number | null;
  pairAddress: string;
  dexId: string;
  volume24h: number;
  liquidity: number;
  marketCap: number;
  fdv: number;
  txns24hBuys: number;
  txns24hSells: number;
  dexUrl: string;
  websites: string[];
  socials: { type: string; url: string }[];
}

async function fetchCAData(address: string): Promise<CALiveData | null> {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`,
      { signal: AbortSignal.timeout(9000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const pairs: any[] = data?.pairs ?? [];
    if (!pairs.length) return null;
    const best = pairs.reduce((a: any, b: any) =>
      (b.liquidity?.usd ?? 0) > (a.liquidity?.usd ?? 0) ? b : a
    );
    return {
      name: best.baseToken?.name ?? "Unknown",
      symbol: (best.baseToken?.symbol ?? "???").toUpperCase(),
      image: best.info?.imageUrl ?? null,
      price: parseFloat(best.priceUsd ?? "0") || 0,
      chain: best.chainId ?? "unknown",
      priceChange1h: best.priceChange?.h1 != null ? Number(best.priceChange.h1) : null,
      priceChange6h: best.priceChange?.h6 != null ? Number(best.priceChange.h6) : null,
      priceChange24h: best.priceChange?.h24 != null ? Number(best.priceChange.h24) : null,
      pairAddress: best.pairAddress ?? "",
      dexId: best.dexId ?? "",
      volume24h: best.volume?.h24 ?? 0,
      liquidity: best.liquidity?.usd ?? 0,
      marketCap: best.marketCap ?? best.fdv ?? 0,
      fdv: best.fdv ?? 0,
      txns24hBuys: best.txns?.h24?.buys ?? 0,
      txns24hSells: best.txns?.h24?.sells ?? 0,
      dexUrl: best.url ?? `https://dexscreener.com/${best.chainId ?? ""}/${best.pairAddress ?? ""}`,
      websites: (best.info?.websites ?? []).map((w: any) => w.url ?? w).filter(Boolean),
      socials: (best.info?.socials ?? []).map((s: any) => ({ type: s.type ?? "", url: s.url ?? "" })).filter((s: any) => s.url),
    };
  } catch {
    return null;
  }
}

function caStorageKey(walletId: string) {
  return `neko_custom_coins_${walletId.toUpperCase()}`;
}

export function useCAPrices(
  caIds: string[],
  walletId: string | null,
  intervalMs = 60_000,
): Record<string, CALiveData> {
  const [liveData, setLiveData] = useState<Record<string, CALiveData>>({});

  const filteredIds = caIds.filter(id => id.startsWith("ca:"));
  const caKey = [...filteredIds].sort().join(",");

  useEffect(() => {
    if (!caKey || !walletId) return;

    let cancelled = false;

    const refresh = async () => {
      const ids = caKey.split(",").filter(Boolean);
      const results: Record<string, CALiveData> = {};

      await Promise.all(
        ids.map(async id => {
          const address = id.slice(3);
          const data = await fetchCAData(address);
          if (data && !cancelled) results[id] = data;
        })
      );

      if (cancelled || Object.keys(results).length === 0) return;

      setLiveData(prev => ({ ...prev, ...results }));

      try {
        const key = caStorageKey(walletId);
        const existing: any[] = JSON.parse(localStorage.getItem(key) ?? "[]");
        let updated = existing.map((c: any) =>
          results[c.id]
            ? { ...c, ...results[c.id], id: c.id, address: c.address ?? c.id.slice(3) }
            : c
        );
        for (const [id, d] of Object.entries(results)) {
          if (!updated.some((c: any) => c.id === id)) {
            updated = [
              {
                id,
                name: d.name,
                symbol: d.symbol,
                image: d.image,
                address: id.slice(3),
                chain: d.chain,
                price: d.price,
                addedAt: Date.now(),
              },
              ...updated,
            ];
          }
        }
        localStorage.setItem(key, JSON.stringify(updated));
      } catch { /* ignore */ }
    };

    refresh();
    const interval = setInterval(refresh, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [caKey, walletId, intervalMs]);

  return liveData;
}
