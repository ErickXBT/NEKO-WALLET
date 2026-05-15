/**
 * Jupiter Aggregator API v1 integration.
 * Provides swap quotes and pre-built Solana transactions for any SPL token pair.
 * https://lite-api.jup.ag/swap/v1
 */

const JUPITER_API = "https://lite-api.jup.ag/swap/v1";

// Well-known token mint addresses on Solana mainnet
export const TOKEN_MINTS: Record<string, string> = {
  SOL:  "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  JUP:  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  WIF:  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
  POPCAT: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
};

export interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
}

export interface JupiterSwapResult {
  swapTransaction: string; // base64 versioned transaction (unsigned)
  lastValidBlockHeight: number;
}

/**
 * Get a swap quote from Jupiter.
 * @param inputMint  Mint address of the token to sell
 * @param outputMint Mint address of the token to buy
 * @param amountRaw  Amount of input token in smallest unit (lamports for SOL)
 * @param slippageBps Slippage tolerance in basis points (50 = 0.5%)
 */
export async function getSwapQuote(
  inputMint: string,
  outputMint: string,
  amountRaw: number,
  slippageBps = 50,
): Promise<JupiterQuote> {
  const url = new URL(`${JUPITER_API}/quote`);
  url.searchParams.set("inputMint", inputMint);
  url.searchParams.set("outputMint", outputMint);
  url.searchParams.set("amount", String(Math.round(amountRaw)));
  url.searchParams.set("slippageBps", String(slippageBps));
  url.searchParams.set("onlyDirectRoutes", "false");
  url.searchParams.set("asLegacyTransaction", "false");

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jupiter quote failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(`Jupiter: ${data.error}`);
  return data as JupiterQuote;
}

/**
 * Build a swap transaction from a Jupiter quote.
 * Returns the unsigned base64-encoded versioned Solana transaction.
 */
export async function buildSwapTransaction(
  quote: JupiterQuote,
  userPublicKey: string,
): Promise<JupiterSwapResult> {
  const res = await fetch(`${JUPITER_API}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey,
      wrapAndUnwrapSol: true,
      computeUnitPriceMicroLamports: "auto",
      dynamicComputeUnitLimit: true,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jupiter swap build failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(`Jupiter swap: ${data.error}`);
  return { swapTransaction: data.swapTransaction, lastValidBlockHeight: data.lastValidBlockHeight };
}

/** Token info returned by Jupiter token list */
export interface JupiterToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

/** Fetch token metadata from Jupiter token list by mint address */
export async function getTokenInfo(mint: string): Promise<JupiterToken | null> {
  try {
    const res = await fetch(`https://lite-api.jup.ag/tokens/v1/token/${mint}`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Convert amount to display string given decimals */
export function formatTokenAmount(rawAmount: string, decimals: number, precision = 6): string {
  const n = Number(rawAmount) / Math.pow(10, decimals);
  if (n === 0) return "0";
  if (n < 0.000001) return n.toExponential(2);
  return n.toLocaleString("en-US", { maximumFractionDigits: precision, minimumFractionDigits: 0 });
}
