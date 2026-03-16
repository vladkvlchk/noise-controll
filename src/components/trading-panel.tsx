"use client";

import { useState } from "react";
import { useOrderbook, usePositions, useOpenOrders } from "@/hooks/use-pacifica";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { pacifica } from "@/lib/pacifica";
import { signMessage as buildSignedMessage } from "@/lib/pacifica-sign";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TickerSelector } from "@/components/ticker-selector";
import { Chart } from "@/components/chart";
import { OrderForm } from "@/components/order-form";

function formatNum(value: string, decimals = 2) {
  const num = parseFloat(value);
  if (isNaN(num)) return "-";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function OrderbookView({ symbol }: { symbol: string }) {
  const { data, isLoading } = useOrderbook(symbol);

  if (isLoading || !data) {
    return <div className="p-3 text-center text-xs text-muted-foreground">Loading orderbook...</div>;
  }

  const [bids, asks] = data.l;
  const reversedAsks = [...asks].reverse();

  return (
    <div className="text-xs font-mono">
      <div className="grid grid-cols-3 gap-1 px-3 py-1 text-muted-foreground">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Orders</span>
      </div>
      {reversedAsks.slice(0, 8).map((level, i) => (
        <div key={`ask-${i}`} className="grid grid-cols-3 gap-1 px-3 py-0.5 text-red-500">
          <span>{formatNum(level.p)}</span>
          <span className="text-right">{formatNum(level.a)}</span>
          <span className="text-right">{level.n}</span>
        </div>
      ))}
      <Separator className="my-1" />
      {bids.slice(0, 8).map((level, i) => (
        <div key={`bid-${i}`} className="grid grid-cols-3 gap-1 px-3 py-0.5 text-green-500">
          <span>{formatNum(level.p)}</span>
          <span className="text-right">{formatNum(level.a)}</span>
          <span className="text-right">{level.n}</span>
        </div>
      ))}
    </div>
  );
}

function PositionsView({ account }: { account: string }) {
  const { data: positions, isLoading } = usePositions(account);

  if (isLoading) return <div className="p-3 text-xs text-muted-foreground">Loading...</div>;
  if (!positions?.length) return <div className="p-3 text-xs text-muted-foreground">No open positions</div>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">Symbol</TableHead>
          <TableHead className="text-xs">Side</TableHead>
          <TableHead className="text-right text-xs">Size</TableHead>
          <TableHead className="text-right text-xs">Entry</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {positions.map((pos) => (
          <TableRow key={pos.symbol} className="text-xs">
            <TableCell className="font-medium">{pos.symbol}</TableCell>
            <TableCell>
              <Badge variant={pos.side === "long" ? "default" : "destructive"} className="text-[10px]">
                {pos.side.toUpperCase()}
              </Badge>
            </TableCell>
            <TableCell className="text-right font-mono">{formatNum(pos.amount)}</TableCell>
            <TableCell className="text-right font-mono">{formatNum(pos.entry_price)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function OrdersView({ account }: { account: string }) {
  const { data: orders, isLoading } = useOpenOrders(account);
  const { wallets } = useWallets();
  const connectedWallet = wallets.find((w) => w.address === account);
  const [cancelling, setCancelling] = useState<number | "all" | null>(null);

  async function handleCancel(orderId: number, symbol: string) {
    if (!connectedWallet) return;
    setCancelling(orderId);
    try {
      const timestamp = Date.now();
      const expiryWindow = 30_000;
      const payload = { symbol, order_id: orderId };
      const signature = await buildSignedMessage(
        { timestamp, expiry_window: expiryWindow, type: "cancel_order" },
        payload,
        async (msg) => {
          const result = await connectedWallet.signMessage({ message: msg });
          return result.signature;
        },
      );
      await pacifica.cancelOrder({
        account,
        signature,
        timestamp,
        expiry_window: expiryWindow,
        ...payload,
      });
    } catch (e) {
      console.error("Cancel error:", e);
    } finally {
      setCancelling(null);
    }
  }

  async function handleCancelAll() {
    if (!connectedWallet) return;
    setCancelling("all");
    try {
      const timestamp = Date.now();
      const expiryWindow = 30_000;
      const payload = {};
      const signature = await buildSignedMessage(
        { timestamp, expiry_window: expiryWindow, type: "cancel_all_orders" },
        payload,
        async (msg) => {
          const result = await connectedWallet.signMessage({ message: msg });
          return result.signature;
        },
      );
      await pacifica.cancelAllOrders({
        account,
        signature,
        timestamp,
        expiry_window: expiryWindow,
      });
    } catch (e) {
      console.error("Cancel all error:", e);
    } finally {
      setCancelling(null);
    }
  }

  if (isLoading) return <div className="p-3 text-xs text-muted-foreground">Loading...</div>;
  if (!orders?.length) return <div className="p-3 text-xs text-muted-foreground">No open orders</div>;

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Symbol</TableHead>
            <TableHead className="text-xs">Side</TableHead>
            <TableHead className="text-right text-xs">Price</TableHead>
            <TableHead className="text-right text-xs">Size</TableHead>
            <TableHead className="text-right text-xs w-8"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.order_id} className="text-xs">
              <TableCell className="font-medium">{order.symbol}</TableCell>
              <TableCell>
                <Badge variant={order.side === "bid" ? "default" : "destructive"} className="text-[10px]">
                  {order.side === "bid" ? "BUY" : "SELL"}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-mono">{formatNum(order.price)}</TableCell>
              <TableCell className="text-right font-mono">{formatNum(order.initial_amount)}</TableCell>
              <TableCell className="text-right">
                <button
                  className="text-[10px] text-muted-foreground underline underline-offset-2 hover:text-destructive transition-colors disabled:opacity-50"
                  onClick={() => handleCancel(order.order_id, order.symbol)}
                  disabled={cancelling !== null}
                >
                  {cancelling === order.order_id ? "..." : "✕"}
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {orders.length > 1 && (
        <div className="px-3 py-2">
          <button
            className="text-[10px] text-muted-foreground underline underline-offset-2 hover:text-destructive transition-colors disabled:opacity-50"
            onClick={handleCancelAll}
            disabled={cancelling !== null}
          >
            {cancelling === "all" ? "Cancelling..." : "Cancel all"}
          </button>
        </div>
      )}
    </div>
  );
}

export function TradingPanel({
  symbol,
  onChangeSymbol,
}: {
  symbol: string;
  onChangeSymbol: (symbol: string) => void;
}) {
  const { authenticated, user } = usePrivy();
  const solanaWallet = user?.linkedAccounts?.find(
    (a) => a.type === "wallet" && a.chainType === "solana"
  );
  const account = solanaWallet && "address" in solanaWallet ? (solanaWallet.address as string) : undefined;

  return (
    <div className="flex h-full flex-col">
      {/* Symbol header */}
      <div className="flex items-center justify-between border-b p-3">
        <TickerSelector value={symbol} onChange={onChangeSymbol} />
      </div>

      {/* Chart */}
      <div className="h-[400px] border-b">
        <Chart symbol={symbol} />
      </div>

      {/* Bottom section: orderbook + order form + positions */}
      <div className="flex flex-1 overflow-hidden">
        {/* Orderbook */}
        <div className="w-1/3 overflow-auto border-r">
          <div className="px-3 py-2 text-xs font-medium text-muted-foreground">Orderbook</div>
          <OrderbookView symbol={symbol} />
        </div>

        {/* Order form */}
        <div className="w-1/3 overflow-auto border-r">
          <OrderForm symbol={symbol} />
        </div>

        {/* Positions & Orders */}
        <div className="w-1/3 overflow-auto">
          {authenticated && account ? (
            <>
              <div className="border-b">
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground">Positions</div>
                <PositionsView account={account} />
              </div>
              <div>
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground">Open Orders</div>
                <OrdersView account={account} />
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Connect wallet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
