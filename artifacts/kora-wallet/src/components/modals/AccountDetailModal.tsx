import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  X, ArrowLeft, Eye, EyeOff, Copy, Check, AlertTriangle, Pencil, Trash2
} from "lucide-react";
import { useWallet } from "@/hooks/use-wallet";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ACCOUNT_COLORS = [
  "from-violet-500 to-purple-700",
  "from-blue-500 to-cyan-700",
  "from-emerald-500 to-teal-700",
  "from-orange-500 to-amber-700",
  "from-rose-500 to-pink-700",
  "from-indigo-500 to-blue-700",
  "from-teal-500 to-cyan-600",
  "from-fuchsia-500 to-purple-600",
];

function getColor(index: number) {
  return ACCOUNT_COLORS[index % ACCOUNT_COLORS.length];
}

function getInitials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

type View = "menu" | "rename" | "phrase" | "key" | "remove";

interface Props {
  accountId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccountDetailModal({ accountId, open, onOpenChange }: Props) {
  const { accounts, renameAccount, removeAccount, getAccountPhrase, getAccountPrivateKey, activeAccountId } = useWallet();
  const { toast } = useToast();
  const [view, setView] = useState<View>("menu");
  const [newName, setNewName] = useState("");
  const [revealPhrase, setRevealPhrase] = useState(false);
  const [revealKey, setRevealKey] = useState(false);
  const [copiedPhrase, setCopiedPhrase] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const accountIndex = accounts.findIndex(a => a.id === accountId);
  const account = accountIndex >= 0 ? accounts[accountIndex] : null;
  const isOnlyAccount = accounts.length <= 1;
  const phrase = accountId ? getAccountPhrase(accountId) : null;
  const privateKey = accountId ? getAccountPrivateKey(accountId) : null;

  const close = () => {
    onOpenChange(false);
    setTimeout(() => {
      setView("menu");
      setNewName("");
      setRevealPhrase(false);
      setRevealKey(false);
    }, 200);
  };

  const back = () => {
    setView("menu");
    setRevealPhrase(false);
    setRevealKey(false);
    setNewName(account?.name || "");
  };

  const handleRename = () => {
    if (!accountId || !newName.trim()) return;
    renameAccount(accountId, newName.trim());
    toast({ title: "Account renamed" });
    setView("menu");
  };

  const handleRemove = () => {
    if (!accountId) return;
    const ok = removeAccount(accountId);
    if (ok) {
      toast({ title: "Account removed" });
      close();
    } else {
      toast({ title: "Cannot remove the only account", variant: "destructive" });
    }
  };

  const copyPhrase = () => {
    if (!phrase) return;
    navigator.clipboard.writeText(phrase);
    setCopiedPhrase(true);
    setTimeout(() => setCopiedPhrase(false), 1500);
  };

  const copyKey = () => {
    if (!privateKey) return;
    navigator.clipboard.writeText(privateKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 1500);
  };

  if (!account) return null;

  const initials = getInitials(account.name);
  const color = getColor(accountIndex);

  const viewTitle: Record<View, string> = {
    menu: "Edit Account",
    rename: "Rename Account",
    phrase: "Recovery Phrase",
    key: "Private Key",
    remove: "Remove Account",
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="bg-card border border-primary/20 max-w-md p-0 overflow-hidden gap-0">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              {view !== "menu" && (
                <button onClick={back} className="text-muted-foreground hover:text-white transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <h3 className="text-lg font-bold tracking-wider text-white">{viewTitle[view]}</h3>
            </div>
            <button onClick={close} className="text-muted-foreground hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* MENU VIEW */}
          {view === "menu" && (
            <div>
              {/* Avatar */}
              <div className="flex flex-col items-center mb-6">
                <div className={cn(
                  "w-20 h-20 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-black text-2xl shadow-lg mb-3",
                  color
                )}>
                  {initials}
                </div>
                <div className="text-white font-bold text-lg">{account.name}</div>
                <div className="text-xs text-muted-foreground font-mono mt-1">
                  {account.address.slice(0, 8)}...{account.address.slice(-8)}
                </div>
                <div className="text-sm text-primary font-bold mt-1">{account.solBalance.toFixed(4)} SOL</div>
              </div>

              {/* Menu items */}
              <div className="space-y-2">
                <button
                  onClick={() => { setNewName(account.name); setView("rename"); }}
                  className="w-full flex items-center justify-between p-4 bg-secondary/40 hover:bg-secondary/70 border border-border/40 rounded-xl transition-colors text-left"
                >
                  <div>
                    <div className="text-sm font-bold text-white">Account Name</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{account.name}</div>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Pencil className="w-4 h-4" />
                  </div>
                </button>

                <button
                  onClick={() => setView("phrase")}
                  className="w-full flex items-center justify-between p-4 bg-secondary/40 hover:bg-secondary/70 border border-border/40 rounded-xl transition-colors text-left"
                >
                  <div>
                    <div className="text-sm font-bold text-white">Show Recovery Phrase</div>
                    <div className="text-xs text-muted-foreground mt-0.5">12-word backup phrase</div>
                  </div>
                  <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
                </button>

                <button
                  onClick={() => setView("key")}
                  className="w-full flex items-center justify-between p-4 bg-secondary/40 hover:bg-secondary/70 border border-border/40 rounded-xl transition-colors text-left"
                >
                  <div>
                    <div className="text-sm font-bold text-white">Show Private Key</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Export secret key</div>
                  </div>
                  <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
                </button>

                <button
                  onClick={() => setView("remove")}
                  disabled={isOnlyAccount}
                  className={cn(
                    "w-full flex items-center justify-between p-4 border rounded-xl transition-colors text-left",
                    isOnlyAccount
                      ? "opacity-40 cursor-not-allowed bg-secondary/20 border-border/20"
                      : "bg-red-500/10 hover:bg-red-500/20 border-red-500/30"
                  )}
                >
                  <div>
                    <div className="text-sm font-bold text-red-400">Remove Account</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {isOnlyAccount ? "Cannot remove your only account" : "Permanently delete this account"}
                    </div>
                  </div>
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </div>
          )}

          {/* RENAME VIEW */}
          {view === "rename" && (
            <div className="space-y-5">
              <div className="flex flex-col items-center mb-4">
                <div className={cn(
                  "w-16 h-16 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-black text-xl shadow-lg",
                  color
                )}>
                  {initials}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground tracking-widest font-bold">ACCOUNT NAME</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Account name"
                  className="mt-2 bg-secondary/40 border-border/40 text-white h-12"
                  maxLength={30}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="secondary" onClick={back} className="rounded-full font-bold tracking-wider">
                  CANCEL
                </Button>
                <Button
                  onClick={handleRename}
                  disabled={!newName.trim()}
                  className="rounded-full font-bold tracking-wider bg-gradient-to-r from-primary to-[#8a9500] text-primary-foreground"
                >
                  SAVE
                </Button>
              </div>
            </div>
          )}

          {/* RECOVERY PHRASE VIEW */}
          {view === "phrase" && (
            <div>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 mb-5">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200/90 leading-relaxed">
                  Never share your recovery phrase. Anyone with this phrase can take your funds permanently.
                </div>
              </div>

              {!revealPhrase ? (
                <div className="grid grid-cols-3 gap-2 mb-5">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="p-2 bg-secondary/40 border border-border/40 rounded-lg text-center">
                      <div className="text-[10px] text-muted-foreground">{i + 1}</div>
                      <div className="text-sm font-mono text-white blur-sm select-none">word</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 mb-5">
                  {(phrase || "").split(" ").map((word, i) => (
                    <div key={i} className="p-2 bg-secondary/40 border border-primary/30 rounded-lg text-center">
                      <div className="text-[10px] text-muted-foreground">{i + 1}</div>
                      <div className="text-sm font-mono text-white font-bold">{word}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setRevealPhrase(r => !r)}
                  className="rounded-full font-bold tracking-wider"
                >
                  {revealPhrase ? <><EyeOff className="w-4 h-4 mr-1.5" /> HIDE</> : <><Eye className="w-4 h-4 mr-1.5" /> REVEAL</>}
                </Button>
                <Button
                  onClick={copyPhrase}
                  disabled={!revealPhrase}
                  className="rounded-full font-bold tracking-wider bg-gradient-to-r from-primary to-[#8a9500] text-primary-foreground disabled:opacity-50"
                >
                  {copiedPhrase ? <><Check className="w-4 h-4 mr-1.5" /> COPIED</> : <><Copy className="w-4 h-4 mr-1.5" /> COPY</>}
                </Button>
              </div>
            </div>
          )}

          {/* PRIVATE KEY VIEW */}
          {view === "key" && (
            <div>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 mb-5">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="text-xs text-red-200/90 leading-relaxed">
                  Never share your private key. Anyone with this key has full control of this account and its funds.
                </div>
              </div>

              <div className="text-[10px] text-muted-foreground tracking-widest font-bold mb-2">PRIVATE KEY</div>
              <div className="relative">
                <div className="p-4 pr-12 rounded-xl bg-secondary/50 border border-border font-mono text-xs text-white break-all min-h-[80px]">
                  {revealKey ? privateKey : "•".repeat(privateKey?.length || 88)}
                </div>
                <button
                  onClick={() => setRevealKey(r => !r)}
                  className="absolute top-3 right-3 text-muted-foreground hover:text-primary transition-colors"
                >
                  {revealKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5">
                <Button
                  variant="secondary"
                  onClick={() => setRevealKey(r => !r)}
                  className="rounded-full font-bold tracking-wider"
                >
                  {revealKey ? "HIDE" : "REVEAL"}
                </Button>
                <Button
                  onClick={copyKey}
                  disabled={!revealKey}
                  className="rounded-full font-bold tracking-wider bg-gradient-to-r from-primary to-[#8a9500] text-primary-foreground disabled:opacity-50"
                >
                  {copiedKey ? <><Check className="w-4 h-4 mr-1.5" /> COPIED</> : <><Copy className="w-4 h-4 mr-1.5" /> COPY KEY</>}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-4">
                Copy is enabled only after revealing the key.
              </p>
            </div>
          )}

          {/* REMOVE VIEW */}
          {view === "remove" && (
            <div>
              <div className="flex flex-col items-center mb-6">
                <div className={cn(
                  "w-16 h-16 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-black text-xl shadow-lg mb-3",
                  color
                )}>
                  {initials}
                </div>
                <div className="text-white font-bold">{account.name}</div>
              </div>

              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 mb-5">
                <div className="text-sm font-bold text-red-400 mb-1">This action cannot be undone</div>
                <div className="text-xs text-red-200/80 leading-relaxed">
                  Removing this account will permanently delete its keys from this device.
                  Make sure you have backed up the recovery phrase before proceeding.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button variant="secondary" onClick={back} className="rounded-full font-bold tracking-wider">
                  CANCEL
                </Button>
                <Button
                  onClick={handleRemove}
                  className="rounded-full font-bold tracking-wider bg-red-600 hover:bg-red-700 text-white"
                >
                  REMOVE
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
