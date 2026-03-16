"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { login, logout, authenticated, user } = usePrivy();
  const { address, isConnected } = useAccount();

  return (
    <div className="flex min-h-screen items-center justify-center">
      <main className="flex flex-col items-center gap-6">
        <h1 className="text-4xl font-bold">Noise Control</h1>

        {authenticated ? (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-muted-foreground">
              {isConnected
                ? `Connected: ${address?.slice(0, 6)}...${address?.slice(-4)}`
                : `Logged in as ${user?.email?.address ?? "user"}`}
            </p>
            <Button variant="outline" onClick={logout}>
              Disconnect
            </Button>
          </div>
        ) : (
          <Button onClick={login}>Connect Wallet</Button>
        )}
      </main>
    </div>
  );
}
