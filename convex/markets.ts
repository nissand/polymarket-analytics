import { query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const listByEvent = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Verify the event belongs to the user
    const event = await ctx.db.get(eventId);
    if (!event || event.userId !== userId) {
      return [];
    }

    return await ctx.db
      .query("markets")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("markets") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const market = await ctx.db.get(id);
    if (!market || market.userId !== userId) {
      throw new Error("Not found");
    }

    return market;
  },
});

export const saveMarket = internalMutation({
  args: {
    eventId: v.id("events"),
    captureRequestId: v.id("captureRequests"),
    market: v.object({
      id: v.string(),
      question: v.string(),
      slug: v.optional(v.string()),
      conditionId: v.string(),
      outcomes: v.array(v.string()),
      outcomePrices: v.array(v.string()),
      clobTokenIds: v.array(v.string()),
      active: v.boolean(),
      closed: v.boolean(),
      volume: v.optional(v.number()),
      liquidity: v.optional(v.number()),
      startDate: v.optional(v.string()),
      endDate: v.optional(v.string()),
      closedTime: v.optional(v.string()),
      // Trading data
      lastTradePrice: v.optional(v.number()),
      bestBid: v.optional(v.number()),
      bestAsk: v.optional(v.number()),
      spread: v.optional(v.number()),
      // Resolution data
      umaResolutionStatus: v.optional(v.string()),
      resolutionSource: v.optional(v.string()),
      resolvedOutcome: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { eventId, captureRequestId, market }) => {
    const event = await ctx.db.get(eventId);
    if (!event) throw new Error("Event not found");

    const now = Date.now();

    return await ctx.db.insert("markets", {
      eventId,
      captureRequestId,
      userId: event.userId,
      polymarketMarketId: market.id,
      question: market.question,
      slug: market.slug,
      conditionId: market.conditionId,
      outcomes: market.outcomes,
      outcomePrices: market.outcomePrices,
      clobTokenIds: market.clobTokenIds,
      active: market.active,
      closed: market.closed,
      volume: market.volume,
      liquidity: market.liquidity,
      startDate: market.startDate
        ? new Date(market.startDate).getTime()
        : undefined,
      endDate: market.endDate ? new Date(market.endDate).getTime() : undefined,
      closedTime: market.closedTime
        ? new Date(market.closedTime).getTime()
        : undefined,
      lastTradePrice: market.lastTradePrice,
      bestBid: market.bestBid,
      bestAsk: market.bestAsk,
      spread: market.spread,
      umaResolutionStatus: market.umaResolutionStatus,
      resolvedOutcome: market.resolvedOutcome,
      createdAt: now,
    });
  },
});

export const countByRequest = query({
  args: { captureRequestId: v.id("captureRequests") },
  handler: async (ctx, { captureRequestId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;

    const markets = await ctx.db
      .query("markets")
      .withIndex("by_captureRequest", (q) =>
        q.eq("captureRequestId", captureRequestId)
      )
      .collect();

    return markets.length;
  },
});

// Save markets directly (without events) from /markets endpoint
export const saveDiscoveredMarkets = internalMutation({
  args: {
    requestId: v.id("captureRequests"),
    markets: v.array(
      v.object({
        id: v.string(),
        question: v.string(),
        description: v.optional(v.string()),
        slug: v.optional(v.string()),
        conditionId: v.string(),
        category: v.optional(v.string()),
        outcomes: v.array(v.string()),
        outcomePrices: v.array(v.string()),
        clobTokenIds: v.array(v.string()),
        active: v.boolean(),
        closed: v.boolean(),
        volume: v.optional(v.number()),
        liquidity: v.optional(v.number()),
        createdAt: v.optional(v.string()),
        startDate: v.optional(v.string()),
        endDate: v.optional(v.string()),
        closedTime: v.optional(v.string()),
        lastTradePrice: v.optional(v.number()),
        bestBid: v.optional(v.number()),
        bestAsk: v.optional(v.number()),
        spread: v.optional(v.number()),
        umaResolutionStatus: v.optional(v.string()),
        resolvedBy: v.optional(v.string()),
        resolvedOutcome: v.optional(v.string()),
        polymarketEventId: v.optional(v.string()),
        eventTitle: v.optional(v.string()),
        eventSlug: v.optional(v.string()),
        tags: v.optional(
          v.array(
            v.object({
              id: v.string(),
              label: v.string(),
              slug: v.string(),
            })
          )
        ),
      })
    ),
  },
  handler: async (ctx, { requestId, markets }) => {
    const request = await ctx.db.get(requestId);
    if (!request) throw new Error("Request not found");

    const now = Date.now();

    for (const market of markets) {
      await ctx.db.insert("markets", {
        captureRequestId: requestId,
        userId: request.userId,
        polymarketMarketId: market.id,
        question: market.question,
        description: market.description,
        slug: market.slug,
        conditionId: market.conditionId,
        category: market.category,
        outcomes: market.outcomes,
        outcomePrices: market.outcomePrices,
        clobTokenIds: market.clobTokenIds,
        active: market.active,
        closed: market.closed,
        volume: market.volume,
        liquidity: market.liquidity,
        polymarketCreatedAt: market.createdAt
          ? new Date(market.createdAt).getTime()
          : undefined,
        startDate: market.startDate
          ? new Date(market.startDate).getTime()
          : undefined,
        endDate: market.endDate
          ? new Date(market.endDate).getTime()
          : undefined,
        closedTime: market.closedTime
          ? new Date(market.closedTime).getTime()
          : undefined,
        lastTradePrice: market.lastTradePrice,
        bestBid: market.bestBid,
        bestAsk: market.bestAsk,
        spread: market.spread,
        umaResolutionStatus: market.umaResolutionStatus,
        resolvedBy: market.resolvedBy,
        resolvedOutcome: market.resolvedOutcome,
        polymarketEventId: market.polymarketEventId,
        eventTitle: market.eventTitle,
        eventSlug: market.eventSlug,
        tags: market.tags,
        createdAt: now,
      });
    }
  },
});

// Get markets that need price history fetching
export const getUnprocessedMarkets = internalQuery({
  args: {
    requestId: v.id("captureRequests"),
    offset: v.number(),
    limit: v.number(),
  },
  handler: async (ctx, { requestId, offset, limit }) => {
    const markets = await ctx.db
      .query("markets")
      .withIndex("by_captureRequest", (q) =>
        q.eq("captureRequestId", requestId)
      )
      .collect();

    return markets.slice(offset, offset + limit);
  },
});

// List markets by capture request (for viewing)
export const listByRequest = query({
  args: { captureRequestId: v.id("captureRequests") },
  handler: async (ctx, { captureRequestId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const request = await ctx.db.get(captureRequestId);
    if (!request || request.userId !== userId) {
      return [];
    }

    return await ctx.db
      .query("markets")
      .withIndex("by_captureRequest", (q) =>
        q.eq("captureRequestId", captureRequestId)
      )
      .collect();
  },
});

// Get full market details with event data
export const getWithEvent = query({
  args: { id: v.id("markets") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const market = await ctx.db.get(id);
    if (!market || market.userId !== userId) {
      throw new Error("Not found");
    }

    // Get associated event if exists
    let event = null;
    if (market.eventId) {
      event = await ctx.db.get(market.eventId);
    }

    return {
      ...market,
      event,
    };
  },
});

// Link market to event and update category
export const linkToEvent = internalMutation({
  args: {
    marketId: v.id("markets"),
    eventId: v.id("events"),
    eventCategory: v.optional(v.string()),
  },
  handler: async (ctx, { marketId, eventId, eventCategory }) => {
    await ctx.db.patch(marketId, {
      eventId,
      category: eventCategory,
    });
  },
});
