const BASE_URL = process.env.NEXT_PUBLIC_PACIFICA_API_URL ?? "https://api.pacifica.fi/api/v1";

export interface MarketInfo {
  symbol: string;
  tick_size: string;
  min_tick: string;
  max_tick: string;
  lot_size: string;
  max_leverage: number;
  isolated_only: boolean;
  min_order_size: string;
  max_order_size: string;
  funding_rate: string;
  next_funding_rate: string;
  created_at: string;
}

export interface PriceInfo {
  symbol: string;
  mark: string;
  mid: string;
  oracle: string;
  funding: string;
  next_funding: string;
  open_interest: string;
  volume_24h: string;
  yesterday_price: string;
  timestamp: number;
}

export interface OrderbookLevel {
  p: string;
  a: string;
  n: number;
}

export interface Orderbook {
  s: string;
  l: [OrderbookLevel[], OrderbookLevel[]];
  t: string;
}

export interface Position {
  symbol: string;
  side: string;
  amount: string;
  entry_price: string;
  margin: string;
  funding: string;
  isolated: boolean;
  created_at: number;
  updated_at: number;
}

export interface OpenOrder {
  order_id: number;
  client_order_id: string;
  symbol: string;
  side: string;
  price: string;
  initial_amount: string;
  filled_amount: string;
  cancelled_amount: string;
  stop_price: string | null;
  order_type: string;
  stop_parent_order_id: number | null;
  reduce_only: boolean;
  created_at: number;
  updated_at: number;
}

export interface AccountInfo {
  balance: string;
  fee_level: number;
  maker_fee: string;
  taker_fee: string;
  account_equity: string;
  available_to_spend: string;
  available_to_withdraw: string;
  pending_balance: string;
  total_margin_used: string;
  cross_mmr: string;
  positions_count: number;
  orders_count: number;
  stop_orders_count: number;
  updated_at: number;
  use_ltp_for_stop_orders: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  code: number | null;
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    const msg = json.error ?? json.message ?? JSON.stringify(json);
    throw new Error(msg);
  }
  // Some endpoints wrap data, some don't
  if (json.data !== undefined) return json.data as T;
  return json as T;
}

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString());
  const json: ApiResponse<T> = await res.json();
  if (!json.success) throw new Error(json.error ?? "API error");
  return json.data;
}

export interface MarginSetting {
  symbol: string;
  isolated: boolean;
  leverage: number;
  created_at: number;
  updated_at: number;
}

export interface AccountSettings {
  auto_lend_disabled: boolean | null;
  margin_settings: MarginSetting[];
  spot_settings: unknown[];
}

export type CandleInterval = "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "8h" | "12h" | "1d";

export interface Candle {
  t: number;
  T: number;
  s: string;
  i: string;
  o: string;
  c: string;
  h: string;
  l: string;
  v: string;
  n: number;
}

export const pacifica = {
  getMarkets: () => get<MarketInfo[]>("/info"),
  getPrices: () => get<PriceInfo[]>("/info/prices"),
  getOrderbook: (symbol: string, aggLevel?: number) =>
    get<Orderbook>("/book", {
      symbol,
      ...(aggLevel ? { agg_level: String(aggLevel) } : {}),
    }),
  getAccountInfo: (account: string) =>
    get<AccountInfo>("/account", { account }),
  getPositions: (account: string) =>
    get<Position[]>("/positions", { account }),
  getOpenOrders: (account: string) =>
    get<OpenOrder[]>("/orders", { account }),
  getCandles: (symbol: string, interval: CandleInterval, startTime: number, endTime?: number) =>
    get<Candle[]>("/kline", {
      symbol,
      interval,
      start_time: String(startTime),
      ...(endTime ? { end_time: String(endTime) } : {}),
    }),
  createMarketOrder: (body: Record<string, unknown>) =>
    post<{ order_id: number }>("/orders/create_market", body),
  createLimitOrder: (body: Record<string, unknown>) =>
    post<{ order_id: number }>("/orders/create", body),
  getAccountSettings: (account: string) =>
    get<AccountSettings>("/account/settings", { account }),
  updateLeverage: (body: Record<string, unknown>) =>
    post<{ success: boolean }>("/account/leverage", body),
  cancelOrder: (body: Record<string, unknown>) =>
    post<{ success: boolean }>("/orders/cancel", body),
  cancelAllOrders: (body: Record<string, unknown>) =>
    post<{ success: boolean }>("/orders/cancel_all", body),
};
