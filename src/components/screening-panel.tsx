"use client";

import { useState, useMemo } from "react";
import { usePrices } from "@/hooks/use-pacifica";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatNumber(value: string, decimals = 2) {
  const num = parseFloat(value);
  if (isNaN(num)) return "-";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatCompact(value: string) {
  const num = parseFloat(value);
  if (isNaN(num)) return "-";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(2);
}

function priceChange(mark: string, yesterday: string) {
  const m = parseFloat(mark);
  const y = parseFloat(yesterday);
  if (!y) return { pct: 0, formatted: "-" };
  const pct = ((m - y) / y) * 100;
  return { pct, formatted: `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%` };
}

export function ScreeningPanel({
  selectedSymbol,
  onSelectSymbol,
}: {
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
}) {
  const { data: prices, isLoading } = usePrices();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!prices) return [];
    const q = search.toUpperCase();
    return prices.filter((p) => p.symbol.toUpperCase().includes(q));
  }, [prices, search]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-3">
        <Input
          placeholder="Search markets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm"
        />
      </div>
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky top-0 bg-background text-xs">Symbol</TableHead>
              <TableHead className="sticky top-0 bg-background text-right text-xs">Price</TableHead>
              <TableHead className="sticky top-0 bg-background text-right text-xs">24h</TableHead>
              <TableHead className="sticky top-0 bg-background text-right text-xs">Volume</TableHead>
              <TableHead className="sticky top-0 bg-background text-right text-xs">OI</TableHead>
              <TableHead className="sticky top-0 bg-background text-right text-xs">Funding</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => {
                const change = priceChange(p.mark, p.yesterday_price);
                const isSelected = p.symbol === selectedSymbol;
                return (
                  <TableRow
                    key={p.symbol}
                    className={`cursor-pointer text-xs ${isSelected ? "bg-accent" : ""}`}
                    onClick={() => onSelectSymbol(p.symbol)}
                  >
                    <TableCell className="font-medium">{p.symbol}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(p.mark)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono ${
                        change.pct >= 0 ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {change.formatted}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCompact(p.volume_24h)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCompact(p.open_interest)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono ${
                        parseFloat(p.funding) >= 0 ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {(parseFloat(p.funding) * 100).toFixed(4)}%
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
