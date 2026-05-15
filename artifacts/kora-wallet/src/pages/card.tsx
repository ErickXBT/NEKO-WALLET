import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/hooks/use-wallet";
import { useToast } from "@/hooks/use-toast";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { Globe, Zap, ShieldCheck, Smartphone } from "lucide-react";
import logo from "@/assets/neko-logo.png";

function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function generateCardNumber(seed: string): string {
  if (!seed) return "4242 2625 •••• ••••";
  const h1 = hashStr(seed).toString().padStart(8, "0").slice(-4);
  const h2 = hashStr(seed + "neko").toString().padStart(8, "0").slice(-4);
  return `4242 2625 ${h1} ${h2}`;
}

const COUNTRIES = [
  "United States", "Indonesia", "Singapore", "Japan", "United Kingdom",
  "Germany", "France", "Spain", "Italy", "Canada", "Brazil", "Mexico",
  "Australia", "India", "South Korea", "Thailand", "Vietnam", "Philippines",
  "Malaysia", "United Arab Emirates", "Saudi Arabia", "Turkey", "Netherlands",
  "Switzerland", "Sweden", "Norway", "Denmark", "Poland", "Argentina", "Chile"
];

const FEATURES = [
  { icon: Globe, title: "Global Acceptance", desc: "Use anywhere Mastercard is accepted — 200+ countries, 150M+ merchants." },
  { icon: Zap, title: "Instant Fiat → Crypto", desc: "Top-up with fiat and convert to your favorite crypto in seconds." },
  { icon: ShieldCheck, title: "Zero FX Fees", desc: "Spend in any currency without hidden conversion charges." },
  { icon: Smartphone, title: "Apple & Google Pay", desc: "Tokenize once, tap anywhere. Native mobile wallet support." },
];

const FEES = [
  ["ATM Withdrawal", "Free up to $200/mo, 2% after"],
  ["Foreign Exchange", "0%"],
  ["Monthly Fee", "$0"],
  ["Daily Spend Limit", "$10,000"],
  ["Crypto Conversion", "0.5% per swap"],
];

export default function Card() {
  const [, setLocation] = useLocation();
  const { walletId, cardOrder, orderCard } = useWallet();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!walletId) setLocation("/");
  }, [walletId, setLocation]);

  if (!walletId) return null;

  const handleSubmit = () => {
    if (!name || !country || !email) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }
    orderCard({ name, country, email, orderedAt: Date.now() });
    toast({ title: "Card order placed!", description: "We'll ship to your address shortly." });
    setName(""); setCountry(""); setEmail("");
  };

  const cardRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-100, 100], [15, -15]);
  const rotateY = useTransform(x, [-100, 100], [-15, 15]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    x.set(e.clientX - rect.left - rect.width / 2);
    y.set(e.clientY - rect.top - rect.height / 2);
  };
  const handleMouseLeave = () => { x.set(0); y.set(0); };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto w-full px-4 md:px-6 py-8 md:py-12">
        <div className="text-center mb-10">
          <div className="inline-block px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-[10px] font-bold tracking-widest mb-3">
            INTRODUCING NEKO CARD
          </div>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white">
            Spend Crypto. <span className="bg-gradient-to-r from-primary to-[#8a9500] bg-clip-text text-transparent">Anywhere.</span>
          </h1>
          <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
            The NEKO Mastercard converts fiat to crypto instantly. Accepted in 200+ countries. Zero FX fees. Tap to pay everywhere.
          </p>
        </div>

        {/* 3D Card */}
        <div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="flex justify-center mb-12 px-4"
          style={{ perspective: 1000 }}
        >
          <motion.div
            style={{ rotateX, rotateY, transformStyle: "preserve-3d", aspectRatio: "1.586 / 1" }}
            className="relative w-full max-w-[460px] rounded-[28px] p-5 sm:p-7 text-white overflow-hidden shadow-[0_30px_60px_-15px_rgba(225,243,17,0.4)]"
          >
            {/* card base with new brand color */}
            <div className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-[#E1F311] via-[#c8d900] to-[#8a9500]" />

            {/* huge faded logo watermark in center */}
            <img
              src={logo}
              alt=""
              aria-hidden
              className="absolute -left-16 top-1/2 -translate-y-1/2 w-[420px] h-[420px] object-contain opacity-20 mix-blend-overlay pointer-events-none select-none"
            />

            {/* subtle highlight */}
            <div className="absolute inset-0 bg-gradient-to-tr from-black/20 via-transparent to-white/10 rounded-[28px]" />
            <div className="absolute -top-32 -right-32 w-64 h-64 bg-white/15 rounded-full blur-3xl" />

            <div className="relative h-full flex flex-col justify-between">
              {/* Top row */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-2xl font-black tracking-wide leading-none text-black">NEKO</div>
                  <div className="text-[10px] tracking-[0.2em] opacity-70 mt-1.5 font-semibold text-black">CRYPTO MASTERCARD</div>
                  {/* Chip */}
                  <div className="mt-3 w-12 h-9 rounded-md bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 shadow-inner ring-1 ring-amber-700/40 relative overflow-hidden">
                    <div className="absolute inset-1 grid grid-cols-2 grid-rows-3 gap-px opacity-40">
                      {Array.from({ length: 6 }).map((_, i) => <div key={i} className="bg-amber-800/40 rounded-[1px]" />)}
                    </div>
                  </div>
                </div>
                <img
                  src={logo}
                  alt="NEKO"
                  className="w-14 h-14 object-contain"
                />
              </div>

              {/* Card number */}
              <div className="font-mono text-[20px] tracking-[0.18em] text-black [text-shadow:0_1px_2px_rgba(255,255,255,0.3)]">
                {generateCardNumber(cardOrder?.name || name || walletId || "")}
              </div>

              {/* Bottom row */}
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[10px] opacity-60 tracking-[0.2em] font-bold text-black">CARD HOLDER</div>
                  <div className="text-sm font-bold tracking-wider mt-1 text-black">
                    {(cardOrder?.name || name).toUpperCase() || "YOUR NAME"}
                  </div>
                </div>
                {/* Mastercard mark */}
                <div className="relative w-14 h-9">
                  <div className="absolute left-0 top-0 w-9 h-9 rounded-full bg-[#EB001B]" />
                  <div className="absolute right-0 top-0 w-9 h-9 rounded-full bg-[#F79E1B] opacity-90" />
                  <div className="absolute left-2.5 top-0 w-4 h-9 bg-[#FF5F00] mix-blend-multiply" style={{ borderRadius: "100%" }} />
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                whileHover={{ y: -4 }}
                className="p-5 rounded-2xl bg-card border border-border/40 hover:border-primary/30 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30 flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="text-sm font-bold text-white">{f.title}</div>
                <div className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{f.desc}</div>
              </motion.div>
            );
          })}
        </div>

        {/* Order form + fees */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-card border border-primary/20">
            <h3 className="text-lg font-black tracking-wider text-white">ORDER YOUR NEKO CARD</h3>
            <p className="text-xs text-muted-foreground mt-1">Free shipping. Activated in minutes.</p>

            {cardOrder ? (
              <div className="mt-6 p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
                <div className="font-bold">Order confirmed</div>
                <div className="text-xs mt-1 text-green-300/80">
                  {cardOrder.name} — {cardOrder.country} — {cardOrder.email}
                </div>
              </div>
            ) : (
              <div className="space-y-4 mt-5">
                <div>
                  <label className="text-[10px] text-muted-foreground tracking-widest font-bold">FULL NAME</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" className="mt-1 bg-secondary/40 border-border/40 text-white" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground tracking-widest font-bold">COUNTRY</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="mt-1 w-full bg-secondary/40 border border-border/40 text-white rounded-md h-9 px-3 text-sm"
                  >
                    <option value="">Select your country</option>
                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground tracking-widest font-bold">EMAIL</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="mt-1 bg-secondary/40 border-border/40 text-white" />
                </div>
                <Button onClick={handleSubmit} className="w-full rounded-full font-bold tracking-wider bg-gradient-to-r from-primary to-[#8a9500] text-primary-foreground">
                  ORDER MY CARD
                </Button>
              </div>
            )}
          </div>

          <div className="p-6 rounded-2xl bg-card border border-border/40">
            <h3 className="text-lg font-black tracking-wider text-white">FEES & LIMITS</h3>
            <p className="text-xs text-muted-foreground mt-1">No hidden fees. Ever.</p>
            <div className="mt-5 divide-y divide-border/40">
              {FEES.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-3">
                  <span className="text-sm text-muted-foreground">{k}</span>
                  <span className="text-sm text-white font-medium">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
