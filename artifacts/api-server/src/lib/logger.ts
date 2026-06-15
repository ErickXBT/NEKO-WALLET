import pino from "pino";
import pretty from "pino-pretty";

const isProduction = process.env.NODE_ENV === "production";

const baseOptions = {
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
};

// In development we use pino-pretty as a synchronous destination stream rather
// than a worker-thread transport. The worker-thread transport cannot always
// flush within its timeout on shutdown ("_flushSync took too long"), which
// delays process exit and port release, causing EADDRINUSE on restart.
export const logger = isProduction
  ? pino(baseOptions)
  : pino(baseOptions, pretty({ colorize: true, sync: true }));
