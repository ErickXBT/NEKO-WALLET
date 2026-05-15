import { useQuery } from "@tanstack/react-query";

export interface TrendingToken {
  id: string;
  rank: number;
  name: string;
  symbol: string;
  image: string;
  price: number;
  priceChange24h: number;
  marketCap: number;
}

async function fetchSolanaTrending(): Promise<TrendingToken[]> {
  // Primary: CoinGecko Solana ecosystem tokens sorted by gecko score (trending)
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=solana-ecosystem&order=gecko_desc&per_page=10&page=1&sparkline=false&price_change_percentage=24h",
      { headers: { Accept: "application/json" } }
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((c: any, i: number) => ({
          id: c.id,
          rank: i + 1,
          name: c.name,
          symbol: c.symbol.toUpperCase(),
          image: c.image,
          price: c.current_price || 0,
          priceChange24h:
            c.price_change_percentage_24h_in_currency ??
            c.price_change_percentage_24h ??
            0,
          marketCap: c.market_cap || 0,
        }));
      }
    }
  } catch {}

  // Fallback: CoinGecko global trending search
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/search/trending"
    );
    if (res.ok) {
      const data = await res.json();
      return ((data.coins as any[]) || []).slice(0, 10).map((c, i) => ({
        id: c.item.id,
        rank: i + 1,
        name: c.item.name,
        symbol: (c.item.symbol as string).toUpperCase(),
        image: c.item.small,
        price: 0,
        priceChange24h:
          c.item.data?.price_change_percentage_24h?.usd ?? 0,
        marketCap: 0,
      }));
    }
  } catch {}

  return [];
}

export function useSolanaTrending() {
  return useQuery<TrendingToken[]>({
    queryKey: ["solana-trending"],
    queryFn: fetchSolanaTrending,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
}
