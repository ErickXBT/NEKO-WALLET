import { useState, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, ChevronRight, ExternalLink, Search, Users, SlidersHorizontal,
  Shield, Globe, BookOpen, Layers, Code2, CircleHelp, Info, Lock,
  ArrowLeft, Pencil, User, KeyRound,
} from "lucide-react";
import { useWallet } from "@/hooks/use-wallet";
import nekoLogo from "@/assets/neko-logo.png";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onManageAccounts?: () => void;
}

type SubPage =
  | "profile"
  | "preferences"
  | "security"
  | "networks"
  | "addressbook"
  | "connectedapps"
  | "developer"
  | "about";

const AVATAR_KEY = "neko_profile_avatar";

function loadAvatar(): string | null {
  try { return localStorage.getItem(AVATAR_KEY); } catch { return null; }
}
function saveAvatar(dataUrl: string) {
  try { localStorage.setItem(AVATAR_KEY, dataUrl); } catch { /* ignore */ }
}

function SettingRow({
  icon: Icon,
  label,
  value,
  onClick,
  external = false,
}: {
  icon: React.ElementType;
  label: string;
  value?: React.ReactNode;
  onClick?: () => void;
  external?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 active:bg-white/10 transition-colors text-left"
    >
      <Icon className="w-5 h-5 shrink-0 text-muted-foreground" />
      <span className="flex-1 text-sm font-medium text-white">{label}</span>
      {value !== undefined && <span className="text-sm text-muted-foreground mr-1">{value}</span>}
      {external ? (
        <ExternalLink className="w-4 h-4 text-muted-foreground" />
      ) : (
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      )}
    </button>
  );
}

function SubPageView({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      key={title}
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="flex flex-col h-full"
    >
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border/40 shrink-0">
        <button onClick={onBack} className="text-muted-foreground hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-base font-semibold text-white">{title}</h2>
      </div>
      <div className="flex-1 overflow-auto p-4">{children}</div>
    </motion.div>
  );
}

export function SettingsModal({ open, onOpenChange, onManageAccounts }: Props) {
  const { walletId, accounts, disconnect } = useWallet();
  const [search, setSearch] = useState("");
  const [subPage, setSubPage] = useState<SubPage | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(loadAvatar);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const accountCount = accounts?.length ?? 1;

  const close = () => {
    onOpenChange(false);
    setTimeout(() => { setSubPage(null); setSearch(""); }, 300);
  };

  const handleManageAccounts = () => {
    close();
    onManageAccounts?.();
  };

  const handleAvatarChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setAvatarUrl(result);
      saveAvatar(result);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  const AvatarImg = ({ size = "md" }: { size?: "sm" | "md" | "lg" }) => {
    const cls = size === "lg" ? "w-24 h-24 text-2xl" : size === "md" ? "w-11 h-11 text-sm" : "w-8 h-8 text-xs";
    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt="Profile"
          className={`${cls} rounded-full object-cover border-2 border-primary/30 shadow-md`}
        />
      );
    }
    return (
      <div className={`${cls} rounded-full bg-gradient-to-br from-[#E1F311] to-[#8a9500] flex items-center justify-center overflow-hidden shadow-md shrink-0`}>
        <img src={nekoLogo} className="w-4/5 h-4/5 object-contain" alt="NEKO" />
      </div>
    );
  };

  const searchableItems = [
    { label: "Manage Profile", action: () => setSubPage("profile") },
    { label: "Manage Accounts", action: handleManageAccounts },
    { label: "Preferences", action: () => setSubPage("preferences") },
    { label: "Security & Privacy", action: () => setSubPage("security") },
    { label: "Active Networks", action: () => setSubPage("networks") },
    { label: "Address Book", action: () => setSubPage("addressbook") },
    { label: "Connected Apps", action: () => setSubPage("connectedapps") },
    { label: "Developer Settings", action: () => setSubPage("developer") },
    { label: "Help & Support", action: () => window.open("https://neko.wallet/support", "_blank") },
    { label: "About NEKO", action: () => setSubPage("about") },
  ];

  const filtered = search
    ? searchableItems.filter((i) => i.label.toLowerCase().includes(search.toLowerCase()))
    : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="settings-overlay"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "tween", duration: 0.22 }}
          className="fixed inset-0 z-[200] bg-background flex flex-col"
        >
          {/* Hidden file input for avatar upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />

          <AnimatePresence mode="wait">

            {/* ─── MAIN PAGE ─── */}
            {subPage === null && (
              <motion.div
                key="main"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ x: -30, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col h-full"
              >
                <div className="flex items-center justify-between px-4 py-4 border-b border-border/40 shrink-0">
                  <button onClick={close} className="text-muted-foreground hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                  <h1 className="text-base font-semibold text-white">Settings</h1>
                  <div className="w-5" />
                </div>

                <div className="flex-1 overflow-auto py-3 space-y-3">
                  {/* Search */}
                  <div className="px-4">
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-secondary/60 border border-border/40 rounded-xl">
                      <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search..."
                        className="bg-transparent text-sm text-white placeholder:text-muted-foreground outline-none flex-1"
                      />
                    </div>
                  </div>

                  {filtered ? (
                    <div className="px-4">
                      <div className="bg-secondary/40 border border-border/40 rounded-2xl overflow-hidden divide-y divide-border/30">
                        {filtered.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-6">No results</p>
                        )}
                        {filtered.map((item) => (
                          <SettingRow key={item.label} icon={ChevronRight} label={item.label} onClick={item.action} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Profile row */}
                      <div className="px-4">
                        <div className="bg-secondary/40 border border-border/40 rounded-2xl overflow-hidden">
                          <button
                            onClick={() => setSubPage("profile")}
                            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-white/5 transition-colors"
                          >
                            <div className="shrink-0">
                              <AvatarImg size="md" />
                            </div>
                            <div className="flex-1 text-left">
                              <div className="text-sm font-bold text-white">@{walletId}</div>
                              <div className="text-xs text-muted-foreground">Manage Profile</div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </div>
                      </div>

                      {/* Group 1 */}
                      <div className="px-4">
                        <div className="bg-secondary/40 border border-border/40 rounded-2xl overflow-hidden divide-y divide-border/30">
                          <SettingRow icon={Users} label="Manage Accounts" value={String(accountCount)} onClick={handleManageAccounts} />
                          <SettingRow icon={SlidersHorizontal} label="Preferences" onClick={() => setSubPage("preferences")} />
                          <SettingRow icon={Shield} label="Security & Privacy" onClick={() => setSubPage("security")} />
                        </div>
                      </div>

                      {/* Group 2 */}
                      <div className="px-4">
                        <div className="bg-secondary/40 border border-border/40 rounded-2xl overflow-hidden divide-y divide-border/30">
                          <SettingRow icon={Globe} label="Active Networks" value="All" onClick={() => setSubPage("networks")} />
                          <SettingRow icon={BookOpen} label="Address Book" onClick={() => setSubPage("addressbook")} />
                          <SettingRow icon={Layers} label="Connected Apps" onClick={() => setSubPage("connectedapps")} />
                        </div>
                      </div>

                      {/* Group 3 */}
                      <div className="px-4">
                        <div className="bg-secondary/40 border border-border/40 rounded-2xl overflow-hidden">
                          <SettingRow icon={Code2} label="Developer Settings" onClick={() => setSubPage("developer")} />
                        </div>
                      </div>

                      {/* Group 4 */}
                      <div className="px-4">
                        <div className="bg-secondary/40 border border-border/40 rounded-2xl overflow-hidden divide-y divide-border/30">
                          <SettingRow icon={CircleHelp} label="Help & Support" external onClick={() => window.open("https://neko.wallet/support", "_blank")} />
                          <SettingRow icon={Info} label="About NEKO" onClick={() => setSubPage("about")} />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Lock Wallet */}
                <div className="px-4 py-4 border-t border-border/40 shrink-0">
                  <button
                    onClick={() => { disconnect(); close(); }}
                    className="w-full py-4 rounded-2xl bg-secondary/60 border border-border/40 text-white font-bold text-sm hover:bg-secondary/80 active:bg-secondary transition-colors flex items-center justify-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    Lock Wallet
                  </button>
                </div>
              </motion.div>
            )}

            {/* ─── MANAGE PROFILE ─── */}
            {subPage === "profile" && (
              <SubPageView title="Manage Profile" onBack={() => setSubPage(null)}>
                <div className="space-y-6">
                  {/* Avatar */}
                  <div className="flex justify-center pt-4 pb-2">
                    <div className="relative">
                      <AvatarImg size="lg" />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-secondary border-2 border-background flex items-center justify-center hover:bg-secondary/80 transition-colors shadow-lg"
                        title="Change profile photo"
                      >
                        <Pencil className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  </div>

                  {/* About section */}
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold px-1 mb-2">About</p>
                    <div className="bg-secondary/40 border border-border/40 rounded-2xl overflow-hidden">
                      <button className="w-full flex items-center px-4 py-3.5 hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-3 flex-1">
                          <User className="w-5 h-5 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium text-white">Username</span>
                        </div>
                        <span className="text-sm text-muted-foreground mr-2">@{walletId}</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </button>
                    </div>
                  </div>

                  {/* Manage section */}
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold px-1 mb-2">Manage</p>
                    <div className="bg-secondary/40 border border-border/40 rounded-2xl overflow-hidden divide-y divide-border/30">
                      <button className="w-full flex items-center px-4 py-3.5 hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-3 flex-1">
                          <KeyRound className="w-5 h-5 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium text-white">Auth Factors</span>
                        </div>
                        <span className="text-sm text-muted-foreground mr-2">1</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </button>
                      <button className="w-full flex items-center px-4 py-3.5 hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-3 flex-1">
                          <Globe className="w-5 h-5 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium text-white">Privacy</span>
                        </div>
                        <span className="text-sm text-muted-foreground mr-2 flex items-center gap-1">
                          <Globe className="w-3.5 h-3.5" /> Public
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </button>
                    </div>
                  </div>

                  {/* Upload hint */}
                  <p className="text-xs text-muted-foreground text-center leading-relaxed">
                    Tap the pencil icon to choose a photo<br />from your device gallery.
                  </p>
                </div>
              </SubPageView>
            )}

            {/* ─── PREFERENCES ─── */}
            {subPage === "preferences" && (
              <SubPageView title="Preferences" onBack={() => setSubPage(null)}>
                <div className="bg-secondary/40 border border-border/40 rounded-2xl overflow-hidden divide-y divide-border/30">
                  {[{ label: "Currency", value: "USD" }, { label: "Language", value: "English" }, { label: "Theme", value: "Dark" }].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between px-4 py-3.5">
                      <span className="text-sm text-white">{label}</span>
                      <span className="text-sm text-muted-foreground">{value}</span>
                    </div>
                  ))}
                </div>
              </SubPageView>
            )}

            {/* ─── SECURITY ─── */}
            {subPage === "security" && (
              <SubPageView title="Security & Privacy" onBack={() => setSubPage(null)}>
                <div className="space-y-4">
                  <div className="bg-secondary/40 border border-border/40 rounded-2xl overflow-hidden divide-y divide-border/30">
                    {[{ label: "Auto-Lock Timer", value: "5 min" }, { label: "Biometric Unlock", value: "Off" }, { label: "Transaction Signing", value: "On" }].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between px-4 py-3.5">
                        <span className="text-sm text-white">{label}</span>
                        <span className="text-sm text-muted-foreground">{value}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground px-1 leading-relaxed">
                    Your private keys are stored locally and never sent to any server.
                  </p>
                </div>
              </SubPageView>
            )}

            {/* ─── NETWORKS ─── */}
            {subPage === "networks" && (
              <SubPageView title="Active Networks" onBack={() => setSubPage(null)}>
                <div className="space-y-2">
                  {["Solana", "Ethereum", "Bitcoin", "Monad", "Ethereum Base", "Sui", "Polygon", "Hyperliquid"].map((net) => (
                    <div key={net} className="flex items-center justify-between px-4 py-3 bg-secondary/40 border border-border/40 rounded-xl">
                      <span className="text-sm text-white">{net}</span>
                      <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.8)]" />
                    </div>
                  ))}
                </div>
              </SubPageView>
            )}

            {/* ─── ADDRESS BOOK ─── */}
            {subPage === "addressbook" && (
              <SubPageView title="Address Book" onBack={() => setSubPage(null)}>
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <BookOpen className="w-10 h-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground text-center leading-relaxed">
                    No saved addresses yet.<br />Send to an address to save it here.
                  </p>
                </div>
              </SubPageView>
            )}

            {/* ─── CONNECTED APPS ─── */}
            {subPage === "connectedapps" && (
              <SubPageView title="Connected Apps" onBack={() => setSubPage(null)}>
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <Layers className="w-10 h-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground text-center leading-relaxed">
                    No connected apps.<br />Connect a dApp to see it here.
                  </p>
                </div>
              </SubPageView>
            )}

            {/* ─── DEVELOPER ─── */}
            {subPage === "developer" && (
              <SubPageView title="Developer Settings" onBack={() => setSubPage(null)}>
                <div className="bg-secondary/40 border border-border/40 rounded-2xl overflow-hidden divide-y divide-border/30">
                  {[{ label: "Testnet Mode", value: "Off" }, { label: "RPC Endpoint", value: "Default" }, { label: "Show Test Networks", value: "Off" }].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between px-4 py-3.5">
                      <span className="text-sm text-white">{label}</span>
                      <span className="text-sm text-muted-foreground">{value}</span>
                    </div>
                  ))}
                </div>
              </SubPageView>
            )}

            {/* ─── ABOUT ─── */}
            {subPage === "about" && (
              <SubPageView title="About NEKO" onBack={() => setSubPage(null)}>
                <div className="flex flex-col items-center gap-5 pt-6">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#E1F311] to-[#8a9500] flex items-center justify-center overflow-hidden shadow-lg shadow-primary/20">
                    <img src={nekoLogo} className="w-16 h-16 object-contain" alt="NEKO" />
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-black text-white tracking-widest">NEKO WALLET</div>
                    <div className="text-sm text-muted-foreground mt-1">Version 1.0.0</div>
                  </div>
                  <div className="w-full bg-secondary/40 border border-border/40 rounded-2xl overflow-hidden divide-y divide-border/30">
                    {[["Built on", "Solana + Multi-chain"], ["License", "MIT"], ["Website", "neko.wallet"]].map(([k, v]) => (
                      <div key={k} className="flex justify-between px-4 py-3 text-sm">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="text-white font-medium">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </SubPageView>
            )}

          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
