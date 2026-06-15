---
name: api-server port ownership & pino shutdown
description: Why the api-server kept crashing with EADDRINUSE on 8080, and how dev logging must be configured to avoid it.
---

## api-server runs on port 8080; "Start application" must own it
The kora-wallet frontend(s) proxy `/api/wallets` -> `http://localhost:8080` (see vite.config.ts). So exactly ONE api-server must hold 8080.

**Rule:** the `Start application` workflow runs both the api-server (`PORT=8080`) and the frontend (`PORT=5000`). The auto-managed `artifacts/api-server: API Server` workflow is redundant — it cannot be deleted (river PROHIBITED_ACTION) and does not reliably receive a `PORT`, so it fails harmlessly and never binds 8080. Its "failed" badge is cosmetic; do not try to "fix" it by giving it 8080 (that recreates the race).

**Why:** `artifacts/*` workflows are artifact-managed and immutable. Two processes racing for 8080 caused repeated EADDRINUSE.

## pino worker-transport hangs on shutdown -> delayed port release -> EADDRINUSE
`src/lib/logger.ts` originally used a pino **worker-thread transport** (`transport: { target: "pino-pretty" }`, bundled via `esbuild-plugin-pino` in build.mjs). On SIGTERM the worker thread's `flushSync` could not complete -> "_flushSync took too long (10s)" -> process took ~10s to exit -> port 8080 not released -> next start hit EADDRINUSE.

**Fix:** in dev, pass pino-pretty as a **synchronous destination stream** (`pino(opts, pretty({ colorize: true, sync: true }))`) instead of a transport. Removed the `esbuild-plugin-pino` plugin from build.mjs. Shutdown dropped from ~10s to ~22ms.

**How to apply:** never reintroduce a pino worker transport here. Keep `pino-pretty` in `dependencies` (not devDependencies) because logger.ts statically imports it and the server is esbuild-bundled at build time — a prod-only install before bundling would otherwise break the build.

## .replit port mappings (read-only, owned by a separate tool)
Mappings are: 5000->80 (main app/webview), 20624->3000 (artifact kora-wallet), 8082->3001 (mockup-sandbox). External port 80 routes cleanly to 5000, so NO TCP proxy is needed (an earlier 8081->5000 proxy workaround is obsolete).
