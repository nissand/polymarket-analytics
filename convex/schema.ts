import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  captureRequests: defineTable({
    userId: v.id("users"),
    name: v.optional(v.string()), // User-defined name for the capture request
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("partially_completed")
    ),
    tagIds: v.array(v.string()),
    tagLabels: v.array(v.string()),
    dateRangeStart: v.number(),
    dateRangeEnd: v.number(),
    limit: v.optional(v.number()), // Max markets to import
    category: v.optional(v.string()), // Filter by event category
    searchTerm: v.optional(v.string()), // Filter by event/market name
    progress: v.object({
      totalEvents: v.number(),
      processedEvents: v.number(),
      failedEvents: v.number(),
    }),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_user_and_status", ["userId", "status"]),

  events: defineTable({
    captureRequestId: v.id("captureRequests"),
    userId: v.id("users"),
    polymarketEventId: v.string(),
    slug: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    active: v.boolean(),
    closed: v.boolean(),
    polymarketCreatedAt: v.optional(v.number()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    closedTime: v.optional(v.number()),
    tags: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        slug: v.string(),
      })
    ),
    createdAt: v.number(),
  })
    .index("by_captureRequest", ["captureRequestId"])
    .index("by_user", ["userId"])
    .index("by_polymarketId", ["polymarketEventId"])
    .index("by_category", ["category"]),

  markets: defineTable({
    eventId: v.optional(v.id("events")), // Optional - may import markets directly
    captureRequestId: v.id("captureRequests"),
    userId: v.id("users"),
    polymarketMarketId: v.string(),
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
    polymarketCreatedAt: v.optional(v.number()), // When created on Polymarket
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    closedTime: v.optional(v.number()),
    // Trading data at capture time
    lastTradePrice: v.optional(v.number()),
    bestBid: v.optional(v.number()),
    bestAsk: v.optional(v.number()),
    spread: v.optional(v.number()),
    // Resolution data
    umaResolutionStatus: v.optional(v.string()),
    resolvedBy: v.optional(v.string()),
    resolvedOutcome: v.optional(v.string()),
    // Related event info (from /markets endpoint)
    polymarketEventId: v.optional(v.string()),
    eventTitle: v.optional(v.string()),
    eventSlug: v.optional(v.string()),
    // Tags
    tags: v.optional(v.array(v.object({
      id: v.string(),
      label: v.string(),
      slug: v.string(),
    }))),
    createdAt: v.number(), // When we captured it
  })
    .index("by_event", ["eventId"])
    .index("by_captureRequest", ["captureRequestId"]),

  priceHistory: defineTable({
    marketId: v.id("markets"),
    captureRequestId: v.id("captureRequests"),
    userId: v.id("users"),
    clobTokenId: v.string(),
    outcomeLabel: v.string(),
    timestamp: v.number(),
    price: v.number(),
    isNoonSnapshot: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_market", ["marketId"])
    .index("by_market_and_token", ["marketId", "clobTokenId"])
    .index("by_market_token_time", ["marketId", "clobTokenId", "timestamp"]),

  dailyPriceSummary: defineTable({
    marketId: v.id("markets"),
    captureRequestId: v.id("captureRequests"),
    userId: v.id("users"),
    clobTokenId: v.string(),
    outcomeLabel: v.string(),
    date: v.string(), // YYYY-MM-DD
    hour: v.optional(v.number()), // 0, 6, 12, or 18 (optional for backwards compatibility)
    price: v.optional(v.number()), // (optional for backwards compatibility)
    // Legacy fields (kept for backwards compatibility)
    noonPrice: v.number(),
    openPrice: v.number(),
    closePrice: v.number(),
    highPrice: v.number(),
    lowPrice: v.number(),
    createdAt: v.number(),
  })
    .index("by_market", ["marketId"])
    .index("by_market_and_token", ["marketId", "clobTokenId"])
    .index("by_market_token_date", ["marketId", "clobTokenId", "date"]),

  polymarketTags: defineTable({
    polymarketTagId: v.string(),
    label: v.string(),
    slug: v.string(),
    lastFetchedAt: v.number(),
  }).index("by_polymarketId", ["polymarketTagId"]),
});
