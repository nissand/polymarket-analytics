"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface AggregatedDataPoint {
  hoursBeforeClose: number;
  avgSkew: number;
  minSkew: number;
  maxSkew: number;
  sampleCount: number;
}

interface SkewStats {
  overallAvgSkew: number;
  skewAt24h: number | undefined;
  skewAt48h: number | undefined;
  skewAt7d: number | undefined;
  totalDataPoints: number;
}

interface SkewAnalysisChartProps {
  marketCount: number;
  dataPoints: AggregatedDataPoint[];
  stats: SkewStats | null;
}

export function SkewAnalysisChart({ marketCount, dataPoints, stats }: SkewAnalysisChartProps) {
  if (!dataPoints || dataPoints.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Skew Analysis</CardTitle>
          <CardDescription>
            Average price deviation from final outcome across all markets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            No price data available for resolved markets.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Format hours for display
  const formatHours = (hours: number) => {
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return `${days}d`;
    }
    return `${hours}h`;
  };

  // Format for chart data - reverse order so time flows left to right toward close
  const chartData = [...dataPoints].reverse();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Skew Analysis</CardTitle>
        <CardDescription>
          Average price deviation from final outcome across {marketCount} resolved markets.
          Lower skew = better market prediction.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Stats Summary */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Overall Avg Skew</p>
              <p className="text-xl font-bold">
                {(stats.overallAvgSkew * 100).toFixed(1)}%
              </p>
            </div>
            {stats.skewAt7d !== undefined && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">7 Days Before</p>
                <p className="text-xl font-bold">
                  {(stats.skewAt7d * 100).toFixed(1)}%
                </p>
              </div>
            )}
            {stats.skewAt48h !== undefined && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">48h Before</p>
                <p className="text-xl font-bold">
                  {(stats.skewAt48h * 100).toFixed(1)}%
                </p>
              </div>
            )}
            {stats.skewAt24h !== undefined && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">24h Before</p>
                <p className="text-xl font-bold">
                  {(stats.skewAt24h * 100).toFixed(1)}%
                </p>
              </div>
            )}
          </div>
        )}

        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 20, bottom: 30 }}
            >
              <defs>
                <linearGradient id="skewGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="hoursBeforeClose"
                tickFormatter={formatHours}
                reversed
                label={{
                  value: "Time Before Close →",
                  position: "insideBottom",
                  offset: -20,
                  className: "text-xs fill-muted-foreground",
                }}
                className="text-xs"
              />
              <YAxis
                domain={[0, 1]}
                tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                label={{
                  value: "Avg Skew",
                  angle: -90,
                  position: "insideLeft",
                  className: "text-xs fill-muted-foreground",
                }}
                className="text-xs"
              />
              <Tooltip
                labelFormatter={(value) => `${formatHours(value as number)} before close`}
                formatter={(value, name, props) => {
                  const numValue = typeof value === "number" ? value : 0;
                  if (name === "avgSkew") {
                    const count = props?.payload?.sampleCount;
                    return [`${(numValue * 100).toFixed(1)}% (${count} markets)`, "Avg Skew"];
                  }
                  if (name === "minSkew") {
                    return [`${(numValue * 100).toFixed(1)}%`, "Min"];
                  }
                  if (name === "maxSkew") {
                    return [`${(numValue * 100).toFixed(1)}%`, "Max"];
                  }
                  return [String(value), name];
                }}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                }}
              />
              {/* Reference lines for context */}
              <ReferenceLine
                y={0.5}
                stroke="#ef4444"
                strokeDasharray="3 3"
                label={{
                  value: "50% (random)",
                  position: "right",
                  className: "text-xs fill-muted-foreground",
                }}
              />
              <ReferenceLine
                y={0.1}
                stroke="#22c55e"
                strokeDasharray="3 3"
                label={{
                  value: "10% (well predicted)",
                  position: "right",
                  className: "text-xs fill-muted-foreground",
                }}
              />
              {/* Min-Max range as light area */}
              <Area
                type="monotone"
                dataKey="maxSkew"
                stroke="transparent"
                fill="#94a3b8"
                fillOpacity={0.2}
              />
              <Area
                type="monotone"
                dataKey="minSkew"
                stroke="transparent"
                fill="white"
                fillOpacity={1}
              />
              {/* Average skew line */}
              <Area
                type="monotone"
                dataKey="avgSkew"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#skewGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-6 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-blue-500" />
            <span className="text-muted-foreground">Average skew across all markets</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 bg-slate-400/20 border border-slate-400/30 rounded-sm" />
            <span className="text-muted-foreground">Min-max range (spread between markets)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-red-500 border-dashed" style={{ borderTopWidth: 2, borderStyle: 'dashed' }} />
            <span className="text-muted-foreground">50% = random chance</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-green-500" style={{ borderTopWidth: 2, borderStyle: 'dashed' }} />
            <span className="text-muted-foreground">10% = well predicted</span>
          </div>
        </div>

        <div className="mt-4 text-xs text-muted-foreground">
          <p>
            <strong>How to read:</strong> The chart shows how far market prices were from the
            final outcome at each point in time. A skew of 0% means perfect prediction,
            50% means random chance, and 100% means completely wrong. A narrow gray band means
            markets behave similarly; a wide band indicates high variance between markets.
          </p>
          <p className="mt-2">
            Based on {stats?.totalDataPoints || 0} price samples from {marketCount} markets.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
