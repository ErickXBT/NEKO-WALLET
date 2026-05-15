import { useQuery } from "@tanstack/react-query";

const COINGECKO_API = "https://api.coingecko.com/api/v3";

const NEWS_FEEDS: { source: string; url: string }[] = [
  { source: "Cointelegraph", url: "https://cointelegraph.com/rss" },
  { source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss" },
  { source: "Decrypt", url: "https://decrypt.co/feed" },
  { source: "Bitcoin Magazine", url: "https://bitcoinmagazine.com/.rss/full/" },
  { source: "The Block", url: "https://www.theblock.co/rss.xml" },
];

export interface CoinMarketData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  sparkline_in_7d?: { price: number[] };
}

export function useTopCoins() {
  return useQuery<CoinMarketData[]>({
    queryKey: ["top-coins"],
    queryFn: async () => {
      const res = await fetch(
        `${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=true&price_change_percentage=24h`
      );
      if (!res.ok) throw new Error("Failed to fetch top coins");
      return res.json();
    },
    staleTime: 60 * 1000, // 1 min
    refetchInterval: 60 * 1000,
  });
}

export interface CoinDetailChartData {
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
}

export function useCoinChart(id: string, days: string = "30") {
  return useQuery<CoinDetailChartData>({
    queryKey: ["coin-chart", id, days],
    queryFn: async () => {
      const res = await fetch(
        `${COINGECKO_API}/coins/${id}/market_chart?vs_currency=usd&days=${days}`
      );
      if (!res.ok) throw new Error("Failed to fetch coin chart");
      return res.json();
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

export interface NewsArticle {
  id: string;
  title: string;
  url: string;
  imageurl: string;
  source: string;
  published_on: number;
  body: string;
  tags: string;
}

interface RssItem {
  title: string;
  link: string;
  guid?: string;
  pubDate: string;
  description?: string;
  content?: string;
  thumbnail?: string;
  enclosure?: { link?: string; thumbnail?: string };
  categories?: string[];
}

interface Rss2JsonResponse {
  status: string;
  feed?: { title?: string; image?: string };
  items?: RssItem[];
}

function extractImage(item: RssItem): string {
  if (item.thumbnail) return item.thumbnail;
  if (item.enclosure?.link) return item.enclosure.link;
  if (item.enclosure?.thumbnail) return item.enclosure.thumbnail;
  const html = item.content || item.description || "";
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match) return match[1];
  return "";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

async function fetchFeed(feed: { source: string; url: string }): Promise<NewsArticle[]> {
  const proxied = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`;
  try {
    const res = await fetch(proxied);
    if (!res.ok) return [];
    const json: Rss2JsonResponse = await res.json();
    if (json.status !== "ok" || !Array.isArray(json.items)) return [];
    return json.items.map((it, idx) => ({
      id: it.guid || `${feed.source}-${idx}-${it.link}`,
      title: it.title,
      url: it.link,
      imageurl: extractImage(it),
      source: feed.source,
      published_on: Math.floor(new Date(it.pubDate).getTime() / 1000) || 0,
      body: stripHtml(it.description || it.content || "").slice(0, 280),
      tags: (it.categories || []).join(",").toUpperCase(),
    }));
  } catch {
    return [];
  }
}

export function useCryptoNews() {
  return useQuery<NewsArticle[]>({
    queryKey: ["crypto-news"],
    queryFn: async () => {
      const results = await Promise.all(NEWS_FEEDS.map(fetchFeed));
      const all = results.flat().filter((a) => a.title && a.url);
      // Sort newest first
      all.sort((a, b) => b.published_on - a.published_on);
      // Dedupe by URL
      const seen = new Set<string>();
      const unique = all.filter((a) => {
        if (seen.has(a.url)) return false;
        seen.add(a.url);
        return true;
      });
      return unique.slice(0, 60);
    },
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
