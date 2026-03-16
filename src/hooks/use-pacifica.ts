"use client";

import { useQuery } from "@tanstack/react-query";
import { pacifica, type CandleInterval } from "@/lib/pacifica";

export function useMarkets() {
  return useQuery({
    queryKey: ["pacifica", "markets"],
    queryFn: () => pacifica.getMarkets(),
    staleTime: 60_000,
  });
}

export function usePrices() {
  return useQuery({
    queryKey: ["pacifica", "prices"],
    queryFn: () => pacifica.getPrices(),
    refetchInterval: 5_000,
  });
}

export function useOrderbook(symbol: string) {
  return useQuery({
    queryKey: ["pacifica", "orderbook", symbol],
    queryFn: () => pacifica.getOrderbook(symbol),
    refetchInterval: 2_000,
    enabled: !!symbol,
  });
}

export function useAccountInfo(account: string | undefined) {
  return useQuery({
    queryKey: ["pacifica", "account", account],
    queryFn: () => pacifica.getAccountInfo(account!),
    enabled: !!account,
    refetchInterval: 10_000,
  });
}

export function usePositions(account: string | undefined) {
  return useQuery({
    queryKey: ["pacifica", "positions", account],
    queryFn: () => pacifica.getPositions(account!),
    enabled: !!account,
    refetchInterval: 5_000,
  });
}

export function useOpenOrders(account: string | undefined) {
  return useQuery({
    queryKey: ["pacifica", "orders", account],
    queryFn: () => pacifica.getOpenOrders(account!),
    enabled: !!account,
    refetchInterval: 5_000,
  });
}

const INTERVAL_MS: Record<CandleInterval, number> = {
  "1m": 60_000,
  "3m": 3 * 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "30m": 30 * 60_000,
  "1h": 3_600_000,
  "2h": 2 * 3_600_000,
  "4h": 4 * 3_600_000,
  "8h": 8 * 3_600_000,
  "12h": 12 * 3_600_000,
  "1d": 86_400_000,
};

export function useCandles(symbol: string, interval: CandleInterval) {
  const candleCount = 200;
  const now = Date.now();
  const startTime = now - candleCount * INTERVAL_MS[interval];

  return useQuery({
    queryKey: ["pacifica", "candles", symbol, interval],
    queryFn: () => pacifica.getCandles(symbol, interval, startTime, now),
    enabled: !!symbol,
    refetchInterval: INTERVAL_MS[interval],
    staleTime: INTERVAL_MS[interval] / 2,
  });
}
