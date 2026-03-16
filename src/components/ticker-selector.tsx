"use client";

import { useState } from "react";
import { usePrices } from "@/hooks/use-pacifica";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ChevronDown } from "lucide-react";

function formatCompact(value: string) {
  const num = parseFloat(value);
  if (isNaN(num)) return "-";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(2);
}

export function TickerSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (symbol: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data: prices } = usePrices();

  const current = prices?.find((p) => p.symbol === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold hover:bg-accent transition-colors">
        {value}
        {current && (
          <span className="text-xs font-normal text-muted-foreground">
            ${formatCompact(current.mark)}
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search markets..." />
          <CommandList>
            <CommandEmpty>No markets found.</CommandEmpty>
            <CommandGroup>
              {prices?.map((p) => {
                const change =
                  parseFloat(p.yesterday_price) > 0
                    ? ((parseFloat(p.mark) - parseFloat(p.yesterday_price)) /
                        parseFloat(p.yesterday_price)) *
                      100
                    : 0;
                return (
                  <CommandItem
                    key={p.symbol}
                    value={p.symbol}
                    onSelect={() => {
                      onChange(p.symbol);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between"
                  >
                    <span className="font-medium">{p.symbol}</span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-mono">${formatCompact(p.mark)}</span>
                      <span
                        className={`font-mono ${change >= 0 ? "text-green-500" : "text-red-500"}`}
                      >
                        {change >= 0 ? "+" : ""}
                        {change.toFixed(2)}%
                      </span>
                      <span className="text-muted-foreground">
                        Vol {formatCompact(p.volume_24h)}
                      </span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
