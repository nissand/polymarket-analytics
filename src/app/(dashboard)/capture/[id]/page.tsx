"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useParams } from "next/navigation";
import { Id } from "../../../../../convex/_generated/dataModel";
import { format } from "date-fns";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { CaptureProgress } from "@/components/capture/capture-progress";
import { CapturedMarketsList } from "@/components/capture/captured-markets-list";
import { SkewAnalysisChart } from "@/components/charts/skew-analysis-chart";

export default function CaptureDetailPage() {
  const params = useParams();
  const id = params.id as Id<"captureRequests">;

  const request = useQuery(api.captureRequests.get, { id });
  const markets = useQuery(api.markets.listByRequest, { captureRequestId: id });
  const skewAnalysis = useQuery(api.priceHistory.getSkewAnalysis, { captureRequestId: id });

  if (!request) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{request.name || "Import Request"}</h1>
        <StatusBadge status={request.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Date Range</p>
            <p className="font-medium">
              {format(new Date(request.dateRangeStart), "MMMM d, yyyy")} -{" "}
              {format(new Date(request.dateRangeEnd), "MMMM d, yyyy")}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Limit</p>
            <p className="font-medium">{request.limit ?? 100} markets</p>
          </div>

          {request.category && (
            <div>
              <p className="text-sm text-muted-foreground">Category Filter</p>
              <p className="font-medium">{request.category}</p>
            </div>
          )}

          {request.searchTerm && (
            <div>
              <p className="text-sm text-muted-foreground">Search Term</p>
              <p className="font-medium">{request.searchTerm}</p>
            </div>
          )}

          <div>
            <p className="text-sm text-muted-foreground">Created</p>
            <p className="font-medium">
              {format(new Date(request.createdAt), "MMMM d, yyyy 'at' h:mm a")}
            </p>
          </div>

          {request.completedAt && (
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="font-medium">
                {format(
                  new Date(request.completedAt),
                  "MMMM d, yyyy 'at' h:mm a"
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <CaptureProgress request={request} />

      {/* Skew Analysis Chart */}
      {skewAnalysis && skewAnalysis.marketCount > 0 && (
        <SkewAnalysisChart
          marketCount={skewAnalysis.marketCount}
          dataPoints={skewAnalysis.dataPoints}
          stats={skewAnalysis.stats}
        />
      )}

      <CapturedMarketsList markets={markets || []} captureRequestId={id} />
    </div>
  );
}
