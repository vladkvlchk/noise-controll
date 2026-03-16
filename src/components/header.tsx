"use client";

import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function WalletButton() {
  const { login, logout, authenticated, user } = usePrivy();

  const solanaWallet = user?.linkedAccounts?.find(
    (a) => a.type === "wallet" && a.chainType === "solana"
  );
  const solanaAddress =
    solanaWallet && "address" in solanaWallet
      ? (solanaWallet.address as string)
      : null;

  if (authenticated) {
    return (
      <div className="flex items-center gap-3">
        {solanaAddress && (
          <span className="text-sm font-mono text-muted-foreground">
            {shortenAddress(solanaAddress)}
          </span>
        )}
        <Button variant="outline" size="sm" onClick={logout}>
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" onClick={login}>
      Connect Wallet
    </Button>
  );
}

export function Header() {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <span className="text-lg font-semibold">Noise Control</span>
      {process.env.NEXT_PUBLIC_PRIVY_APP_ID ? (
        <WalletButton />
      ) : (
        <span className="text-sm text-muted-foreground">
          Set PRIVY_APP_ID to enable wallet connection
        </span>
      )}
    </header>
  );
}
