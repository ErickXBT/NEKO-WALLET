import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWallet } from "@/hooks/use-wallet";
import { Logo } from "@/components/Logo";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { Check, X, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";

type Tab = "connect" | "create" | "import";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("connect");

  const [loginId, setLoginId] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [newId, setNewId] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [remoteChecking, setRemoteChecking] = useState(false);
  const [remoteTaken, setRemoteTaken] = useState<boolean | null>(null);

  const [impInput, setImpInput] = useState("");
  const [impShowInput, setImpShowInput] = useState(false);
  const [impLoading, setImpLoading] = useState(false);

  const [, setLocation] = useLocation();
  const { connect, createWallet, importDirect, walletIdExists, checkWalletIdRemote } = useWallet();
  const { toast } = useToast();

  const cleanNewId = newId.trim().toUpperCase();
  const idValid = /^[A-Z0-9_]{4,20}$/.test(cleanNewId);
  const idLocallyTaken = idValid && walletIdExists(cleanNewId);
  const idTaken = idLocallyTaken || remoteTaken === true;
  const idAvailable = idValid && !idTaken && remoteTaken === false;
  const pwLongEnough = newPw.length >= 6;
  const pwMatches = newPw.length > 0 && newPw === confirmPw;
  const canCreate = idAvailable && pwLongEnough && pwMatches && !createLoading;

  useEffect(() => {
    if (!idValid || idLocallyTaken) { setRemoteTaken(null); return; }
    setRemoteTaken(null);
    setRemoteChecking(true);
    const timer = setTimeout(async () => {
      const taken = await checkWalletIdRemote(cleanNewId);
      setRemoteTaken(taken);
      setRemoteChecking(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [cleanNewId, idValid, idLocallyTaken]);

  const impTrimmed = impInput.trim();
  const impWords = impTrimmed.toLowerCase().split(/\s+/).filter(Boolean);
  const impIsMnemonic = impWords.length === 12 || impWords.length === 24;
  const impIsPrivateKey = !impIsMnemonic && impTrimmed.length >= 32;
  const impDetected = impIsMnemonic ? `${impWords.length}-word seed phrase` : impIsPrivateKey ? "private key" : null;
  const canImport = (impIsMnemonic || impIsPrivateKey) && !impLoading;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    const res = await connect(loginId, loginPw);
    setLoginLoading(false);
    if (res.ok) {
      toast({ title: "Welcome back", description: `@${loginId.trim().toLowerCase()}` });
      setLocation("/wallet");
    } else {
      toast({ title: "Connection Failed", description: res.error, variant: "destructive" });
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) { toast({ title: "Please fix the form", variant: "destructive" }); return; }
    setCreateLoading(true);
    const res = await createWallet(cleanNewId, newPw);
    setCreateLoading(false);
    if (res.ok) {
      toast({ title: "Wallet created", description: `Welcome to NEKO, @${cleanNewId.toLowerCase()}` });
      setLocation("/wallet");
    } else {
      toast({ title: "Could not create wallet", description: res.error, variant: "destructive" });
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canImport) return;
    setImpLoading(true);
    const res = importDirect(impInput);
    setImpLoading(false);
    if (res.ok) {
      toast({ title: "Wallet imported", description: "Welcome back!" });
      setLocation("/wallet");
    } else {
      toast({ title: "Import failed", description: res.error, variant: "destructive" });
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "connect", label: "Connect" },
    { key: "create", label: "Create" },
    { key: "import", label: "Import" },
  ];

  return (
    <AppLayout showNav={false}>
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="z-10 w-full max-w-md">
          <div className="flex flex-col items-center mb-10">
            <Logo size={88} glow className="mb-6" />
            <h1 className="text-3xl font-bold tracking-widest uppercase">Neko Wallet</h1>
          </div>

          <div className="bg-card border border-card-border p-8 rounded-2xl shadow-2xl relative">
            <div className="flex w-full mb-8 border-b border-border">
              {tabs.map(({ key, label }) => (
                <button
                  key={key}
                  className={`flex-1 pb-4 text-sm font-bold tracking-wider uppercase transition-colors relative ${
                    activeTab === key ? "text-primary" : "text-muted-foreground hover:text-white"
                  }`}
                  onClick={() => setActiveTab(key)}
                >
                  {label}
                  {activeTab === key && (
                    <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_10px_rgba(225,243,17,1)]" />
                  )}
                </button>
              ))}
            </div>

            {activeTab === "connect" && (
              <form onSubmit={handleConnect} className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Wallet ID</Label>
                  <Input
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value.toUpperCase())}
                    placeholder="YOURNAME"
                    className="bg-background/50 border-border/50 h-12 font-mono"
                    autoComplete="username"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Password</Label>
                  <Input
                    type="password"
                    value={loginPw}
                    onChange={(e) => setLoginPw(e.target.value)}
                    placeholder="••••••••"
                    className="bg-background/50 border-border/50 h-12"
                    autoComplete="current-password"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full h-12 bg-gradient-to-r from-primary to-[#8a9500] hover:opacity-90 text-primary-foreground font-bold tracking-widest uppercase shadow-[0_0_15px_rgba(225,243,17,0.3)] disabled:opacity-60"
                >
                  {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Access Wallet"}
                </Button>
                <button
                  type="button"
                  onClick={() => setActiveTab("create")}
                  className="block w-full text-center text-xs text-muted-foreground hover:text-primary"
                >
                  No wallet yet? <span className="text-primary font-bold">Create one</span>
                </button>
              </form>
            )}

            {activeTab === "create" && (
              <form onSubmit={handleCreate} className="space-y-5">
                <IdField
                  value={newId}
                  onChange={setNewId}
                  checking={remoteChecking}
                  available={idAvailable}
                  taken={idTaken}
                  valid={idValid}
                />
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">New Password</Label>
                  <Input
                    type="password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="At least 6 characters"
                    className="bg-background/50 border-border/50 h-12"
                    autoComplete="new-password"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Confirm Password</Label>
                  <Input
                    type="password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="Repeat your password"
                    className={`bg-background/50 h-12 ${confirmPw && !pwMatches ? "border-red-500/60" : "border-border/50"}`}
                    autoComplete="new-password"
                    required
                  />
                  {confirmPw && !pwMatches && (
                    <p className="text-[11px] text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Passwords do not match
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  By creating a wallet, you agree to store your recovery details safely. Lost passwords cannot be recovered.
                </p>
                <Button
                  type="submit"
                  disabled={!canCreate}
                  className="w-full h-12 bg-gradient-to-r from-primary to-[#8a9500] hover:opacity-90 text-primary-foreground font-bold tracking-widest uppercase shadow-[0_0_15px_rgba(225,243,17,0.3)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {createLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate Wallet"}
                </Button>
              </form>
            )}

            {activeTab === "import" && (
              <form onSubmit={handleImport} className="space-y-5">
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground leading-relaxed">
                  Paste your <span className="text-primary font-semibold">12 or 24-word seed phrase</span> or <span className="text-primary font-semibold">private key</span>. Your Solana wallet will be restored instantly.
                </div>

                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Seed Phrase or Private Key</Label>
                  <div className="relative">
                    <textarea
                      value={impInput}
                      onChange={(e) => setImpInput(e.target.value)}
                      placeholder="word1 word2 … word12  or  base58 private key"
                      rows={3}
                      className={`w-full rounded-lg border px-3 py-3 text-sm font-mono bg-background/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors border-border/50 ${
                        impShowInput ? "text-foreground" : "text-transparent [text-shadow:0_0_8px_rgba(255,255,255,0.5)]"
                      }`}
                      autoComplete="off"
                      spellCheck={false}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setImpShowInput(v => !v)}
                      className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-white transition-colors"
                    >
                      {impShowInput ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {impTrimmed && (
                    <p className={`text-[11px] flex items-center gap-1 ${impDetected ? "text-green-500" : "text-amber-400"}`}>
                      <AlertCircle className="w-3 h-3" />
                      {impDetected ? `${impDetected} detected` : "Enter a valid 12/24-word seed phrase or base58 private key"}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={!canImport}
                  className="w-full h-12 bg-gradient-to-r from-primary to-[#8a9500] hover:opacity-90 text-primary-foreground font-bold tracking-widest uppercase shadow-[0_0_15px_rgba(225,243,17,0.3)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {impLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect Wallet"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function IdField({
  value,
  onChange,
  checking,
  available,
  taken,
  valid,
  label = "Choose your Wallet ID",
}: {
  value: string;
  onChange: (v: string) => void;
  checking: boolean;
  available: boolean;
  taken: boolean;
  valid: boolean;
  label?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder="YOURNAME"
          className="bg-background/50 border-border/50 h-12 font-mono pr-9"
          autoComplete="off"
          required
        />
        {value && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {checking ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : available ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : valid ? (
              <X className="w-4 h-4 text-red-500" />
            ) : null}
          </div>
        )}
      </div>
      {value && (
        <p className={`text-[11px] flex items-center gap-1 ${available ? "text-green-500" : checking ? "text-muted-foreground" : "text-red-400"}`}>
          <AlertCircle className="w-3 h-3" />
          {!valid
            ? "4–20 chars, A–Z, 0–9, underscore only"
            : checking
            ? "Checking availability..."
            : taken
            ? "This Wallet ID is already taken"
            : "Available!"}
        </p>
      )}
    </div>
  );
}
