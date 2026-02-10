"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { format } from "date-fns";
import Link from "next/link";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "./status-badge";
import { Eye, Trash2, Loader2 } from "lucide-react";

export function CaptureRequestList() {
  const requests = useQuery(api.captureRequests.list);
  const deleteRequest = useMutation(api.captureRequests.remove);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<Id<"captureRequests"> | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = (id: Id<"captureRequests">) => {
    setRequestToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!requestToDelete) return;

    setIsDeleting(true);
    try {
      await deleteRequest({ id: requestToDelete });
      toast.success("Capture request deleted");
      setDeleteDialogOpen(false);
      setRequestToDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  };

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
    <>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Created</TableHead>
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
              <TableCell className="font-medium">
                {request.name || "Untitled"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {format(new Date(request.createdAt), "MMM d, yyyy HH:mm")}
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
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/capture/${request._id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteClick(request._id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>

    <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Capture Request</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this capture request? This will permanently delete all associated data including events, markets, and price history. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setDeleteDialogOpen(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirmDelete}
            disabled={isDeleting}
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  );
}
