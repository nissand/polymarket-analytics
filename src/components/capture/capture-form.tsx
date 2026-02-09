"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DateRangePicker } from "./date-range-picker";
import { Loader2 } from "lucide-react";

// Polymarket event tags (used to filter events by category)
// Values are tag slugs used in the API
const CATEGORIES = [
  { value: "", label: "All Categories" },
  { value: "politics", label: "Politics" },
  { value: "elections", label: "Elections" },
  { value: "trump", label: "Trump" },
  { value: "crypto", label: "Crypto" },
  { value: "sports", label: "Sports" },
  { value: "nba", label: "NBA" },
  { value: "nfl", label: "NFL" },
  { value: "soccer", label: "Soccer" },
  { value: "ai", label: "AI" },
  { value: "geopolitics", label: "Geopolitics" },
  { value: "business", label: "Business" },
  { value: "science", label: "Science" },
  { value: "entertainment", label: "Entertainment" },
  { value: "economy", label: "Economy" },
];

export function CaptureForm() {
  const router = useRouter();
  const createCapture = useMutation(api.captureRequests.create);

  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [limit, setLimit] = useState<number>(100);
  const [category, setCategory] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!dateRange?.from || !dateRange?.to) {
      toast.error("Please select a date range");
      return;
    }

    if (dateRange.from >= dateRange.to) {
      toast.error("Start date must be before end date");
      return;
    }

    if (dateRange.to > new Date()) {
      toast.error("Date range must be in the past");
      return;
    }

    if (limit < 1 || limit > 10000) {
      toast.error("Limit must be between 1 and 10000");
      return;
    }

    setIsSubmitting(true);

    try {
      await createCapture({
        dateRangeStart: dateRange.from.getTime(),
        dateRangeEnd: dateRange.to.getTime(),
        limit,
        category: category && category !== "all" ? category : undefined,
      });

      toast.success("Import started - fetching markets");
      router.push("/dashboard");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create import request"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Markets</CardTitle>
        <CardDescription>
          Select a date range to import markets from Polymarket.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="dateRange">Market Start Date Range</Label>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <p className="text-sm text-muted-foreground">
              Import markets that started within this date range
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Event Category (Optional)</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value || "all"}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Only import markets from events in this category
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="limit">Limit</Label>
            <Input
              id="limit"
              type="number"
              min={1}
              max={10000}
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value) || 100)}
              className="w-32"
            />
            <p className="text-sm text-muted-foreground">
              Maximum number of markets to import
            </p>
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Import Markets
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
