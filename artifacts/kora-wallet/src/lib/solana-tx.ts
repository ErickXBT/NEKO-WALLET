/**
 * Solana transaction builder & broadcaster — pure browser, zero Node.js polyfills.
 * Supports: SOL native transfers + SPL token transfers (with auto ATA creation).
 */

import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { fromBase58, base64ToBytes, toBase58 } from "./solana-keygen";

// ExtendedPoint is attached to the ed25519 object at runtime but not in the TS types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ExtendedPoint = (ed25519 as any).ExtendedPoint as { fromHex(hex: string): unknown };

// ── RPC endpoints ─────────────────────────────────────────────────────────────

const RPCS = [
  "https://solana.publicnode.com",
  "https://solana-rpc.publicnode.com",
];

export async function rpcCall(method: string, params: unknown[]): Promise<any> {
  let lastError: Error = new Error("No RPC endpoints");
  for (const rpc of RPCS) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) { lastError = new Error(`HTTP ${res.status}`); continue; }
      const data = await res.json();
      if (data.error) throw new Error(data.error.message ?? JSON.stringify(data.error));
      return data.result;
    } catch (e) {
      lastError = e as Error;
    }
  }
  throw lastError;
}

export async function getLatestBlockhash(): Promise<{
  blockhash: string;
  lastValidBlockHeight: number;
}> {
  const result = await rpcCall("getLatestBlockhash", [{ commitment: "confirmed" }]);
  return result.value;
}

export async function sendRawTransaction(txBase64: string): Promise<string> {
  return await rpcCall("sendTransaction", [
    txBase64,
    { encoding: "base64", preflightCommitment: "confirmed" },
  ]);
}

// ── Byte helpers ──────────────────────────────────────────────────────────────

function encodeCompactU16(n: number): Uint8Array {
  if (n < 0x80) return new Uint8Array([n]);
  if (n < 0x4000) return new Uint8Array([(n & 0x7f) | 0x80, n >> 7]);
  return new Uint8Array([(n & 0x7f) | 0x80, ((n >> 7) & 0x7f) | 0x80, n >> 14]);
}

function readCompactU16(bytes: Uint8Array, offset: number): [number, number] {
  let val = 0, shift = 0, len = 0;
  while (true) {
    const b = bytes[offset + len]; len++;
    val |= (b & 0x7f) << shift; shift += 7;
    if ((b & 0x80) === 0) break;
    if (shift >= 21) throw new Error("compact_u16 overflow");
  }
  return [val, len];
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── PDA / ATA derivation ──────────────────────────────────────────────────────

const TOKEN_PROGRAM_ID  = fromBase58("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA_PROGRAM_ID    = fromBase58("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bVU");
const SYSTEM_PROGRAM_ID = new Uint8Array(32);
const PDA_MARKER        = new TextEncoder().encode("ProgramDerivedAddress");

/** Returns hash if NOT on curve (valid PDA), null if on curve. */
function tryProgramAddress(seeds: Uint8Array[], programId: Uint8Array): Uint8Array | null {
  const h = sha256(concat(...seeds, programId, PDA_MARKER));
  try {
    ExtendedPoint.fromHex(bytesToHex(h));
    return null; // point is on curve → invalid PDA
  } catch {
    return h;   // not on curve → valid PDA
  }
}

/** Deterministically derives the Associated Token Account address. */
function deriveATA(owner: Uint8Array, mint: Uint8Array): Uint8Array {
  for (let bump = 255; bump >= 0; bump--) {
    const r = tryProgramAddress(
      [owner, TOKEN_PROGRAM_ID, mint, new Uint8Array([bump])],
      ATA_PROGRAM_ID,
    );
    if (r) return r;
  }
  throw new Error("Could not derive ATA address");
}

// ── SPL token on-chain balance fetch ─────────────────────────────────────────

export interface SPLBalance {
  ataAddress: string;
  uiAmount: number;
  rawAmount: string;
  decimals: number;
}

/** Fetch real on-chain SPL token balance for ownerAddress + mintAddress. */
export async function getSPLBalance(
  ownerAddress: string,
  mintAddress: string,
): Promise<SPLBalance | null> {
  const result = await rpcCall("getTokenAccountsByOwner", [
    ownerAddress,
    { mint: mintAddress },
    { encoding: "jsonParsed", commitment: "confirmed" },
  ]);
  const accounts: any[] = result?.value ?? [];
  if (accounts.length === 0) return null;
  const info = accounts[0].account.data.parsed.info;
  return {
    ataAddress: accounts[0].pubkey,
    uiAmount:   info.tokenAmount.uiAmount ?? 0,
    rawAmount:  info.tokenAmount.amount,
    decimals:   info.tokenAmount.decimals,
  };
}

/** Fetch token decimals from mint account (fallback when token info not available). */
export async function getMintDecimals(mintAddress: string): Promise<number> {
  const result = await rpcCall("getAccountInfo", [
    mintAddress,
    { encoding: "jsonParsed", commitment: "confirmed" },
  ]);
  return result?.value?.data?.parsed?.info?.decimals ?? 9;
}

// ── Legacy SOL Transfer ───────────────────────────────────────────────────────

function buildSOLTransferMessage(
  fromKey: Uint8Array,
  toKey: Uint8Array,
  lamports: bigint,
  blockhash: Uint8Array,
): Uint8Array {
  const instrData = new Uint8Array(12);
  new DataView(instrData.buffer).setUint32(0, 2, true);
  new DataView(instrData.buffer).setBigUint64(4, lamports, true);

  const instr = concat(
    new Uint8Array([2]),
    encodeCompactU16(2), new Uint8Array([0, 1]),
    encodeCompactU16(12), instrData,
  );

  return concat(
    new Uint8Array([1, 0, 1]),
    encodeCompactU16(3),
    fromKey, toKey, SYSTEM_PROGRAM_ID,
    blockhash,
    encodeCompactU16(1), instr,
  );
}

/** Build, sign, and submit a real SOL transfer on Solana mainnet. */
export async function transferSOL(
  fromAddress: string,
  toAddress: string,
  amountSOL: number,
  privateKeyBase64: string,
): Promise<string> {
  const lamports = BigInt(Math.round(amountSOL * 1_000_000_000));
  const { blockhash } = await getLatestBlockhash();

  const message = buildSOLTransferMessage(
    fromBase58(fromAddress), fromBase58(toAddress),
    lamports, fromBase58(blockhash),
  );

  const secretKey = base64ToBytes(privateKeyBase64);
  const sig = ed25519.sign(message, secretKey.slice(0, 32));
  const tx = concat(encodeCompactU16(1), sig, message);
  return await sendRawTransaction(toBase64(tx));
}

// ── SPL Token Transfer ────────────────────────────────────────────────────────

/**
 * Build the transaction message for:
 *   1. CreateAssociatedTokenAccount (idempotent) for the recipient
 *   2. SPL Token Transfer from sender ATA → recipient ATA
 *
 * Account layout (8 keys):
 *   0  owner         writable  signer
 *   1  senderATA     writable
 *   2  recipientATA  writable
 *   3  recipientWallet  readonly
 *   4  mint          readonly
 *   5  systemProgram readonly
 *   6  tokenProgram  readonly
 *   7  ataProgram    readonly
 *
 * Header: [1, 0, 5] (1 required signer, 0 readonly signed, 5 readonly unsigned)
 */
function buildSPLTransferMessage(
  ownerKey:       Uint8Array,
  senderATA:      Uint8Array,
  recipientATA:   Uint8Array,
  recipientKey:   Uint8Array,
  mintKey:        Uint8Array,
  rawAmount:      bigint,
  blockhash:      Uint8Array,
): Uint8Array {
  const header = new Uint8Array([1, 0, 5]);

  // ── Instruction 1: CreateAssociatedTokenAccount (idempotent) ─────────────
  const ataInstrData = new Uint8Array([1]); // discriminant 1 = CreateIdempotent
  const ataInstr = concat(
    new Uint8Array([7]),                      // programIdIndex = 7 (ataProgram)
    encodeCompactU16(6),                      // 6 account indices
    new Uint8Array([0, 2, 3, 4, 5, 6]),       // owner, recipientATA, recipientWallet, mint, sys, tok
    encodeCompactU16(1), ataInstrData,        // data
  );

  // ── Instruction 2: SPL Token Transfer ────────────────────────────────────
  const transferData = new Uint8Array(9);
  transferData[0] = 3; // Transfer discriminant
  new DataView(transferData.buffer).setBigUint64(1, rawAmount, true);
  const transferInstr = concat(
    new Uint8Array([6]),                      // programIdIndex = 6 (tokenProgram)
    encodeCompactU16(3),                      // 3 account indices
    new Uint8Array([1, 2, 0]),                // senderATA, recipientATA, owner(authority)
    encodeCompactU16(9), transferData,        // data
  );

  return concat(
    header,
    encodeCompactU16(8),
    ownerKey, senderATA, recipientATA, recipientKey, mintKey,
    SYSTEM_PROGRAM_ID, TOKEN_PROGRAM_ID, ATA_PROGRAM_ID,
    blockhash,
    encodeCompactU16(2),
    ataInstr, transferInstr,
  );
}

/**
 * Build, sign, and submit a real SPL token transfer on Solana mainnet.
 * Auto-creates the recipient's Associated Token Account if it doesn't exist.
 *
 * @param fromAddress      Owner's wallet address (base58)
 * @param toAddress        Recipient's wallet address (base58)
 * @param mintAddress      SPL token mint address (base58)
 * @param uiAmount         Human-readable amount (e.g. 10.5 for 10.5 USDC)
 * @param decimals         Token decimals (6 for USDC, 9 for most others)
 * @param privateKeyBase64 Owner's 64-byte private key, base64-encoded
 */
export async function transferSPL(
  fromAddress:      string,
  toAddress:        string,
  mintAddress:      string,
  uiAmount:         number,
  decimals:         number,
  privateKeyBase64: string,
): Promise<string> {
  const rawAmount = BigInt(Math.round(uiAmount * Math.pow(10, decimals)));

  const ownerKey     = fromBase58(fromAddress);
  const recipientKey = fromBase58(toAddress);
  const mintKey      = fromBase58(mintAddress);
  const senderATA    = deriveATA(ownerKey, mintKey);
  const recipientATA = deriveATA(recipientKey, mintKey);

  const { blockhash } = await getLatestBlockhash();

  const message = buildSPLTransferMessage(
    ownerKey, senderATA, recipientATA, recipientKey, mintKey,
    rawAmount, fromBase58(blockhash),
  );

  const secretKey = base64ToBytes(privateKeyBase64);
  const sig = ed25519.sign(message, secretKey.slice(0, 32));
  const tx = concat(encodeCompactU16(1), sig, message);

  return await sendRawTransaction(toBase64(tx));
}

/** Derive ATA address as base58 string (useful for display). */
export function getATAAddress(ownerAddress: string, mintAddress: string): string {
  const ata = deriveATA(fromBase58(ownerAddress), fromBase58(mintAddress));
  return toBase58(ata);
}

// ── Versioned Transaction Signing (Jupiter swaps) ────────────────────────────

export function signVersionedTransaction(
  txBase64: string,
  privateKeyBase64: string,
): string {
  const txBytes = Uint8Array.from(atob(txBase64), c => c.charCodeAt(0));
  const [nSigs, countLen] = readCompactU16(txBytes, 0);
  const messageBytes = txBytes.slice(countLen + nSigs * 64);

  const secretKey = base64ToBytes(privateKeyBase64);
  const sig = ed25519.sign(messageBytes, secretKey.slice(0, 32));

  const signedTx = new Uint8Array(txBytes);
  signedTx.set(sig, countLen);
  return toBase64(signedTx);
}
