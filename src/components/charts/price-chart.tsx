"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PriceDataPoint {
  date: string;
  hour?: number;
  price?: number;
  noonPrice?: number; // Legacy field
  outcomeLabel: string;
}

interface PriceChartProps {
  data: PriceDataPoint[];
  outcomes: string[];
  resolvedOutcome?: string;
  closedTime?: number;
  outcomePrices?: string[];
}

// Colors for different outcomes
const OUTCOME_COLORS: Record<string, string> = {
  Yes: "#22c55e",
  No: "#ef4444",
};

const DEFAULT_COLORS = ["#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899"];

export function PriceChart({ data, outcomes, resolvedOutcome, closedTime, outcomePrices }: PriceChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Price History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No price data available.</p>
        </CardContent>
      </Card>
    );
  }

  // Transform data: group by datetime with each outcome as a separate field
  const chartDataMap = new Map<string, Record<string, number | string>>();

  for (const point of data) {
    // Create datetime key: combine date and hour for more granular data
    const hour = point.hour ?? 12; // Default to noon for legacy data
    const datetimeKey = `${point.date}T${hour.toString().padStart(2, "0")}:00:00`;

    if (!chartDataMap.has(datetimeKey)) {
      chartDataMap.set(datetimeKey, { date: datetimeKey });
    }
    const entry = chartDataMap.get(datetimeKey)!;
    // Use price field, fallback to noonPrice for legacy data
    entry[point.outcomeLabel] = point.price ?? point.noonPrice ?? 0;
  }

  // Sort by datetime and convert to array
  const chartData = Array.from(chartDataMap.values()).sort((a, b) =>
    (a.date as string).localeCompare(b.date as string)
  );

  // Add final resolution point if market is resolved
  if (closedTime && outcomePrices && outcomePrices.length > 0) {
    const closedDate = new Date(closedTime);
    // Round to nearest 6-hour slot for consistency
    const closedHour = Math.round(closedDate.getUTCHours() / 6) * 6;
    const resolutionDatetime = `${closedDate.toISOString().split("T")[0]}T${closedHour.toString().padStart(2, "0")}:00:00`;

    const resolutionEntry: Record<string, number | string> = {
      date: resolutionDatetime,
    };

    // Add final prices for each outcome
    outcomes.forEach((outcome, index) => {
      if (outcomePrices[index]) {
        resolutionEntry[outcome] = parseFloat(outcomePrices[index]);
      }
    });

    // Only add if it's after the last data point or we have no data
    const lastDataDate = chartData.length > 0 ? chartData[chartData.length - 1].date as string : "";
    if (resolutionDatetime >= lastDataDate) {
      // Check if same datetime exists
      const existingIndex = chartData.findIndex(d => d.date === resolutionDatetime);
      if (existingIndex >= 0) {
        // Merge resolution prices into existing entry
        Object.assign(chartData[existingIndex], resolutionEntry);
      } else {
        chartData.push(resolutionEntry);
      }
    }
  }

  // Get unique outcomes from the data
  const uniqueOutcomes = outcomes.length > 0 ? outcomes :
    [...new Set(data.map((d) => d.outcomeLabel))];

  const getColor = (outcome: string, index: number) => {
    return OUTCOME_COLORS[outcome] || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Price History (4x Daily UTC)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => format(new Date(value), "MMM d")}
                className="text-xs"
              />
              <YAxis
                domain={[0, 1]}
                tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                className="text-xs"
              />
              <Tooltip
                labelFormatter={(value) => format(new Date(value as string), "MMM d, yyyy 'at' HH:mm")}
                formatter={(value) => [`${(Number(value) * 100).toFixed(1)}%`]}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                }}
              />
              <Legend />
              {uniqueOutcomes.map((outcome, index) => (
                <Line
                  key={outcome}
                  type="monotone"
                  dataKey={outcome}
                  name={outcome}
                  stroke={getColor(outcome, index)}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
              {/* Add resolution dots if market is resolved */}
              {closedTime && outcomePrices && chartData.length > 0 && (
                <>
                  {uniqueOutcomes.map((outcome, index) => {
                    const lastPoint = chartData[chartData.length - 1];
                    const price = lastPoint[outcome] as number | undefined;
                    if (price !== undefined) {
                      return (
                        <ReferenceDot
                          key={`dot-${outcome}`}
                          x={lastPoint.date as string}
                          y={price}
                          r={6}
                          fill={getColor(outcome, index)}
                          stroke="white"
                          strokeWidth={2}
                        />
                      );
                    }
                    return null;
                  })}
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
