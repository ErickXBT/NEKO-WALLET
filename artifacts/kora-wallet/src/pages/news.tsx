import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useCryptoNews } from "@/hooks/use-coingecko";
import { useWallet } from "@/hooks/use-wallet";
import { ExternalLink, Clock, Newspaper, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";

function timeAgo(ts: number) {
  if (!ts) return "";
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const PLACEHOLDER = "data:image/svg+xml;utf8," + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 225'><defs><linearGradient id='g' x1='0' x2='1' y1='0' y2='1'><stop offset='0' stop-color='#1a0608'/><stop offset='1' stop-color='#FF2625' stop-opacity='0.4'/></linearGradient></defs><rect width='400' height='225' fill='url(#g)'/><text x='50%' y='50%' fill='%23FF2625' font-family='sans-serif' font-size='28' font-weight='900' text-anchor='middle' dominant-baseline='middle'>KORA NEWS</text></svg>`
);

export default function News() {
  const [, setLocation] = useLocation();
  const { walletId } = useWallet();
  const { data, isLoading, isFetching, refetch } = useCryptoNews();
  const [filter, setFilter] = useState("ALL");
  const queryClient = useQueryClient();

  useEffect(() => { if (!walletId) setLocation("/"); }, [walletId, setLocation]);
  if (!walletId) return null;

  const articles = Array.isArray(data) ? data : [];
  const sources = ["ALL", ...Array.from(new Set(articles.map((a) => a.source.toUpperCase())))];
  const filtered = filter === "ALL" ? articles : articles.filter((a) => a.source.toUpperCase() === filter);

  const featured = filtered[0];
  const rest = filtered.slice(1);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto w-full px-4 md:px-6 py-6 md:py-8">
        <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 text-primary text-[10px] font-bold tracking-widest mb-2">
              <Newspaper className="w-3.5 h-3.5" /> LIVE FEED
            </div>
            <h1 className="text-3xl font-black tracking-wider text-white">CRYPTO NEWS</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Aggregated from CoinDesk, Cointelegraph, Decrypt, The Block & Bitcoin Magazine — auto-refresh every 5 minutes
            </p>
          </div>
          <button
            onClick={() => { queryClient.invalidateQueries({ queryKey: ["crypto-news"] }); refetch(); }}
            disabled={isFetching}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/40 border border-border/40 hover:border-primary/40 text-xs font-bold tracking-wider text-white disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            REFRESH
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {sources.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold tracking-widest transition-all ${
                filter === t
                  ? "bg-gradient-to-r from-primary to-red-800 text-white shadow-[0_0_15px_rgba(255,38,37,0.4)]"
                  : "bg-secondary/40 text-muted-foreground hover:text-white border border-border/40"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-64 rounded-2xl bg-secondary/30 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            No news articles available right now. Try refreshing in a moment.
          </div>
        ) : (
          <>
            {featured && (
              <motion.a
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                href={featured.url} target="_blank" rel="noreferrer"
                className="block mb-6 group rounded-2xl overflow-hidden bg-card border border-primary/20 hover:border-primary/40 transition-all"
              >
                <div className="md:flex">
                  <div className="md:w-1/2 aspect-video md:aspect-auto overflow-hidden bg-secondary/50 relative">
                    <img
                      src={featured.imageurl || PLACEHOLDER}
                      alt={featured.title}
                      onError={(e) => (e.currentTarget.src = PLACEHOLDER)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-primary text-white text-[10px] font-bold tracking-widest">
                      FEATURED
                    </div>
                  </div>
                  <div className="md:w-1/2 p-6 flex flex-col justify-center">
                    <div className="flex items-center gap-2 text-[10px] tracking-widest font-bold mb-3">
                      <span className="text-primary">{featured.source.toUpperCase()}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(featured.published_on)}</span>
                    </div>
                    <h2 className="text-2xl font-black text-white leading-tight group-hover:text-primary transition-colors">
                      {featured.title}
                    </h2>
                    {featured.body && (
                      <p className="text-sm text-muted-foreground mt-3 line-clamp-3">{featured.body}</p>
                    )}
                    <div className="flex items-center gap-1 text-xs text-primary mt-4 font-bold tracking-wider">
                      READ MORE <ExternalLink className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              </motion.a>
            )}

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rest.slice(0, 30).map((a, i) => (
                <motion.a
                  key={a.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.4) }}
                  href={a.url} target="_blank" rel="noreferrer"
                  className="group rounded-2xl overflow-hidden bg-card border border-border/40 hover:border-primary/30 transition-all flex flex-col"
                >
                  <div className="aspect-video overflow-hidden bg-secondary/50 relative">
                    <img
                      src={a.imageurl || PLACEHOLDER}
                      alt={a.title}
                      loading="lazy"
                      onError={(e) => (e.currentTarget.src = PLACEHOLDER)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur text-white text-[9px] font-bold tracking-widest">
                      {a.source.toUpperCase()}
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="text-[10px] text-muted-foreground tracking-widest font-bold flex items-center gap-1 mb-2">
                      <Clock className="w-3 h-3" />{timeAgo(a.published_on)}
                    </div>
                    <h3 className="text-sm font-bold text-white leading-snug group-hover:text-primary transition-colors line-clamp-3">{a.title}</h3>
                    {a.body && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{a.body}</p>
                    )}
                    <div className="flex items-center gap-1 text-[10px] text-primary mt-auto pt-3 font-bold tracking-wider">
                      READ <ExternalLink className="w-3 h-3" />
                    </div>
                  </div>
                </motion.a>
              ))}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
