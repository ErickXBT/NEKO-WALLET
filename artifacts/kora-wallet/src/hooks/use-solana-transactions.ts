import { useQuery } from "@tanstack/react-query";

const RPCS = [
  "https://solana.publicnode.com",
  "https://solana-rpc.publicnode.com",
];

export interface SolTx {
  signature: string;
  blockTime: number;
  slot: number;
  err: any;
  type: "received" | "sent";
  amount: number;
  counterparty: string;
}

async function fetchTxs(address: string, limit: number): Promise<SolTx[]> {
  for (const rpc of RPCS) {
    try {
      const sigsRes = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1,
          method: "getSignaturesForAddress",
          params: [address, { limit }],
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!sigsRes.ok) continue;
      const sigsData = await sigsRes.json();
      const sigs: any[] = sigsData.result ?? [];
      if (sigs.length === 0) return [];

      const txResults = await Promise.all(
        sigs.map(async (sig: any) => {
          const txRes = await fetch(rpc, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0", id: 1,
              method: "getTransaction",
              params: [sig.signature, { encoding: "json", maxSupportedTransactionVersion: 0 }],
            }),
            signal: AbortSignal.timeout(10_000),
          });
          if (!txRes.ok) return null;
          const txData = await txRes.json();
          return { sig, tx: txData.result };
        })
      );

      const parsed: SolTx[] = [];
      for (const r of txResults) {
        if (!r?.tx) continue;
        const { sig, tx } = r;
        const meta = tx.meta;
        if (!meta) continue;

        const accountKeys: string[] = tx.transaction?.message?.accountKeys ?? [];
        const myIdx = accountKeys.indexOf(address);
        if (myIdx < 0) continue;

        const pre = meta.preBalances?.[myIdx] ?? 0;
        const post = meta.postBalances?.[myIdx] ?? 0;
        const diff = post - pre;
        const amount = Math.abs(diff) / 1e9;
        const type: "sent" | "received" = diff < 0 ? "sent" : "received";

        let counterparty = "Unknown";
        for (let i = 0; i < accountKeys.length; i++) {
          if (i === myIdx) continue;
          const k = accountKeys[i];
          if (k === "11111111111111111111111111111111") continue;
          counterparty = `${k.slice(0, 4)}...${k.slice(-4)}`;
          break;
        }

        if (amount > 0) {
          parsed.push({
            signature: sig.signature,
            blockTime: sig.blockTime ?? 0,
            slot: sig.slot ?? 0,
            err: sig.err,
            type,
            amount,
            counterparty,
          });
        }
      }
      return parsed;
    } catch {
      continue;
    }
  }
  return [];
}

export function useSolanaTransactions(address: string | null, limit = 10) {
  return useQuery({
    queryKey: ["solana-txs", address, limit],
    queryFn: () => (address ? fetchTxs(address, limit) : []),
    enabled: !!address,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  });
}
