import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Target hours for sampling (4 times per day)
const SNAPSHOT_HOURS_UTC = [0, 6, 12, 18];

export const savePriceHistory = internalMutation({
  args: {
    marketId: v.id("markets"),
    captureRequestId: v.id("captureRequests"),
    clobTokenId: v.string(),
    outcomeLabel: v.string(),
    history: v.array(
      v.object({
        t: v.number(),
        p: v.number(),
      })
    ),
  },
  handler: async (
    ctx,
    { marketId, captureRequestId, clobTokenId, outcomeLabel, history }
  ) => {
    const request = await ctx.db.get(captureRequestId);
    if (!request) throw new Error("Request not found");

    const now = Date.now();

    // Group by date+hour slot and find the price closest to each target hour
    // Key format: "YYYY-MM-DD:HH" where HH is 00, 06, 12, or 18
    const snapshots = new Map<
      string,
      {
        date: string;
        hour: number;
        timestamp: number;
        price: number;
        distanceFromTarget: number;
      }
    >();

    for (const point of history) {
      const date = new Date(point.t * 1000);
      const dateKey = date.toISOString().split("T")[0]; // YYYY-MM-DD
      const pointHour = date.getUTCHours();
      const minutes = date.getUTCMinutes();
      const totalMinutes = pointHour * 60 + minutes;

      // Find which target hour this point is closest to
      for (const targetHour of SNAPSHOT_HOURS_UTC) {
        const targetMinutes = targetHour * 60;
        const distanceFromTarget = Math.abs(totalMinutes - targetMinutes);

        // Only consider points within 3 hours of target (180 minutes)
        if (distanceFromTarget > 180) continue;

        const slotKey = `${dateKey}:${targetHour.toString().padStart(2, "0")}`;
        const existing = snapshots.get(slotKey);

        // Keep the point closest to this target hour
        if (!existing || distanceFromTarget < existing.distanceFromTarget) {
          snapshots.set(slotKey, {
            date: dateKey,
            hour: targetHour,
            timestamp: point.t * 1000,
            price: point.p,
            distanceFromTarget,
          });
        }
      }
    }

    // Save snapshots (up to 4 per day)
    for (const [, snapshot] of snapshots) {
      await ctx.db.insert("dailyPriceSummary", {
        marketId,
        captureRequestId,
        userId: request.userId,
        clobTokenId,
        outcomeLabel,
        date: snapshot.date,
        hour: snapshot.hour,
        price: snapshot.price,
        // Legacy fields for backwards compatibility
        noonPrice: snapshot.price,
        openPrice: snapshot.price,
        closePrice: snapshot.price,
        highPrice: snapshot.price,
        lowPrice: snapshot.price,
        createdAt: now,
      });
    }
  },
});

export const getDailySummaryByMarket = query({
  args: { marketId: v.id("markets") },
  handler: async (ctx, { marketId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Verify market belongs to user
    const market = await ctx.db.get(marketId);
    if (!market || market.userId !== userId) {
      return [];
    }

    return await ctx.db
      .query("dailyPriceSummary")
      .withIndex("by_market", (q) => q.eq("marketId", marketId))
      .collect();
  },
});

export const getByMarket = query({
  args: { marketId: v.id("markets") },
  handler: async (ctx, { marketId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Verify market belongs to user
    const market = await ctx.db.get(marketId);
    if (!market || market.userId !== userId) {
      return [];
    }

    return await ctx.db
      .query("priceHistory")
      .withIndex("by_market", (q) => q.eq("marketId", marketId))
      .collect();
  },
});

// Get skew analysis data for all markets in a capture request
// Skew = distance from final resolved price, with time relative to close
// Returns AGGREGATED average skew across all markets at each time point
export const getSkewAnalysis = query({
  args: { captureRequestId: v.id("captureRequests") },
  handler: async (ctx, { captureRequestId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { marketCount: 0, dataPoints: [], stats: null };

    // Verify request belongs to user
    const request = await ctx.db.get(captureRequestId);
    if (!request || request.userId !== userId) {
      return { marketCount: 0, dataPoints: [], stats: null };
    }

    // Get markets for this request (limit to avoid document limits)
    const MAX_MARKETS = 200;
    const markets = await ctx.db
      .query("markets")
      .withIndex("by_captureRequest", (q) => q.eq("captureRequestId", captureRequestId))
      .take(1000); // Get up to 1000 markets

    // Filter to only closed markets with resolved outcomes
    const allResolvedMarkets = markets.filter(m => m.closed && m.closedTime && m.resolvedOutcome);

    if (allResolvedMarkets.length === 0) {
      return { marketCount: 0, dataPoints: [], stats: null };
    }

    // Limit to MAX_MARKETS to stay within document limits
    const resolvedMarkets = allResolvedMarkets.slice(0, MAX_MARKETS);
    const limitApplied = allResolvedMarkets.length > MAX_MARKETS;

    // Bucket size in hours for grouping
    const BUCKET_SIZE = 6;

    // Collect skew values by time bucket
    // Key = hours before close (bucketed), Value = array of skew values
    const skewByBucket = new Map<number, number[]>();

    for (const market of resolvedMarkets) {
      const closedTime = market.closedTime!;
      const resolvedToYes = market.resolvedOutcome === "Yes";

      // Get price data for this specific market (Yes outcome only)
      // Fetch per-market to avoid reading all price data at once
      const marketPrices = await ctx.db
        .query("dailyPriceSummary")
        .withIndex("by_market", (q) => q.eq("marketId", market._id))
        .filter((q) => q.eq(q.field("outcomeLabel"), "Yes"))
        .take(150); // Max ~30 days * 4 samples + buffer

      for (const pricePoint of marketPrices) {
        // Calculate timestamp from date and hour
        const hour = pricePoint.hour ?? 12;
        const priceTimestamp = new Date(`${pricePoint.date}T${hour.toString().padStart(2, "0")}:00:00Z`).getTime();

        // Calculate hours before close
        const hoursBeforeClose = (closedTime - priceTimestamp) / (1000 * 60 * 60);

        // Skip if price is after close or too far in the past (> 30 days)
        if (hoursBeforeClose < 0 || hoursBeforeClose > 30 * 24) continue;

        // Bucket to nearest interval
        const bucket = Math.round(hoursBeforeClose / BUCKET_SIZE) * BUCKET_SIZE;

        const price = pricePoint.price ?? pricePoint.noonPrice;

        // Calculate skew: distance from final result
        const finalPrice = resolvedToYes ? 1.0 : 0.0;
        const skew = Math.abs(finalPrice - price);

        if (!skewByBucket.has(bucket)) {
          skewByBucket.set(bucket, []);
        }
        skewByBucket.get(bucket)!.push(skew);
      }
    }

    // Calculate average skew for each bucket
    type AggregatedDataPoint = {
      hoursBeforeClose: number;
      avgSkew: number;
      minSkew: number;
      maxSkew: number;
      sampleCount: number;
    };

    const dataPoints: AggregatedDataPoint[] = [];

    for (const [bucket, skews] of skewByBucket) {
      const avg = skews.reduce((a, b) => a + b, 0) / skews.length;
      const min = Math.min(...skews);
      const max = Math.max(...skews);

      dataPoints.push({
        hoursBeforeClose: bucket,
        avgSkew: avg,
        minSkew: min,
        maxSkew: max,
        sampleCount: skews.length,
      });
    }

    // Sort by hours before close (descending - furthest from close first)
    dataPoints.sort((a, b) => b.hoursBeforeClose - a.hoursBeforeClose);

    // Calculate overall stats
    const allSkews = Array.from(skewByBucket.values()).flat();
    const overallAvgSkew = allSkews.length > 0
      ? allSkews.reduce((a, b) => a + b, 0) / allSkews.length
      : 0;

    // Get skew at different time points
    const skewAt24h = dataPoints.find(d => d.hoursBeforeClose === 24)?.avgSkew;
    const skewAt48h = dataPoints.find(d => d.hoursBeforeClose === 48)?.avgSkew;
    const skewAt7d = dataPoints.find(d => d.hoursBeforeClose === 168)?.avgSkew; // 7 days

    return {
      marketCount: resolvedMarkets.length,
      totalResolvedMarkets: allResolvedMarkets.length,
      limitApplied,
      dataPoints,
      stats: {
        overallAvgSkew,
        skewAt24h,
        skewAt48h,
        skewAt7d,
        totalDataPoints: allSkews.length,
      },
    };
  },
});
