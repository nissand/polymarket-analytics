"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../../../convex/_generated/api";
import { Id } from "../../../../../../../convex/_generated/dataModel";
import { format } from "date-fns";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PriceChart } from "@/components/charts/price-chart";

export default function MarketDetailPage() {
  const params = useParams();
  const captureId = params.id as string;
  const marketId = params.marketId as string;

  const market = useQuery(api.markets.getWithEvent, {
    id: marketId as Id<"markets">,
  });

  const priceData = useQuery(api.priceHistory.getDailySummaryByMarket, {
    marketId: marketId as Id<"markets">,
  });

  if (market === undefined || priceData === undefined) {
    return <LoadingSkeleton captureId={captureId} />;
  }

  if (!market) {
    return (
      <div className="container py-8">
        <p className="text-muted-foreground">Market not found.</p>
      </div>
    );
  }

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "-";
    return format(new Date(timestamp), "MMM d, yyyy 'at' h:mm a");
  };

  const formatPrice = (price: number) => {
    return `${(price * 100).toFixed(1)}%`;
  };

  return (
    <div className="container py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/capture/${captureId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{market.question}</h1>
          {market.event && (
            <p className="text-muted-foreground mt-1">
              Event: {market.event.title}
            </p>
          )}
        </div>
        <a
          href={`https://polymarket.com/event/${market.eventSlug || market.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-5 w-5" />
        </a>
      </div>

      {/* Status badges */}
      <div className="flex gap-2 flex-wrap">
        <Badge variant={market.closed ? "secondary" : "default"}>
          {market.closed ? "Closed" : "Open"}
        </Badge>
        {market.resolvedOutcome && (
          <Badge variant="default" className="bg-green-600">
            Resolved: {market.resolvedOutcome}
          </Badge>
        )}
        {market.category && (
          <Badge variant="outline">{market.category}</Badge>
        )}
        {market.event?.category && market.event.category !== market.category && (
          <Badge variant="outline">{market.event.category}</Badge>
        )}
      </div>

      {/* Price Chart */}
      <PriceChart
        data={priceData}
        outcomes={market.outcomes}
        resolvedOutcome={market.resolvedOutcome}
        closedTime={market.closedTime}
        outcomePrices={market.outcomePrices}
      />

      {/* Market Details */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Market Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DetailRow label="Market ID" value={market.polymarketMarketId} />
            <DetailRow label="Condition ID" value={market.conditionId} mono />
            <DetailRow label="Slug" value={market.slug || "-"} />
            <DetailRow
              label="Outcomes"
              value={market.outcomes.join(", ")}
            />
            <DetailRow
              label="Current Prices"
              value={market.outcomePrices.map((p: string) => formatPrice(parseFloat(p))).join(", ")}
            />
            <DetailRow
              label="CLOB Token IDs"
              value={market.clobTokenIds?.length > 0 ? market.clobTokenIds.join(", ") : "None (no price history available)"}
              mono
            />
            <DetailRow
              label="Price Data Points"
              value={priceData?.length > 0 ? `${priceData.length} records` : "No price data captured"}
            />
            <DetailRow
              label="Volume"
              value={
                market.volume
                  ? `$${market.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                  : "-"
              }
            />
            <DetailRow
              label="Liquidity"
              value={
                market.liquidity
                  ? `$${market.liquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                  : "-"
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dates & Resolution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DetailRow
              label="Created (Polymarket)"
              value={formatDate(market.polymarketCreatedAt)}
            />
            <DetailRow label="Start Date" value={formatDate(market.startDate)} />
            <DetailRow label="End Date" value={formatDate(market.endDate)} />
            <DetailRow label="Closed Time" value={formatDate(market.closedTime)} />
            <DetailRow
              label="Resolution Status"
              value={market.umaResolutionStatus || "-"}
            />
            <DetailRow label="Resolved By" value={market.resolvedBy || "-"} />
            <DetailRow
              label="Resolved Outcome"
              value={market.resolvedOutcome || "-"}
            />
          </CardContent>
        </Card>

        {market.event && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Event Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <DetailRow label="Event ID" value={market.event.polymarketEventId} />
              <DetailRow label="Title" value={market.event.title} />
              <DetailRow label="Category" value={market.event.category || "-"} />
              <DetailRow label="Slug" value={market.event.slug} />
              <DetailRow
                label="Description"
                value={market.event.description || "-"}
                multiline
              />
              <DetailRow
                label="Event Start"
                value={formatDate(market.event.startDate)}
              />
              <DetailRow
                label="Event End"
                value={formatDate(market.event.endDate)}
              />
              <DetailRow
                label="Tags"
                value={
                  market.event.tags?.length > 0
                    ? market.event.tags.map((t: { label: string }) => t.label).join(", ")
                    : "-"
                }
              />
            </CardContent>
          </Card>
        )}

        {market.description && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Market Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{market.description}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
  multiline = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className={multiline ? "" : "flex justify-between gap-4"}>
      <span className="text-muted-foreground text-sm">{label}</span>
      <span
        className={`text-sm ${mono ? "font-mono text-xs" : ""} ${
          multiline ? "block mt-1" : "text-right"
        } break-all`}
      >
        {value}
      </span>
    </div>
  );
}

function LoadingSkeleton({ captureId }: { captureId: string }) {
  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/capture/${captureId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 space-y-2">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-[400px] w-full" />
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-[300px]" />
        <Skeleton className="h-[300px]" />
      </div>
    </div>
  );
}
