"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { pacifica } from "@/lib/pacifica";
import { useOrderbook, useAccountInfo, useAccountSettings, useMarkets } from "@/hooks/use-pacifica";
import { signMessage as buildSignedMessage } from "@/lib/pacifica-sign";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

type OrderType = "market" | "limit";
type Side = "bid" | "ask";

export function OrderForm({ symbol }: { symbol: string }) {
  const { data: orderbook } = useOrderbook(symbol);
  const { authenticated, user } = usePrivy();
  const { wallets } = useWallets();

  const solanaWallet = user?.linkedAccounts?.find(
    (a) => a.type === "wallet" && a.chainType === "solana"
  );
  const address =
    solanaWallet && "address" in solanaWallet
      ? (solanaWallet.address as string)
      : null;
  const connectedWallet = wallets.find((w) => w.address === address);

  async function walletSignMessage(msg: Uint8Array): Promise<Uint8Array> {
    if (!connectedWallet) throw new Error("No wallet connected");
    const result = await connectedWallet.signMessage({ message: msg });
    return result.signature;
  }
  const { data: accountInfo } = useAccountInfo(address ?? undefined);
  const { data: accountSettings } = useAccountSettings(address ?? undefined);
  const { data: markets } = useMarkets();

  const marketInfo = markets?.find((m) => m.symbol === symbol);
  const maxLeverage = marketInfo?.max_leverage ?? 20;
  const currentSetting = accountSettings?.margin_settings?.find((s) => s.symbol === symbol);
  const currentLeverage = currentSetting?.leverage ?? maxLeverage;

  const [orderType, setOrderType] = useState<OrderType>("market");
  const [leverage, setLeverage] = useState<number | null>(null);

  // Use server leverage if we haven't manually set one
  const effectiveLeverage = leverage ?? currentLeverage;
  const [side, setSide] = useState<Side>("bid");
  const [amount, setAmount] = useState("");
  const [amountUnit, setAmountUnit] = useState<"base" | "usd">("base");
  const [price, setPrice] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [reduceOnly, setReduceOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  function getMidPrice() {
    if (!orderbook) return null;
    const [bids, asks] = orderbook.l;
    const bestBid = bids[0]?.p;
    const bestAsk = asks[0]?.p;
    if (!bestBid || !bestAsk) return null;
    return (parseFloat(bestBid) + parseFloat(bestAsk)) / 2;
  }

  function roundToLotSize(value: number): string {
    const lotSize = marketInfo ? parseFloat(marketInfo.lot_size) : 0;
    if (!lotSize) return String(value);
    const rounded = Math.floor(value / lotSize) * lotSize;
    // Determine decimal places from lot size
    const decimals = Math.max(0, -Math.floor(Math.log10(lotSize)));
    return rounded.toFixed(decimals);
  }

  function getBaseAmount(): string {
    if (!amount) return "";
    if (amountUnit === "base") return roundToLotSize(parseFloat(amount));
    const mid = getMidPrice();
    if (!mid) return "";
    return roundToLotSize(parseFloat(amount) / mid);
  }

  if (!authenticated || !address) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Connect wallet to trade
      </div>
    );
  }

  async function handleSubmit(orderSide: Side) {
    if (!address || !connectedWallet || !amount) return;
    const baseAmount = getBaseAmount();
    if (!baseAmount) {
      setStatus("Could not calculate amount");
      return;
    }
    setLoading(true);
    setSide(orderSide);
    setStatus(null);

    try {
      const timestamp = Date.now();
      const expiryWindow = 30_000;

      if (orderType === "market") {
        const operationType = "create_market_order";
        const payload: Record<string, unknown> = {
          symbol,
          amount: baseAmount,
          side: orderSide,
          slippage_percent: slippage,
          reduce_only: reduceOnly,
        };

        const signature = await buildSignedMessage(
          { timestamp, expiry_window: expiryWindow, type: operationType },
          payload,
          async (msg) => {
            return walletSignMessage(msg);
          },
        );

        const body = {
          account: address,
          signature,
          timestamp,
          expiry_window: expiryWindow,
          ...payload,
        };

        const result = await pacifica.createMarketOrder(body);
        setStatus(`Market order placed #${result.order_id}`);
      } else {
        if (!price) {
          setStatus("Enter a price");
          setLoading(false);
          return;
        }

        const operationType = "create_order";
        const payload: Record<string, unknown> = {
          symbol,
          price,
          amount: baseAmount,
          side: orderSide,
          tif: "GTC",
          reduce_only: reduceOnly,
        };

        const signature = await buildSignedMessage(
          { timestamp, expiry_window: expiryWindow, type: operationType },
          payload,
          async (msg) => {
            return walletSignMessage(msg);
          },
        );

        const body = {
          account: address,
          signature,
          timestamp,
          expiry_window: expiryWindow,
          ...payload,
        };

        const result = await pacifica.createLimitOrder(body);
        setStatus(`Limit order placed #${result.order_id}`);
      }

      setAmount("");
      setPrice("");
    } catch (e: unknown) {
      console.error("Order error:", e);
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(`Failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2.5 p-3">
      {/* Order type toggle */}
      <div className="flex gap-1 rounded-md bg-muted p-0.5">
        <button
          className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
            orderType === "market" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
          onClick={() => setOrderType("market")}
        >
          Market
        </button>
        <button
          className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
            orderType === "limit" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
          onClick={() => setOrderType("limit")}
        >
          Limit
        </button>
      </div>

      {/* Leverage */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-muted-foreground">Leverage</label>
          <span className="text-xs font-mono font-medium">{effectiveLeverage}x</span>
        </div>
        <div className="flex gap-1">
          {[1, 2, 5, 10, 20].filter((l) => l <= maxLeverage).map((l) => (
            <button
              key={l}
              type="button"
              className={`flex-1 rounded px-1 py-0.5 text-[10px] font-medium transition-colors ${
                effectiveLeverage === l
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
              onClick={async () => {
                setLeverage(l);
                if (!address || !connectedWallet) return;
                try {
                  const timestamp = Date.now();
                  const expiryWindow = 30_000;
                  const payload = { symbol, leverage: l };
                  const signature = await buildSignedMessage(
                    { timestamp, expiry_window: expiryWindow, type: "update_leverage" },
                    payload,
                    async (msg) => {
                      return walletSignMessage(msg);
                    },
                  );
                  await pacifica.updateLeverage({
                    account: address,
                    signature,
                    timestamp,
                    expiry_window: expiryWindow,
                    ...payload,
                  });
                  setStatus(`Leverage set to ${l}x`);
                } catch (e: unknown) {
                  setLeverage(null);
                  const msg = e instanceof Error ? e.message : String(e);
                  setStatus(`Failed: ${msg}`);
                }
              }}
            >
              {l}x
            </button>
          ))}
        </div>
      </div>

      {/* Price (limit only) */}
      {orderType === "limit" && (
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Price</label>
          <div className="relative">
            <Input
              type="number"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="h-8 text-xs font-mono pr-12"
              step="any"
            />
            <button
              type="button"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              onClick={() => {
                if (!orderbook) return;
                const [bids, asks] = orderbook.l;
                const bestBid = bids[0]?.p;
                const bestAsk = asks[0]?.p;
                if (bestBid && bestAsk) {
                  const mid = (parseFloat(bestBid) + parseFloat(bestAsk)) / 2;
                  setPrice(String(mid));
                }
              }}
            >
              Mid
            </button>
          </div>
        </div>
      )}

      {/* Amount */}
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Amount</label>
        <div className="relative">
          <Input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-8 text-xs font-mono pr-12"
            step="any"
          />
          <button
            type="button"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
            onClick={() => setAmountUnit((u) => (u === "base" ? "usd" : "base"))}
          >
            {amountUnit === "base" ? symbol : "USD"}
          </button>
        </div>
        {amount && (() => {
          const mid = getMidPrice();
          if (!mid) return null;
          if (amountUnit === "base") {
            const notional = parseFloat(amount) * mid;
            return (
              <span className="mt-0.5 block text-[10px] text-muted-foreground font-mono">
                ≈ ${notional.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            );
          } else {
            const base = parseFloat(amount) / mid;
            return (
              <span className="mt-0.5 block text-[10px] text-muted-foreground font-mono">
                ≈ {base.toFixed(6)} {symbol}
              </span>
            );
          }
        })()}
        <div className="mt-1 flex gap-1">
          {[10, 25, 50, 100].map((pct) => (
            <button
              key={pct}
              type="button"
              className="flex-1 rounded bg-muted px-1 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              onClick={() => {
                const available = accountInfo?.available_to_spend;
                const mid = getMidPrice();
                if (!available || !mid) return;
                const usdAmount = (parseFloat(available) * effectiveLeverage * pct) / 100;
                if (amountUnit === "usd") {
                  setAmount(usdAmount.toFixed(2));
                } else {
                  setAmount((usdAmount / mid).toFixed(6));
                }
              }}
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {/* Slippage (market only) */}
      {orderType === "market" && (
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Slippage %</label>
          <Input
            type="number"
            value={slippage}
            onChange={(e) => setSlippage(e.target.value)}
            className="h-8 text-xs font-mono"
            step="0.1"
            min="0"
          />
        </div>
      )}

      {/* Reduce only */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="reduce-only"
          checked={reduceOnly}
          onCheckedChange={(checked) => setReduceOnly(checked === true)}
        />
        <label htmlFor="reduce-only" className="text-xs text-muted-foreground cursor-pointer">
          Reduce only
        </label>
      </div>

      {/* Buy / Sell buttons */}
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          onClick={() => handleSubmit("bid")}
          disabled={loading || !amount}
        >
          {loading && side === "bid" ? "..." : "Buy / Long"}
        </Button>
        <Button
          size="sm"
          className="flex-1 bg-red-600 hover:bg-red-700 text-white"
          onClick={() => handleSubmit("ask")}
          disabled={loading || !amount}
        >
          {loading && side === "ask" ? "..." : "Sell / Short"}
        </Button>
      </div>

      {/* Status */}
      {status && (
        <p className={`text-xs ${status.includes("Failed") ? "text-red-500" : "text-green-500"}`}>
          {status}
        </p>
      )}
    </div>
  );
}
