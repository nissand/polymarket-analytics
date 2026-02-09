"use client";

import { Doc } from "../../../convex/_generated/dataModel";
import { MarketCard } from "./market-card";

interface MarketsListProps {
  markets: Doc<"markets">[];
}

export function MarketsList({ markets }: MarketsListProps) {
  if (markets.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No markets found for this event
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">
        Markets ({markets.length})
      </h2>
      <div className="space-y-4">
        {markets.map((market) => (
          <MarketCard key={market._id} market={market} />
        ))}
      </div>
    </div>
  );
}
