"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { TradingPanel } from "@/components/trading-panel";

export default function Home() {
  const [selectedSymbol, setSelectedSymbol] = useState("BTC");

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {/* Left side — reserved for tools */}
        <div className="w-1/2 border-r" />

        {/* Right side — trading */}
        <div className="w-1/2 overflow-hidden">
          <TradingPanel
            symbol={selectedSymbol}
            onChangeSymbol={setSelectedSymbol}
          />
        </div>
      </div>
    </div>
  );
}
