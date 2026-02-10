import {
  mutation,
  query,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// Debug query to check auth status
export const checkAuthStatus = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    console.log("checkAuthStatus - userId:", userId);

    // Also list all users and sessions for debugging
    const users = await ctx.db.query("users").collect();
    const authSessions = await ctx.db.query("authSessions").collect();
    console.log("Total users:", users.length);
    console.log("Total sessions:", authSessions.length);

    return {
      isAuthenticated: !!userId,
      userId: userId ? String(userId) : null,
      totalUsers: users.length,
      totalSessions: authSessions.length,
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    dateRangeStart: v.number(),
    dateRangeEnd: v.number(),
    limit: v.optional(v.number()),
    category: v.optional(v.string()),
    searchTerm: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    console.log("captureRequests.create called");
    let userId = await getAuthUserId(ctx);

    // TEMPORARY: If no auth, use the first user (for development only)
    if (!userId) {
      const firstUser = await ctx.db.query("users").first();
      if (firstUser) {
        userId = firstUser._id;
        console.log("Using first user as fallback:", userId);
      } else {
        throw new Error("Unauthorized - no users in database");
      }
    }

    // Validation
    if (args.dateRangeStart >= args.dateRangeEnd) {
      throw new Error("Start date must be before end date");
    }
    if (args.dateRangeEnd > Date.now()) {
      throw new Error("Date range must be in the past");
    }

    const now = Date.now();

    return await ctx.db.insert("captureRequests", {
      userId,
      name: args.name.trim(),
      status: "pending",
      tagIds: [],
      tagLabels: [],
      dateRangeStart: args.dateRangeStart,
      dateRangeEnd: args.dateRangeEnd,
      limit: args.limit ?? 100,
      category: args.category,
      searchTerm: args.searchTerm,
      progress: {
        totalEvents: 0,
        processedEvents: 0,
        failedEvents: 0,
      },
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const list = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("captureRequests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("captureRequests") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const request = await ctx.db.get(id);
    if (!request || request.userId !== userId) {
      throw new Error("Not found");
    }

    return request;
  },
});

// Internal queries and mutations for the processing pipeline

export const getInternal = internalQuery({
  args: { id: v.id("captureRequests") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const updateStatus = internalMutation({
  args: {
    id: v.id("captureRequests"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("partially_completed")
    ),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, { id, status, errorMessage }) => {
    const updates: Record<string, unknown> = {
      status,
      updatedAt: Date.now(),
    };

    if (
      status === "completed" ||
      status === "failed" ||
      status === "partially_completed"
    ) {
      updates.completedAt = Date.now();
    }

    if (errorMessage !== undefined) {
      updates.errorMessage = errorMessage;
    }

    await ctx.db.patch(id, updates);
  },
});

export const updateProgress = internalMutation({
  args: {
    id: v.id("captureRequests"),
    totalEvents: v.optional(v.number()),
    processedEvents: v.optional(v.number()),
    failedEvents: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const request = await ctx.db.get(id);
    if (!request) return;

    const newProgress = { ...request.progress };
    if (updates.totalEvents !== undefined)
      newProgress.totalEvents = updates.totalEvents;
    if (updates.processedEvents !== undefined)
      newProgress.processedEvents = updates.processedEvents;
    if (updates.failedEvents !== undefined)
      newProgress.failedEvents = updates.failedEvents;

    await ctx.db.patch(id, {
      progress: newProgress,
      updatedAt: Date.now(),
    });
  },
});

export const incrementProgress = internalMutation({
  args: {
    id: v.id("captureRequests"),
    processed: v.number(),
    failed: v.number(),
  },
  handler: async (ctx, { id, processed, failed }) => {
    const request = await ctx.db.get(id);
    if (!request) return;

    await ctx.db.patch(id, {
      progress: {
        ...request.progress,
        processedEvents: request.progress.processedEvents + processed,
        failedEvents: request.progress.failedEvents + failed,
      },
      updatedAt: Date.now(),
    });
  },
});

// Reset any stuck processing requests to failed
export const resetProcessing = internalMutation({
  handler: async (ctx) => {
    const processing = await ctx.db
      .query("captureRequests")
      .withIndex("by_status", (q) => q.eq("status", "processing"))
      .collect();

    for (const request of processing) {
      await ctx.db.patch(request._id, {
        status: "failed",
        errorMessage: "Manually stopped",
        updatedAt: Date.now(),
        completedAt: Date.now(),
      });
    }

    return { stopped: processing.length };
  },
});

// Delete a capture request and all related data (batched to avoid limits)
export const remove = mutation({
  args: { id: v.id("captureRequests") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const request = await ctx.db.get(id);
    if (!request || request.userId !== userId) {
      throw new Error("Not found");
    }

    // Mark as deleting (use failed status to prevent processing)
    await ctx.db.patch(id, {
      status: "failed",
      errorMessage: "Deleting...",
      updatedAt: Date.now(),
    });

    // Schedule the batched delete process
    await ctx.scheduler.runAfter(0, internal.captureRequests.deleteRelatedData, {
      captureRequestId: id,
      step: "markets",
    });

    return { deleting: true };
  },
});

// Internal mutation to delete related data in batches
export const deleteRelatedData = internalMutation({
  args: {
    captureRequestId: v.id("captureRequests"),
    step: v.union(
      v.literal("markets"),
      v.literal("events"),
      v.literal("finish")
    ),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, { captureRequestId, step, cursor }) => {
    const BATCH_SIZE = 100;

    if (step === "markets") {
      // Get a batch of markets
      let query = ctx.db
        .query("markets")
        .withIndex("by_captureRequest", (q) => q.eq("captureRequestId", captureRequestId));

      const markets = await query.take(BATCH_SIZE);

      if (markets.length === 0) {
        // No more markets, move to events
        await ctx.scheduler.runAfter(0, internal.captureRequests.deleteRelatedData, {
          captureRequestId,
          step: "events",
        });
        return;
      }

      // Delete price data for these markets
      for (const market of markets) {
        // Delete dailyPriceSummary for this market
        const summaries = await ctx.db
          .query("dailyPriceSummary")
          .withIndex("by_market", (q) => q.eq("marketId", market._id))
          .take(500);

        for (const summary of summaries) {
          await ctx.db.delete(summary._id);
        }

        // Delete priceHistory for this market
        const history = await ctx.db
          .query("priceHistory")
          .withIndex("by_market", (q) => q.eq("marketId", market._id))
          .take(500);

        for (const h of history) {
          await ctx.db.delete(h._id);
        }

        // Delete the market
        await ctx.db.delete(market._id);
      }

      // Schedule next batch
      await ctx.scheduler.runAfter(0, internal.captureRequests.deleteRelatedData, {
        captureRequestId,
        step: "markets",
      });

    } else if (step === "events") {
      // Get a batch of events
      const events = await ctx.db
        .query("events")
        .withIndex("by_captureRequest", (q) => q.eq("captureRequestId", captureRequestId))
        .take(BATCH_SIZE);

      if (events.length === 0) {
        // No more events, finish up
        await ctx.scheduler.runAfter(0, internal.captureRequests.deleteRelatedData, {
          captureRequestId,
          step: "finish",
        });
        return;
      }

      // Delete events
      for (const event of events) {
        await ctx.db.delete(event._id);
      }

      // Schedule next batch
      await ctx.scheduler.runAfter(0, internal.captureRequests.deleteRelatedData, {
        captureRequestId,
        step: "events",
      });

    } else if (step === "finish") {
      // Delete the capture request itself
      const request = await ctx.db.get(captureRequestId);
      if (request) {
        await ctx.db.delete(captureRequestId);
      }
    }
  },
});

export const processPending = internalMutation({
  handler: async (ctx) => {
    // Check if any request is currently processing
    const processing = await ctx.db
      .query("captureRequests")
      .withIndex("by_status", (q) => q.eq("status", "processing"))
      .first();

    if (processing) {
      // Check if it's been stuck for more than 5 minutes
      const stuckThreshold = 5 * 60 * 1000; // 5 minutes
      const timeSinceUpdate = Date.now() - processing.updatedAt;

      if (timeSinceUpdate > stuckThreshold) {
        // Reset stuck request to failed
        console.log(`Resetting stuck request ${processing._id} (stuck for ${Math.round(timeSinceUpdate / 1000)}s)`);
        await ctx.db.patch(processing._id, {
          status: "failed",
          errorMessage: "Processing timed out - request was stuck",
          updatedAt: Date.now(),
          completedAt: Date.now(),
        });
      } else {
        // Still processing - skip
        return null;
      }
    }

    // Get oldest pending request
    const pending = await ctx.db
      .query("captureRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .first();

    if (pending) {
      // Schedule the import action (markets-first approach)
      await ctx.scheduler.runAfter(
        0,
        internal.actions.importMarkets.startImport,
        {
          requestId: pending._id,
        }
      );
      return pending._id;
    }

    return null;
  },
});
