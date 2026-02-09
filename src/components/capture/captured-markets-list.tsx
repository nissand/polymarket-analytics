"use client";

import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Market {
  _id: string;
  polymarketMarketId: string;
  question: string;
  category?: string;
  outcomes: string[];
  outcomePrices: string[];
  resolvedOutcome?: string;
  closed: boolean;
  volume?: number;
  startDate?: number;
  endDate?: number;
  closedTime?: number;
  eventTitle?: string;
}

interface CapturedMarketsListProps {
  markets: Market[];
  captureRequestId: string;
}

export function CapturedMarketsList({ markets, captureRequestId }: CapturedMarketsListProps) {
  const router = useRouter();

  if (markets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Markets</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No markets imported yet.</p>
        </CardContent>
      </Card>
    );
  }

  const handleRowClick = (marketId: string) => {
    router.push(`/capture/${captureRequestId}/market/${marketId}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Markets ({markets.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Question</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Volume</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {markets.map((market) => (
              <TableRow
                key={market._id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleRowClick(market._id)}
              >
                <TableCell className="max-w-md">
                  <div>
                    <p className="font-medium truncate">{market.question}</p>
                    {market.eventTitle && (
                      <p className="text-xs text-muted-foreground truncate">
                        {market.eventTitle}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {market.resolvedOutcome ? (
                    <Badge variant="default">{market.resolvedOutcome}</Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {market.volume
                    ? `$${(market.volume / 1000).toFixed(1)}k`
                    : "-"}
                </TableCell>
                <TableCell>
                  {market.endDate
                    ? format(new Date(market.endDate), "MMM d, yyyy")
                    : "-"}
                </TableCell>
                <TableCell>
                  <Badge variant={market.closed ? "secondary" : "outline"}>
                    {market.closed ? "Closed" : "Open"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
