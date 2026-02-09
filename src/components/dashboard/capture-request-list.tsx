"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { format } from "date-fns";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "./status-badge";
import { Eye } from "lucide-react";

export function CaptureRequestList() {
  const requests = useQuery(api.captureRequests.list);

  if (!requests) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No capture requests yet.</p>
        <p className="text-sm mt-1">
          <Link href="/capture/new" className="text-primary hover:underline">
            Create your first capture request
          </Link>
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Created</TableHead>
          <TableHead>Categories</TableHead>
          <TableHead>Date Range</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Progress</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {requests.map((request) => {
          const progressPercent =
            request.progress.totalEvents > 0
              ? Math.round(
                  (request.progress.processedEvents /
                    request.progress.totalEvents) *
                    100
                )
              : 0;

          return (
            <TableRow key={request._id}>
              <TableCell>
                {format(new Date(request.createdAt), "MMM d, yyyy HH:mm")}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {request.tagLabels.slice(0, 3).map((label) => (
                    <Badge key={label} variant="secondary" className="text-xs">
                      {label}
                    </Badge>
                  ))}
                  {request.tagLabels.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{request.tagLabels.length - 3}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm">
                {format(new Date(request.dateRangeStart), "MMM d, yyyy")} -{" "}
                {format(new Date(request.dateRangeEnd), "MMM d, yyyy")}
              </TableCell>
              <TableCell>
                <StatusBadge status={request.status} />
              </TableCell>
              <TableCell>
                <div className="w-32 space-y-1">
                  <Progress value={progressPercent} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {request.progress.processedEvents} /{" "}
                    {request.progress.totalEvents || "..."}
                  </p>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/capture/${request._id}`}>
                    <Eye className="h-4 w-4" />
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
