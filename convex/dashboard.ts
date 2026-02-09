import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getStats = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        totalRequests: 0,
        totalEvents: 0,
        totalMarkets: 0,
        inProgress: 0,
      };
    }

    const requests = await ctx.db
      .query("captureRequests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const events = await ctx.db
      .query("events")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // For markets, we need to filter by userId
    const allMarkets = await ctx.db.query("markets").collect();
    const userMarkets = allMarkets.filter((m) => m.userId === userId);

    const inProgress = requests.filter((r) => r.status === "processing").length;

    return {
      totalRequests: requests.length,
      totalEvents: events.length,
      totalMarkets: userMarkets.length,
      inProgress,
    };
  },
});
