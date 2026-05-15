import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Wallet,
  TrendingUp,
  CreditCard,
  Newspaper,
  BarChart3,
  ClockArrowUp,
  LogOut,
  Settings,
  Menu,
  X
} from "lucide-react";
import { useWallet } from "@/hooks/use-wallet";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { useState } from "react";

const navItems = [
  { href: "/wallet", label: "WALLET", icon: Wallet },
  { href: "/trade", label: "TRADE", icon: TrendingUp },
  { href: "/card", label: "CARD", icon: CreditCard },
  { href: "/news", label: "NEWS", icon: Newspaper },
  { href: "/markets", label: "MARKETS", icon: BarChart3 },
  { href: "/activity", label: "ACTIVITY", icon: ClockArrowUp },
];

const bottomNavItems = [
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/trade", label: "Trade", icon: TrendingUp },
  { href: "/markets", label: "Markets", icon: BarChart3 },
  { href: "/activity", label: "Activity", icon: ClockArrowUp },
];

export function Navbar() {
  const [location, setLocation] = useLocation();
  const { walletId, solBalance, disconnect } = useWallet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!walletId) return null;

  return (
    <>
      {/* Top navbar */}
      <nav className="fixed top-0 left-0 right-0 h-16 bg-background border-b border-border/40 z-50 flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-6">
          <Link href="/wallet" className="flex items-center gap-2 cursor-pointer group">
            <Logo size={32} glow />
            <span className="text-lg font-bold tracking-widest uppercase text-white">NEKO</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-full text-xs font-bold tracking-wider transition-all",
                    isActive
                      ? "bg-gradient-to-r from-primary to-[#8a9500] text-primary-foreground shadow-[0_0_10px_rgba(225,243,17,0.3)]"
                      : "text-muted-foreground hover:text-white hover:bg-white/5"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="hidden sm:flex items-center gap-3 px-4 py-1.5 rounded-full bg-secondary/50 border border-border">
            <span className="text-sm font-medium text-white">{solBalance.toFixed(4)} SOL</span>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-white">
              <Settings className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-muted-foreground hover:text-primary"
              onClick={() => {
                disconnect();
                setLocation("/");
              }}
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>

          {/* Mobile menu toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden rounded-full text-muted-foreground hover:text-white"
            onClick={() => setMobileMenuOpen((o) => !o)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </nav>

      {/* Mobile slide-down menu */}
      {mobileMenuOpen && (
        <div className="fixed top-16 left-0 right-0 z-40 bg-background border-b border-border/40 md:hidden">
          <div className="px-4 py-3 grid grid-cols-2 gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold tracking-wider transition-all",
                    isActive
                      ? "bg-gradient-to-r from-primary to-[#8a9500] text-primary-foreground"
                      : "text-muted-foreground hover:text-white bg-secondary/40"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={() => { disconnect(); setLocation("/"); setMobileMenuOpen(false); }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold tracking-wider text-muted-foreground hover:text-primary bg-secondary/40 col-span-2"
            >
              <LogOut className="w-4 h-4" />
              DISCONNECT
            </button>
          </div>
        </div>
      )}

      {/* Mobile bottom navigation bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background border-t border-border/40">
        <div className="flex items-center justify-around px-2 py-2">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all min-w-0",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive && "drop-shadow-[0_0_6px_rgba(225,243,17,0.8)]")} />
                <span className="text-[10px] font-bold tracking-wider">{item.label.toUpperCase()}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
