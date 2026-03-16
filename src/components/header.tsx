"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  useWallets,
  useSignTransaction,
  useSignMessage,
} from "@privy-io/react-auth/solana";
import { Connection, PublicKey } from "@solana/web3.js";
import { useAccountInfo } from "@/hooks/use-pacifica";
import { buildDepositTransaction } from "@/lib/pacifica-deposit";
import { signMessage as buildSignedMessage, buildWithdrawRequest } from "@/lib/pacifica-sign";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { ChevronDown } from "lucide-react";

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
const WITHDRAW_URL =
  (process.env.NEXT_PUBLIC_PACIFICA_API_URL ?? "https://api.pacifica.fi/api/v1") +
  "/account/withdraw";

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatNum(value: string, decimals = 2) {
  const num = parseFloat(value);
  if (isNaN(num)) return "-";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function WalletMenu() {
  const { login, logout, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { signTransaction } = useSignTransaction();
  const { signMessage } = useSignMessage();

  const solanaWallet = user?.linkedAccounts?.find(
    (a) => a.type === "wallet" && a.chainType === "solana"
  );
  const address =
    solanaWallet && "address" in solanaWallet
      ? (solanaWallet.address as string)
      : null;

  const connectedWallet = wallets.find((w) => w.address === address);
  const { data: accountInfo } = useAccountInfo(address ?? undefined);

  const [open, setOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [loading, setLoading] = useState<"deposit" | "withdraw" | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  if (!authenticated) {
    return (
      <Button size="sm" onClick={login}>
        Connect Wallet
      </Button>
    );
  }

  async function handleDeposit() {
    if (!address || !depositAmount || !connectedWallet) return;
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount < 10) {
      setStatus("Minimum deposit is 10 USDC");
      return;
    }
    setLoading("deposit");
    setStatus(null);
    try {
      const connection = new Connection(RPC_URL);
      const depositor = new PublicKey(address);
      const tx = await buildDepositTransaction(depositor, amount, connection);
      const txBytes = tx.serialize({ requireAllSignatures: false });
      const { signedTransaction } = await signTransaction({
        transaction: txBytes,
        wallet: connectedWallet,
      });
      const sig = await connection.sendRawTransaction(signedTransaction);
      await connection.confirmTransaction(sig, "confirmed");
      setStatus(`Deposited ${amount} USDC`);
      setDepositAmount("");
    } catch (e: unknown) {
      setStatus(`Failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setLoading(null);
    }
  }

  async function handleWithdraw() {
    if (!address || !withdrawAmount || !connectedWallet) return;
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      setStatus("Enter a valid amount");
      return;
    }
    setLoading("withdraw");
    setStatus(null);
    try {
      const timestamp = Date.now();
      const expiryWindow = 30_000;
      const header = { timestamp, expiry_window: expiryWindow, type: "withdraw" };
      const payload = { amount: String(amount) };
      const signature = await buildSignedMessage(header, payload, async (msg) => {
        const { signature: sig } = await signMessage({
          message: msg,
          wallet: connectedWallet,
        });
        return sig;
      });
      const body = buildWithdrawRequest(address, signature, timestamp, expiryWindow, String(amount));
      const res = await fetch(WITHDRAW_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      setStatus(`Withdrawal of ${amount} USDC requested`);
      setWithdrawAmount("");
    } catch (e: unknown) {
      setStatus(`Failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-accent">
        {accountInfo && (
          <span className="font-mono text-xs">
            ${formatNum(accountInfo.account_equity)}
          </span>
        )}
        {address && (
          <span className="font-mono text-xs text-muted-foreground">
            {shortenAddress(address)}
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-[280px]" align="end">
        <div className="flex flex-col gap-3">
          {/* Balance info */}
          {accountInfo && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Balance</span>
                <p className="font-mono font-medium">${formatNum(accountInfo.balance)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Equity</span>
                <p className="font-mono font-medium">${formatNum(accountInfo.account_equity)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Available</span>
                <p className="font-mono font-medium">${formatNum(accountInfo.available_to_spend)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Withdrawable</span>
                <p className="font-mono font-medium">${formatNum(accountInfo.available_to_withdraw)}</p>
              </div>
            </div>
          )}

          <Separator />

          {/* Deposit */}
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="USDC amount"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="h-8 text-xs"
              min={10}
              step="any"
            />
            <Button
              size="sm"
              className="shrink-0"
              onClick={handleDeposit}
              disabled={loading !== null || !connectedWallet}
            >
              {loading === "deposit" ? "..." : "Deposit"}
            </Button>
          </div>

          {/* Withdraw */}
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="USDC amount"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="h-8 text-xs"
              min={0}
              step="any"
            />
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={handleWithdraw}
              disabled={loading !== null || !connectedWallet}
            >
              {loading === "withdraw" ? "..." : "Withdraw"}
            </Button>
          </div>

          {/* Status */}
          {status && (
            <p className={`text-xs ${status.includes("Failed") ? "text-red-500" : "text-green-500"}`}>
              {status}
            </p>
          )}

          <Separator />

          {/* Disconnect */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground"
            onClick={() => {
              logout();
              setOpen(false);
            }}
          >
            Disconnect
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function Header() {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <span className="text-lg font-semibold">Noise Control</span>
      {process.env.NEXT_PUBLIC_PRIVY_APP_ID ? (
        <WalletMenu />
      ) : (
        <span className="text-sm text-muted-foreground">
          Set PRIVY_APP_ID to enable wallet connection
        </span>
      )}
    </header>
  );
}
