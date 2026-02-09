"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { fetchGammaTags, sleep } from "../lib/polymarketClient";

const BATCH_SIZE = 50; // Save 50 tags at a time to avoid limits

export const syncTags = internalAction({
  handler: async (ctx) => {
    const allTags: Array<{ id: string; label: string; slug: string }> = [];
    let offset = 0;
    const limit = 100;

    // Fetch all tags from Polymarket
    while (true) {
      const batch = await fetchGammaTags(limit, offset);

      if (!batch.length) break;

      allTags.push(
        ...batch.map((t) => ({
          id: t.id,
          label: t.label,
          slug: t.slug,
        }))
      );

      offset += limit;

      // Rate limit - 100ms between requests
      await sleep(100);
    }

    console.log(`Fetched ${allTags.length} tags from Polymarket`);

    // Save in batches to avoid Convex limits
    for (let i = 0; i < allTags.length; i += BATCH_SIZE) {
      const batch = allTags.slice(i, i + BATCH_SIZE);
      await ctx.runMutation(internal.tags.saveTags, { tags: batch });
      console.log(`Saved tags ${i + 1} to ${Math.min(i + BATCH_SIZE, allTags.length)}`);
    }

    console.log(`Synced ${allTags.length} tags`);
    return { count: allTags.length };
  },
});
