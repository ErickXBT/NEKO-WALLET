/**
 * Phantom-style transaction signing confirmation modal.
 * Shows transaction details, waits for user approval, then submits on-chain.
 */

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Loader2, ShieldCheck, ExternalLink } from "lucide-react";

type Phase = "review" | "submitting" | "success" | "error";

export interface TxDetail {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
  danger?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  details: TxDetail[];
  warningMessage?: string;
  /** Called when user clicks Confirm. Must return the tx signature on success. */
  onConfirm: () => Promise<string>;
  onSuccess?: (signature: string) => void;
}

function truncate(s: string, head = 8, tail = 8) {
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export function TxSignModal({
  open, onOpenChange, title = "APPROVE TRANSACTION",
  details, warningMessage, onConfirm, onSuccess,
}: Props) {
  const [phase, setPhase] = useState<Phase>("review");
  const [signature, setSignature] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const reset = () => {
    setPhase("review");
    setSignature("");
    setErrorMsg("");
  };

  const handleClose = () => {
    if (phase === "submitting") return;
    onOpenChange(false);
    setTimeout(reset, 300);
  };

  const handleConfirm = async () => {
    setPhase("submitting");
    try {
      const sig = await onConfirm();
      setSignature(sig);
      setPhase("success");
      onSuccess?.(sig);
    } catch (e) {
      setErrorMsg((e as Error).message ?? "Unknown error");
      setPhase("error");
    }
  };

  const handleReject = () => {
    onOpenChange(false);
    setTimeout(reset, 300);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="bg-[#0f0f14] border border-border/40 w-full max-w-sm p-0 gap-0">
        <DialogTitle className="sr-only">{title}</DialogTitle>

        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border/30">
          <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-black tracking-widest text-white">{title}</span>
          <div className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            MAINNET
          </div>
        </div>

        <AnimatePresence mode="wait">

          {/* ── REVIEW ── */}
          {phase === "review" && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              className="p-5 space-y-4"
            >
              {/* Details card */}
              <div className="rounded-2xl border border-border/30 bg-secondary/20 divide-y divide-border/20 overflow-hidden">
                {details.map((d, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 px-4 py-3">
                    <span className="text-[10px] text-muted-foreground tracking-widest font-bold shrink-0 mt-0.5">
                      {d.label}
                    </span>
                    <span className={[
                      "text-xs text-right break-all",
                      d.mono ? "font-mono" : "font-semibold",
                      d.highlight ? "text-primary font-black" : "",
                      d.danger ? "text-red-400" : "text-white",
                      !d.highlight && !d.danger ? "text-white" : "",
                    ].join(" ")}>
                      {d.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Warning */}
              {warningMessage && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <span className="text-amber-400 text-[10px] mt-0.5">⚠</span>
                  <p className="text-[10px] text-amber-300 leading-relaxed">{warningMessage}</p>
                </div>
              )}

              {/* Notice */}
              <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                This transaction will be submitted to the Solana blockchain and cannot be reversed.
              </p>

              {/* Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button variant="secondary" onClick={handleReject}
                  className="rounded-full font-bold tracking-wider h-11">
                  REJECT
                </Button>
                <Button onClick={handleConfirm}
                  className="rounded-full font-bold tracking-wider h-11 bg-gradient-to-r from-primary to-[#8a9500] text-primary-foreground">
                  CONFIRM
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── SUBMITTING ── */}
          {phase === "submitting" && (
            <motion.div
              key="submitting"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-16 px-5 gap-5"
            >
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-2 border-primary/20" />
                <Loader2 className="w-16 h-16 text-primary absolute inset-0 animate-spin" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-bold text-white">Submitting Transaction</p>
                <p className="text-xs text-muted-foreground">Broadcasting to Solana mainnet…</p>
              </div>
            </motion.div>
          )}

          {/* ── SUCCESS ── */}
          {phase === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center py-10 px-5 gap-5"
            >
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
              >
                <CheckCircle2 className="w-16 h-16 text-emerald-400" />
              </motion.div>
              <div className="text-center space-y-1">
                <p className="text-sm font-bold text-white">Transaction Confirmed!</p>
                <p className="text-xs text-muted-foreground">Successfully submitted to Solana</p>
              </div>
              {signature && (
                <div className="w-full rounded-xl border border-border/30 bg-secondary/20 p-3 space-y-2">
                  <p className="text-[10px] text-muted-foreground tracking-widest font-bold">SIGNATURE</p>
                  <p className="text-[10px] font-mono text-white break-all">{truncate(signature, 20, 20)}</p>
                  <a
                    href={`https://solscan.io/tx/${signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[10px] text-primary font-bold hover:underline mt-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View on Solscan
                  </a>
                </div>
              )}
              <Button onClick={handleClose}
                className="w-full rounded-full font-bold tracking-wider h-11 bg-gradient-to-r from-primary to-[#8a9500] text-primary-foreground">
                DONE
              </Button>
            </motion.div>
          )}

          {/* ── ERROR ── */}
          {phase === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center py-10 px-5 gap-5"
            >
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
              >
                <XCircle className="w-16 h-16 text-red-400" />
              </motion.div>
              <div className="text-center space-y-2">
                <p className="text-sm font-bold text-white">Transaction Failed</p>
                <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">{errorMsg}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full">
                <Button variant="secondary" onClick={handleClose}
                  className="rounded-full font-bold tracking-wider h-11">
                  CLOSE
                </Button>
                <Button onClick={() => { setPhase("review"); setErrorMsg(""); }}
                  className="rounded-full font-bold tracking-wider h-11 bg-gradient-to-r from-primary to-[#8a9500] text-primary-foreground">
                  TRY AGAIN
                </Button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
