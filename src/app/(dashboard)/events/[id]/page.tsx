"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useParams } from "next/navigation";
import { Id } from "../../../../../convex/_generated/dataModel";
import { format } from "date-fns";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MarketsList } from "@/components/events/markets-list";

export default function EventDetailPage() {
  const params = useParams();
  const id = params.id as Id<"events">;

  const event = useQuery(api.events.get, { id });
  const markets = useQuery(api.markets.listByEvent, { eventId: id });

  if (!event) {
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
          href={`/capture/${event.captureRequestId}`}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Capture Request
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">{event.title}</h1>
        {event.description && (
          <p className="text-muted-foreground mt-2">{event.description}</p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Event Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Tags</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {event.tags.map((tag) => (
                <Badge key={tag.id} variant="secondary">
                  {tag.label}
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {event.startDate && (
              <div>
                <p className="text-sm text-muted-foreground">Start Date</p>
                <p className="font-medium">
                  {format(new Date(event.startDate), "MMMM d, yyyy")}
                </p>
              </div>
            )}
            {event.endDate && (
              <div>
                <p className="text-sm text-muted-foreground">Close Date</p>
                <p className="font-medium">
                  {format(new Date(event.endDate), "MMMM d, yyyy")}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <Badge variant={event.closed ? "secondary" : "default"}>
              {event.closed ? "Closed" : "Active"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <MarketsList markets={markets || []} />
    </div>
  );
}
