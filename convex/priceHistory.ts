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
