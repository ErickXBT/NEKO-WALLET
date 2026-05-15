import { ReactNode } from "react";
import { Navbar } from "./Navbar";

interface AppLayoutProps {
  children: ReactNode;
  showNav?: boolean;
}

export function AppLayout({ children, showNav = true }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30">
      {showNav && <Navbar />}
      <main className={`flex-1 flex flex-col ${showNav ? "pt-16 pb-20 md:pb-0" : ""}`}>
        {children}
      </main>
    </div>
  );
}
