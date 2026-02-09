import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("polymarketTags").collect();
  },
});

// Save a batch of tags (called multiple times for large tag sets)
export const saveTags = internalMutation({
  args: {
    tags: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        slug: v.string(),
      })
    ),
  },
  handler: async (ctx, { tags }) => {
    const now = Date.now();

    for (const tag of tags) {
      const existing = await ctx.db
        .query("polymarketTags")
        .withIndex("by_polymarketId", (q) => q.eq("polymarketTagId", tag.id))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          label: tag.label,
          slug: tag.slug,
          lastFetchedAt: now,
        });
      } else {
        await ctx.db.insert("polymarketTags", {
          polymarketTagId: tag.id,
          label: tag.label,
          slug: tag.slug,
          lastFetchedAt: now,
        });
      }
    }
  },
});
