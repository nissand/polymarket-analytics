"use client";

import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Doc } from "../../../convex/_generated/dataModel";

interface CaptureProgressProps {
  request: Doc<"captureRequests">;
}

export function CaptureProgress({ request }: CaptureProgressProps) {
  const { totalEvents, processedEvents, failedEvents } = request.progress;
  const progressPercent =
    totalEvents > 0 ? Math.round((processedEvents / totalEvents) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>
              {processedEvents} of {totalEvents || "..."} events processed
            </span>
            <span>{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-3" />
        </div>

        {failedEvents > 0 && (
          <p className="text-sm text-destructive">
            {failedEvents} event{failedEvents !== 1 ? "s" : ""} failed to
            process
          </p>
        )}

        {request.errorMessage && (
          <p className="text-sm text-destructive bg-destructive/10 p-3 rounded">
            Error: {request.errorMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
