/**
 * Browser-native Solana keypair generation — fully synchronous.
 * Uses SLIP-0010 ED25519 derivation (Phantom-compatible path: m/44'/501'/index'/0').
 * Zero Node.js polyfills required.
 */

import { generateMnemonic as _gen, validateMnemonic as _validate, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha512 } from "@noble/hashes/sha2.js";
import { ed25519 } from "@noble/curves/ed25519.js";

// ─── Mnemonic ─────────────────────────────────────────────────────────────────

/** Generate a valid 12-word BIP39 mnemonic using @scure/bip39. */
export function generateMnemonic(): string {
  return _gen(wordlist, 128);
}

/** Validate a BIP39 mnemonic (checks words + checksum). */
export function validateMnemonic(mnemonic: string): boolean {
  if (!mnemonic || typeof mnemonic !== "string") return false;
  try {
    return _validate(mnemonic, wordlist);
  } catch {
    return false;
  }
}

// ─── SLIP-0010 ED25519 HD derivation ─────────────────────────────────────────

function masterKey(seed: Uint8Array) {
  const I = hmac(sha512, new TextEncoder().encode("ed25519 seed"), seed);
  return { key: I.slice(0, 32), chainCode: I.slice(32) };
}

function hardenedChild(
  parent: { key: Uint8Array; chainCode: Uint8Array },
  index: number
) {
  const buf = new Uint8Array(37);
  buf[0] = 0x00;
  buf.set(parent.key, 1);
  const hardened = (index + 0x80000000) >>> 0;
  new DataView(buf.buffer).setUint32(33, hardened, false);
  const I = hmac(sha512, parent.chainCode, buf);
  return { key: I.slice(0, 32), chainCode: I.slice(32) };
}

// ─── Base58 encoder ───────────────────────────────────────────────────────────

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function toBase58(bytes: Uint8Array): string {
  const digits: number[] = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let str = "";
  for (let k = 0; bytes[k] === 0 && k < bytes.length - 1; k++) str += "1";
  for (let q = digits.length - 1; q >= 0; q--) str += B58[digits[q]];
  return str;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface SolanaKeypair {
  /** Solana wallet address — base58 32-byte public key. Send SOL here. */
  publicKey: string;
  /** 64-byte secret key (seed||pubkey). Importable into Phantom as private key. */
  secretKeyBytes: Uint8Array;
}

/**
 * Derive a Solana keypair from a BIP39 mnemonic — synchronous.
 * Path: m/44'/501'/accountIndex'/0' (identical to Phantom).
 * The mnemonic imports directly into Phantom and produces the same address.
 */
export function keypairFromMnemonic(mnemonic: string, accountIndex = 0): SolanaKeypair {
  const seed = mnemonicToSeedSync(mnemonic); // sync PBKDF2 via @noble/hashes
  let node = masterKey(seed);
  for (const idx of [44, 501, accountIndex, 0]) {
    node = hardenedChild(node, idx);
  }
  const publicKeyBytes = ed25519.getPublicKey(node.key);
  const secretKeyBytes = new Uint8Array([...node.key, ...publicKeyBytes]);
  return {
    publicKey: toBase58(publicKeyBytes),
    secretKeyBytes,
  };
}

/** Decode a base58 string to Uint8Array. */
export function fromBase58(str: string): Uint8Array {
  const digits = [0];
  for (const char of str) {
    const value = B58.indexOf(char);
    if (value < 0) throw new Error(`Invalid base58 character: ${char}`);
    let carry = value;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] * 58;
      digits[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      digits.push(carry & 0xff);
      carry >>= 8;
    }
  }
  const result: number[] = [];
  for (const char of str) {
    if (char !== "1") break;
    result.push(0);
  }
  for (let i = digits.length - 1; i >= 0; i--) result.push(digits[i]);
  return new Uint8Array(result);
}

/**
 * Reconstruct a SolanaKeypair from a raw 64-byte Solana secret key
 * (32-byte seed || 32-byte public key), as exported by Phantom.
 */
export function keypairFromSecretBytes(secretKey64: Uint8Array): SolanaKeypair {
  if (secretKey64.length !== 64) throw new Error("Expected 64-byte secret key");
  const seed = secretKey64.slice(0, 32);
  const publicKeyBytes = ed25519.getPublicKey(seed);
  return {
    publicKey: toBase58(publicKeyBytes),
    secretKeyBytes: secretKey64,
  };
}

/** Safe base64 encode for Uint8Array (avoids stack-overflow on spread of large arrays). */
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

/** Encode 64-byte secret key to base58 for Phantom "Import Private Key" flow. */
export function encodePrivateKey(secretKeyBytes: Uint8Array): string {
  return toBase58(secretKeyBytes);
}
