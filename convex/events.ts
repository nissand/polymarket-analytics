import { query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const listByRequest = query({
  args: { captureRequestId: v.id("captureRequests") },
  handler: async (ctx, { captureRequestId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Verify the request belongs to the user
    const request = await ctx.db.get(captureRequestId);
    if (!request || request.userId !== userId) {
      return [];
    }

    return await ctx.db
      .query("events")
      .withIndex("by_captureRequest", (q) =>
        q.eq("captureRequestId", captureRequestId)
      )
      .collect();
  },
});

export const get = query({
  args: { id: v.id("events") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const event = await ctx.db.get(id);
    if (!event || event.userId !== userId) {
      throw new Error("Not found");
    }

    return event;
  },
});

export const saveDiscoveredEvents = internalMutation({
  args: {
    requestId: v.id("captureRequests"),
    events: v.array(
      v.object({
        id: v.string(),
        slug: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        active: v.boolean(),
        closed: v.boolean(),
        createdAt: v.optional(v.string()), // Polymarket createdAt
        startDate: v.optional(v.string()),
        endDate: v.optional(v.string()),
        tags: v.optional(
          v.array(
            v.object({
              id: v.string(),
              label: v.string(),
              slug: v.string(),
            })
          )
        ),
        markets: v.optional(v.any()),
      })
    ),
  },
  handler: async (ctx, { requestId, events }) => {
    const request = await ctx.db.get(requestId);
    if (!request) throw new Error("Request not found");

    const now = Date.now();

    for (const event of events) {
      await ctx.db.insert("events", {
        captureRequestId: requestId,
        userId: request.userId,
        polymarketEventId: event.id,
        slug: event.slug,
        title: event.title,
        description: event.description,
        active: event.active,
        closed: event.closed,
        polymarketCreatedAt: event.createdAt
          ? new Date(event.createdAt).getTime()
          : undefined,
        startDate: event.startDate ? new Date(event.startDate).getTime() : undefined,
        endDate: event.endDate ? new Date(event.endDate).getTime() : undefined,
        tags: event.tags || [],
        createdAt: now,
      });
    }
  },
});

export const getUnprocessedEvents = internalQuery({
  args: {
    requestId: v.id("captureRequests"),
    offset: v.number(),
    limit: v.number(),
  },
  handler: async (ctx, { requestId, offset, limit }) => {
    const events = await ctx.db
      .query("events")
      .withIndex("by_captureRequest", (q) =>
        q.eq("captureRequestId", requestId)
      )
      .collect();

    return events.slice(offset, offset + limit);
  },
});

export const countByRequest = query({
  args: { captureRequestId: v.id("captureRequests") },
  handler: async (ctx, { captureRequestId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;

    const events = await ctx.db
      .query("events")
      .withIndex("by_captureRequest", (q) =>
        q.eq("captureRequestId", captureRequestId)
      )
      .collect();

    return events.length;
  },
});

// Save or update an event from the import process
export const upsertEvent = internalMutation({
  args: {
    requestId: v.id("captureRequests"),
    event: v.object({
      id: v.string(),
      slug: v.string(),
      title: v.string(),
      description: v.optional(v.string()),
      category: v.optional(v.string()),
      active: v.boolean(),
      closed: v.boolean(),
      createdAt: v.optional(v.string()),
      startDate: v.optional(v.string()),
      endDate: v.optional(v.string()),
      closedTime: v.optional(v.string()),
      tags: v.optional(
        v.array(
          v.object({
            id: v.string(),
            label: v.string(),
            slug: v.string(),
          })
        )
      ),
    }),
  },
  handler: async (ctx, { requestId, event }) => {
    const request = await ctx.db.get(requestId);
    if (!request) throw new Error("Request not found");

    // Check if event already exists
    const existing = await ctx.db
      .query("events")
      .withIndex("by_polymarketId", (q) => q.eq("polymarketEventId", event.id))
      .first();

    if (existing) {
      // Update existing event with new data
      await ctx.db.patch(existing._id, {
        category: event.category,
        closed: event.closed,
        closedTime: event.closedTime
          ? new Date(event.closedTime).getTime()
          : undefined,
      });
      return existing._id;
    }

    // Create new event
    const now = Date.now();
    return await ctx.db.insert("events", {
      captureRequestId: requestId,
      userId: request.userId,
      polymarketEventId: event.id,
      slug: event.slug,
      title: event.title,
      description: event.description,
      category: event.category,
      active: event.active,
      closed: event.closed,
      polymarketCreatedAt: event.createdAt
        ? new Date(event.createdAt).getTime()
        : undefined,
      startDate: event.startDate
        ? new Date(event.startDate).getTime()
        : undefined,
      endDate: event.endDate ? new Date(event.endDate).getTime() : undefined,
      closedTime: event.closedTime
        ? new Date(event.closedTime).getTime()
        : undefined,
      tags: event.tags || [],
      createdAt: now,
    });
  },
});

// Get event by Polymarket ID
export const getByPolymarketId = internalQuery({
  args: { polymarketEventId: v.string() },
  handler: async (ctx, { polymarketEventId }) => {
    return await ctx.db
      .query("events")
      .withIndex("by_polymarketId", (q) =>
        q.eq("polymarketEventId", polymarketEventId)
      )
      .first();
  },
});
