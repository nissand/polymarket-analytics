import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Status =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "partially_completed";

const statusConfig: Record<
  Status,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "Pending", variant: "secondary" },
  processing: { label: "Processing", variant: "default" },
  completed: { label: "Completed", variant: "outline" },
  failed: { label: "Failed", variant: "destructive" },
  partially_completed: { label: "Partial", variant: "outline" },
};

export function StatusBadge({ status }: { status: Status }) {
  const config = statusConfig[status];

  return (
    <Badge
      variant={config.variant}
      className={cn(
        status === "completed" && "bg-green-100 text-green-800 hover:bg-green-100",
        status === "partially_completed" &&
          "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
      )}
    >
      {config.label}
    </Badge>
  );
}
