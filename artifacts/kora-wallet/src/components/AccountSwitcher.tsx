import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Plus, Pencil, X, ArrowLeft, Eye, EyeOff, Loader2, ClipboardList, Download } from "lucide-react";
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

type SubView = "list" | "add-options" | "create" | "import-phrase" | "import-key" | "watch";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditAccount: (accountId: string) => void;
}

export function AccountSwitcher({ open, onOpenChange, onEditAccount }: Props) {
  const {
    walletId, accounts, activeAccountId,
    switchAccount, addAccount,
    addAccountFromPhrase, addAccountFromPrivateKey, addWatchAddress,
  } = useWallet();
  const { toast } = useToast();

  const [subView, setSubView] = useState<SubView>("list");
  const [loading, setLoading] = useState(false);

  // Create new account form
  const [createName, setCreateName] = useState("");

  // Import phrase form
  const [phrase, setPhrase] = useState("");
  const [phraseShowWords, setPhraseShowWords] = useState(false);
  const [phraseName, setPhraseName] = useState("");

  // Import private key form
  const [privateKey, setPrivateKey] = useState("");
  const [pkShow, setPkShow] = useState(false);
  const [pkName, setPkName] = useState("");

  // Watch address form
  const [watchAddr, setWatchAddr] = useState("");
  const [watchName, setWatchName] = useState("");

  const resetAll = () => {
    setSubView("list");
    setLoading(false);
    setCreateName("");
    setPhrase("");
    setPhraseName("");
    setPhraseShowWords(false);
    setPrivateKey("");
    setPkShow(false);
    setPkName("");
    setWatchAddr("");
    setWatchName("");
  };

  const handleClose = () => {
    resetAll();
    onOpenChange(false);
  };

  const handleBack = () => {
    if (subView === "add-options") {
      setSubView("list");
    } else {
      setSubView("add-options");
    }
  };

  const handleCreate = () => {
    const name = createName.trim() || undefined;
    addAccount(name);
    toast({ title: "Account created", description: `${name || `Account ${accounts.length + 1}`} added successfully.` });
    handleClose();
  };

  const handleImportPhrase = () => {
    setLoading(true);
    setTimeout(() => {
      const result = addAccountFromPhrase(phrase, phraseName || undefined);
      setLoading(false);
      if (!result.ok) {
        toast({ title: "Import failed", description: result.error, variant: "destructive" });
        return;
      }
      toast({ title: "Wallet imported", description: "Your account has been restored from the recovery phrase." });
      handleClose();
    }, 50);
  };

  const handleImportPrivateKey = () => {
    setLoading(true);
    setTimeout(() => {
      const result = addAccountFromPrivateKey(privateKey, pkName || undefined);
      setLoading(false);
      if (!result.ok) {
        toast({ title: "Import failed", description: result.error, variant: "destructive" });
        return;
      }
      toast({ title: "Account imported", description: "Your account has been imported successfully." });
      handleClose();
    }, 50);
  };

  const handleWatchAddress = () => {
    const trimmed = watchAddr.trim();
    if (!trimmed || trimmed.length < 32) {
      toast({ title: "Invalid address", description: "Please enter a valid Solana wallet address.", variant: "destructive" });
      return;
    }
    addWatchAddress(trimmed, watchName || undefined);
    toast({ title: "Address added", description: "Watching this address. It is read-only." });
    handleClose();
  };

  const wordCount = phrase.trim() ? phrase.trim().split(/\s+/).filter(Boolean).length : 0;

  const getTitle = () => {
    switch (subView) {
      case "add-options": return "Add Account";
      case "create": return "Create Account";
      case "import-phrase": return "Recovery Phrase";
      case "import-key": return "Private Key";
      case "watch": return "Watch Address";
      default: return "My Accounts";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xs p-0 bg-card border border-border/60 overflow-hidden gap-0">
        <DialogTitle className="sr-only">{getTitle()}</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            {subView !== "list" && (
              <button
                onClick={handleBack}
                className="text-muted-foreground hover:text-white transition-colors p-0.5"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              {subView === "list" && (
                <div className="text-[10px] text-muted-foreground tracking-widest font-bold uppercase mb-0.5">
                  {walletId}
                </div>
              )}
              <div className="text-sm font-bold text-white">{getTitle()}</div>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── LIST VIEW ── */}
        {subView === "list" && (
          <>
            <div className="py-2 max-h-[360px] overflow-auto">
              {accounts.map((account, index) => {
                const isActive = account.id === activeAccountId;
                const initials = getInitials(account.name);
                return (
                  <div
                    key={account.id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-secondary/40 transition-colors",
                      isActive && "bg-secondary/30"
                    )}
                    onClick={() => {
                      switchAccount(account.id);
                      handleClose();
                    }}
                  >
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-md",
                        getColor(index)
                      )}
                    >
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white truncate">{account.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {account.address.slice(0, 4)}...{account.address.slice(-4)}
                      </div>
                      <div className="text-xs text-primary font-bold mt-0.5">
                        {account.solBalance.toFixed(4)} SOL
                        {!account.privateKey && !account.phrase && (
                          <span className="ml-1.5 text-muted-foreground font-normal">(watch only)</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isActive && <Check className="w-4 h-4 text-primary" />}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditAccount(account.id);
                          handleClose();
                        }}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-secondary/60 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-4 py-3 border-t border-border/40">
              <Button
                variant="secondary"
                onClick={() => setSubView("add-options")}
                className="w-full rounded-full font-bold tracking-wider text-xs"
              >
                <Plus className="w-4 h-4 mr-2" /> ADD ACCOUNT
              </Button>
            </div>
          </>
        )}

        {/* ── ADD OPTIONS VIEW ── */}
        {subView === "add-options" && (
          <div className="py-3 px-3 space-y-2">
            {[
              {
                icon: <Plus className="w-5 h-5" />,
                title: "Create New Account",
                sub: "Generate a new Solana account",
                action: () => setSubView("create"),
              },
              {
                icon: <ClipboardList className="w-5 h-5" />,
                title: "Import Recovery Phrase",
                sub: "Restore from 12 or 24-word phrase",
                action: () => setSubView("import-phrase"),
              },
              {
                icon: <Download className="w-5 h-5" />,
                title: "Import Private Key",
                sub: "Import a single Solana account",
                action: () => setSubView("import-key"),
              },
              {
                icon: <Eye className="w-5 h-5" />,
                title: "Watch Address",
                sub: "Track any public wallet address",
                action: () => setSubView("watch"),
              },
            ].map((opt) => (
              <button
                key={opt.title}
                onClick={opt.action}
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl bg-secondary/40 hover:bg-secondary/70 border border-border/40 hover:border-primary/30 transition-all text-left group"
              >
                <div className="w-9 h-9 rounded-full bg-secondary/60 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                  {opt.icon}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{opt.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{opt.sub}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── CREATE NEW ACCOUNT VIEW ── */}
        {subView === "create" && (
          <div className="px-4 py-4 space-y-4">
            <p className="text-xs text-muted-foreground">A new Solana account with a fresh seed phrase will be created in your wallet.</p>
            <div>
              <label className="text-[10px] text-muted-foreground tracking-widest font-bold">ACCOUNT NAME (OPTIONAL)</label>
              <Input
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                placeholder={`Account ${accounts.length + 1}`}
                className="mt-1 bg-secondary/40 border-border/40"
              />
            </div>
            <Button
              onClick={handleCreate}
              className="w-full rounded-full font-bold tracking-wider bg-gradient-to-r from-primary to-[#8a9500] text-primary-foreground"
            >
              CREATE ACCOUNT
            </Button>
          </div>
        )}

        {/* ── IMPORT RECOVERY PHRASE VIEW ── */}
        {subView === "import-phrase" && (
          <div className="px-4 py-4 space-y-4">
            <p className="text-xs text-muted-foreground">Enter your 12 or 24-word recovery phrase to restore an existing wallet account.</p>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-muted-foreground tracking-widest font-bold">RECOVERY PHRASE</label>
                <button
                  onClick={() => setPhraseShowWords(v => !v)}
                  className="text-xs text-muted-foreground hover:text-white flex items-center gap-1"
                >
                  {phraseShowWords ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {phraseShowWords ? "Hide" : "Show"}
                </button>
              </div>
              <textarea
                value={phrase}
                onChange={e => setPhrase(e.target.value)}
                placeholder="word1 word2 word3 ..."
                rows={3}
                className={cn(
                  "w-full rounded-lg bg-secondary/40 border border-border/40 px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 text-white placeholder:text-muted-foreground",
                  !phraseShowWords && phrase && "[filter:blur(4px)] focus:[filter:blur(0px)]"
                )}
              />
              {wordCount > 0 && (
                <div className={cn(
                  "text-[10px] mt-1 font-semibold",
                  wordCount === 12 || wordCount === 24 ? "text-primary" : "text-muted-foreground"
                )}>
                  {wordCount} word{wordCount !== 1 ? "s" : ""} entered
                  {(wordCount === 12 || wordCount === 24) && " ✓"}
                </div>
              )}
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground tracking-widest font-bold">ACCOUNT NAME (OPTIONAL)</label>
              <Input
                value={phraseName}
                onChange={e => setPhraseName(e.target.value)}
                placeholder={`Account ${accounts.length + 1}`}
                className="mt-1 bg-secondary/40 border-border/40"
              />
            </div>
            <Button
              onClick={handleImportPhrase}
              disabled={loading || (wordCount !== 12 && wordCount !== 24)}
              className="w-full rounded-full font-bold tracking-wider bg-gradient-to-r from-primary to-[#8a9500] text-primary-foreground disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              IMPORT ACCOUNT
            </Button>
          </div>
        )}

        {/* ── IMPORT PRIVATE KEY VIEW ── */}
        {subView === "import-key" && (
          <div className="px-4 py-4 space-y-4">
            <p className="text-xs text-muted-foreground">Paste your base58-encoded Solana private key (as exported from Phantom or Solflare).</p>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-muted-foreground tracking-widest font-bold">PRIVATE KEY</label>
                <button
                  onClick={() => setPkShow(v => !v)}
                  className="text-xs text-muted-foreground hover:text-white flex items-center gap-1"
                >
                  {pkShow ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {pkShow ? "Hide" : "Show"}
                </button>
              </div>
              <Input
                value={privateKey}
                onChange={e => setPrivateKey(e.target.value)}
                type={pkShow ? "text" : "password"}
                placeholder="5Jxxx..."
                className="bg-secondary/40 border-border/40 font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground tracking-widest font-bold">ACCOUNT NAME (OPTIONAL)</label>
              <Input
                value={pkName}
                onChange={e => setPkName(e.target.value)}
                placeholder={`Account ${accounts.length + 1}`}
                className="mt-1 bg-secondary/40 border-border/40"
              />
            </div>
            <Button
              onClick={handleImportPrivateKey}
              disabled={loading || !privateKey.trim()}
              className="w-full rounded-full font-bold tracking-wider bg-gradient-to-r from-primary to-[#8a9500] text-primary-foreground disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              IMPORT ACCOUNT
            </Button>
          </div>
        )}

        {/* ── WATCH ADDRESS VIEW ── */}
        {subView === "watch" && (
          <div className="px-4 py-4 space-y-4">
            <p className="text-xs text-muted-foreground">Enter any Solana wallet address to track its balance and activity. This is read-only — you cannot send from a watched address.</p>
            <div>
              <label className="text-[10px] text-muted-foreground tracking-widest font-bold">SOLANA ADDRESS</label>
              <Input
                value={watchAddr}
                onChange={e => setWatchAddr(e.target.value)}
                placeholder="Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"
                className="mt-1 bg-secondary/40 border-border/40 font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground tracking-widest font-bold">ACCOUNT NAME (OPTIONAL)</label>
              <Input
                value={watchName}
                onChange={e => setWatchName(e.target.value)}
                placeholder="Watch Account"
                className="mt-1 bg-secondary/40 border-border/40"
              />
            </div>
            <Button
              onClick={handleWatchAddress}
              disabled={!watchAddr.trim() || watchAddr.trim().length < 32}
              className="w-full rounded-full font-bold tracking-wider bg-gradient-to-r from-primary to-[#8a9500] text-primary-foreground disabled:opacity-50"
            >
              WATCH ADDRESS
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
