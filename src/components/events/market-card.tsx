"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Doc, Id } from "../../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface MarketCardProps {
  market: Doc<"markets">;
}

export function MarketCard({ market }: MarketCardProps) {
  const summaries = useQuery(api.priceHistory.getDailySummaryByMarket, {
    marketId: market._id,
  });

  // Group summaries by outcome
  const summariesByOutcome = summaries?.reduce(
    (acc, s) => {
      if (!acc[s.outcomeLabel]) acc[s.outcomeLabel] = [];
      acc[s.outcomeLabel].push(s);
      return acc;
    },
    {} as Record<string, typeof summaries>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{market.question}</CardTitle>
        <div className="flex gap-4 text-sm text-muted-foreground">
          {market.volume && (
            <span>Volume: ${market.volume.toLocaleString()}</span>
          )}
          {market.liquidity && (
            <span>Liquidity: ${market.liquidity.toLocaleString()}</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-2">Final Outcomes</p>
          <div className="flex gap-3">
            {market.outcomes.map((outcome, i) => (
              <Badge
                key={outcome}
                variant={
                  parseFloat(market.outcomePrices[i]) > 0.5
                    ? "default"
                    : "secondary"
                }
                className="text-sm"
              >
                {outcome}: {(parseFloat(market.outcomePrices[i]) * 100).toFixed(0)}%
              </Badge>
            ))}
          </div>
        </div>

        {!summaries && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {summariesByOutcome && Object.keys(summariesByOutcome).length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Daily Price Summary
            </p>
            {Object.entries(summariesByOutcome).map(([outcome, data]) => (
              <div key={outcome} className="space-y-2">
                <p className="text-sm font-medium">{outcome}</p>
                <div className="max-h-48 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Noon</TableHead>
                        <TableHead className="text-right">Open</TableHead>
                        <TableHead className="text-right">High</TableHead>
                        <TableHead className="text-right">Low</TableHead>
                        <TableHead className="text-right">Close</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data
                        ?.sort((a, b) => b.date.localeCompare(a.date))
                        .slice(0, 10)
                        .map((row) => (
                          <TableRow key={row._id}>
                            <TableCell>{row.date}</TableCell>
                            <TableCell className="text-right">
                              {(row.noonPrice * 100).toFixed(1)}%
                            </TableCell>
                            <TableCell className="text-right">
                              {(row.openPrice * 100).toFixed(1)}%
                            </TableCell>
                            <TableCell className="text-right">
                              {(row.highPrice * 100).toFixed(1)}%
                            </TableCell>
                            <TableCell className="text-right">
                              {(row.lowPrice * 100).toFixed(1)}%
                            </TableCell>
                            <TableCell className="text-right">
                              {(row.closePrice * 100).toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
                {data && data.length > 10 && (
                  <p className="text-xs text-muted-foreground">
                    Showing last 10 days of {data.length} total
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {summaries?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No price history available for this market
          </p>
        )}
      </CardContent>
    </Card>
  );
}
