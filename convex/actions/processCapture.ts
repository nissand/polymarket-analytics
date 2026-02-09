"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import {
  fetchEventsBySeries,
  fetchEventsByTag,
  fetchGammaEvent,
  fetchClobPriceHistory,
  sleep,
  GammaEvent,
} from "../lib/polymarketClient";
import { Id } from "../_generated/dataModel";
import { ALL_CATEGORIES, Category } from "../categories";

const EVENTS_PER_BATCH = 5; // Process 5 events per action call to stay under timeout
const GAMMA_DELAY = 100; // ms between Gamma calls
const CLOB_DELAY = 50; // ms between CLOB calls

// Main entry point - called by cron
export const startProcessing = internalAction({
  args: { requestId: v.id("captureRequests") },
  handler: async (ctx, { requestId }) => {
    // 1. Get the request details
    const request = await ctx.runQuery(internal.captureRequests.getInternal, {
      id: requestId,
    });
    if (!request || request.status !== "pending") {
      console.log(`Request ${requestId} is not pending, skipping`);
      return;
    }

    // 2. Mark as processing
    await ctx.runMutation(internal.captureRequests.updateStatus, {
      id: requestId,
      status: "processing",
    });

    try {
      // 3. Discover all events (paginated)
      console.log(
        `Discovering events for categories: ${request.tagLabels.join(", ")}`
      );
      const allEvents = await discoverEvents({
        tagIds: request.tagIds,
        tagLabels: request.tagLabels,
        dateRangeStart: request.dateRangeStart,
        dateRangeEnd: request.dateRangeEnd,
      });
      console.log(`Found ${allEvents.length} events matching criteria`);

      if (allEvents.length === 0) {
        // No events found - mark as completed
        await ctx.runMutation(internal.captureRequests.updateStatus, {
          id: requestId,
          status: "completed",
        });
        return;
      }

      // 4. Update total count
      await ctx.runMutation(internal.captureRequests.updateProgress, {
        id: requestId,
        totalEvents: allEvents.length,
      });

      // 5. Save events (strip extra fields from tags)
      await ctx.runMutation(internal.events.saveDiscoveredEvents, {
        requestId,
        events: allEvents.map((e) => ({
          id: e.id,
          slug: e.slug,
          title: e.title,
          description: e.description,
          active: e.active,
          closed: e.closed,
          createdAt: e.createdAt,
          startDate: e.startDate,
          endDate: e.endDate,
          tags: (e.tags || []).map((t) => ({
            id: t.id,
            label: t.label,
            slug: t.slug,
          })),
          markets: e.markets,
        })),
      });

      // 6. Schedule first batch of event processing
      await ctx.scheduler.runAfter(0, internal.actions.processCapture.processEventBatch, {
        requestId,
        offset: 0,
      });
    } catch (error) {
      console.error(`Failed to start processing: ${error}`);
      await ctx.runMutation(internal.captureRequests.updateStatus, {
        id: requestId,
        status: "failed",
        errorMessage: String(error),
      });
    }
  },
});

// Look up category by ID to get its type and API parameters
function getCategoryById(categoryId: string): Category | undefined {
  return ALL_CATEGORIES.find((cat) => cat.id === categoryId);
}

// Discover all events matching the criteria
// Uses the correct API endpoint based on category type (sport vs tag)
async function discoverEvents(request: {
  tagIds: string[];
  tagLabels: string[];
  dateRangeStart: number;
  dateRangeEnd: number;
}): Promise<GammaEvent[]> {
  const allEvents: GammaEvent[] = [];
  const seenIds = new Set<string>();

  console.log(`Looking for events in categories: ${request.tagLabels.join(", ")}`);
  console.log(`Date range: ${new Date(request.dateRangeStart).toISOString()} to ${new Date(request.dateRangeEnd).toISOString()}`);

  const limit = 100;

  // Process each category separately using the correct API
  for (const categoryId of request.tagIds) {
    const category = getCategoryById(categoryId);
    if (!category) {
      console.warn(`Unknown category ID: ${categoryId}`);
      continue;
    }

    console.log(`Fetching events for ${category.label} (type: ${category.type})`);

    let offset = 0;
    const MAX_OFFSET = 5000; // Limit per category

    while (offset < MAX_OFFSET) {
      try {
        let events: GammaEvent[];

        if (category.type === "sport" && category.seriesId) {
          // Use series_id for sports
          events = await fetchEventsBySeries({
            seriesId: category.seriesId,
            closed: true,
            limit,
            offset,
          });
        } else if (category.type === "tag" && category.tagId) {
          // Use tag_id for non-sports
          events = await fetchEventsByTag({
            tagId: category.tagId,
            closed: true,
            limit,
            offset,
          });
        } else {
          console.warn(`Category ${category.id} has no seriesId or tagId`);
          break;
        }

        if (!events || !events.length) {
          console.log(`No more events for ${category.label} at offset ${offset}`);
          break;
        }

        // Debug: Log first event's dates to understand the data
        if (offset === 0 && events.length > 0) {
          const sample = events[0];
          console.log(`Sample event: "${sample.title}"`);
          console.log(`  createdAt: ${sample.createdAt}`);
          console.log(`  endDate: ${sample.endDate}`);
          console.log(`  closed: ${sample.closed}`);
        }

        let eventsInRange = 0;
        let eventsWithoutDate = 0;
        let eventsTooEarly = 0;
        let eventsTooLate = 0;

        for (const event of events) {
          if (seenIds.has(event.id)) continue;

          // Filter by createdAt date (when the market was created)
          const createdAt = event.createdAt
            ? new Date(event.createdAt).getTime()
            : null;

          // Skip events without createdAt
          if (!createdAt) {
            eventsWithoutDate++;
            continue;
          }

          // Check if event was created within our date range
          if (createdAt < request.dateRangeStart) {
            eventsTooEarly++;
          } else if (createdAt > request.dateRangeEnd) {
            eventsTooLate++;
          } else {
            seenIds.add(event.id);
            allEvents.push(event);
            eventsInRange++;
          }
        }

        console.log(`Batch at offset ${offset}: ${events.length} events, ${eventsInRange} in range, ${eventsWithoutDate} no date, ${eventsTooEarly} before range, ${eventsTooLate} after range`);

        // If we got fewer than limit, we've reached the end for this category
        if (events.length < limit) {
          console.log(`Reached end of events for ${category.label} at offset ${offset}`);
          break;
        }

        offset += limit;
        await sleep(GAMMA_DELAY);
      } catch (error) {
        console.error(`Error fetching events for ${category.label} at offset ${offset}:`, error);
        throw error;
      }
    }
  }

  console.log(`Found ${allEvents.length} total matching events across all categories`);
  return allEvents;
}

// Process a batch of events - this is the continuation point
export const processEventBatch = internalAction({
  args: {
    requestId: v.id("captureRequests"),
    offset: v.number(),
  },
  handler: async (ctx, { requestId, offset }) => {
    // Get events that need processing
    const events = await ctx.runQuery(internal.events.getUnprocessedEvents, {
      requestId,
      offset,
      limit: EVENTS_PER_BATCH,
    });

    if (events.length === 0) {
      // All done - finalize
      await finalizeRequest(ctx, requestId);
      return;
    }

    console.log(
      `Processing batch: events ${offset + 1} to ${offset + events.length}`
    );

    for (const event of events) {
      try {
        // Fetch full event details with markets
        const fullEvent = await fetchGammaEvent(event.polymarketEventId);
        await sleep(GAMMA_DELAY);

        // Process markets for this event
        await processEventMarkets(ctx, requestId, event._id, fullEvent);

        // Update progress
        await ctx.runMutation(internal.captureRequests.incrementProgress, {
          id: requestId,
          processed: 1,
          failed: 0,
        });
      } catch (error) {
        console.error(
          `Failed to process event ${event.polymarketEventId}:`,
          error
        );
        await ctx.runMutation(internal.captureRequests.incrementProgress, {
          id: requestId,
          processed: 0,
          failed: 1,
        });
      }
    }

    // Schedule next batch
    await ctx.scheduler.runAfter(0, internal.actions.processCapture.processEventBatch, {
      requestId,
      offset: offset + EVENTS_PER_BATCH,
    });
  },
});

// Parse JSON string arrays from Polymarket API
// The API returns outcomes, outcomePrices, clobTokenIds as JSON strings like "[\"Yes\", \"No\"]"
function parseJsonArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Derive resolved outcome from outcome prices
// The winning outcome has price close to 1.0 (or exactly 1)
function deriveResolvedOutcome(
  outcomes: string[],
  outcomePrices: string[]
): string | undefined {
  if (!outcomes.length || !outcomePrices.length) return undefined;

  for (let i = 0; i < outcomePrices.length; i++) {
    const price = parseFloat(outcomePrices[i]);
    // Price >= 0.99 indicates winning outcome
    if (price >= 0.99) {
      return outcomes[i] || `Outcome ${i}`;
    }
  }
  return undefined;
}

async function processEventMarkets(
  ctx: { runMutation: Function },
  requestId: Id<"captureRequests">,
  eventId: Id<"events">,
  event: GammaEvent
) {
  const markets = event.markets || [];

  for (const market of markets) {
    // Parse JSON string arrays from API
    const outcomes = parseJsonArray(market.outcomes);
    const outcomePrices = parseJsonArray(market.outcomePrices);
    const clobTokenIds = parseJsonArray(market.clobTokenIds);

    // Derive resolved outcome from prices
    const resolvedOutcome = market.closed
      ? deriveResolvedOutcome(outcomes, outcomePrices)
      : undefined;

    // Save market with all available data
    const marketId = await ctx.runMutation(internal.markets.saveMarket, {
      eventId,
      captureRequestId: requestId,
      market: {
        id: market.id,
        question: market.question,
        slug: market.slug,
        conditionId: market.conditionId,
        outcomes,
        outcomePrices,
        clobTokenIds,
        active: market.active,
        closed: market.closed,
        volume: market.volume ?? market.volumeNum,
        liquidity: market.liquidity,
        startDate: market.startDate,
        endDate: market.endDate,
        closedTime: market.closedTime,
        // Trading data
        lastTradePrice: market.lastTradePrice,
        bestBid: market.bestBid,
        bestAsk: market.bestAsk,
        spread: market.spread,
        // Resolution data
        umaResolutionStatus: market.umaResolutionStatus,
        resolutionSource: market.resolutionSource,
        resolvedOutcome,
      },
    });

    // Fetch price history for each token
    const startTs = market.startDate
      ? Math.floor(new Date(market.startDate).getTime() / 1000)
      : Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60; // Default: 1 year ago

    const endTs = market.endDate
      ? Math.floor(new Date(market.endDate).getTime() / 1000)
      : Math.floor(Date.now() / 1000);

    // Use parsed arrays for price history
    for (let i = 0; i < clobTokenIds.length; i++) {
      const tokenId = clobTokenIds[i];
      const outcomeLabel = outcomes[i] || `Outcome ${i}`;

      try {
        const priceData = await fetchClobPriceHistory({
          tokenId,
          startTs,
          endTs,
          fidelity: 60, // Hourly
        });

        // Save price history
        if (priceData.history && priceData.history.length > 0) {
          await ctx.runMutation(internal.priceHistory.savePriceHistory, {
            marketId,
            captureRequestId: requestId,
            clobTokenId: tokenId,
            outcomeLabel,
            history: priceData.history,
          });
        }

        await sleep(CLOB_DELAY);
      } catch (error) {
        console.error(
          `Failed to fetch price history for token ${tokenId}:`,
          error
        );
        // Continue with other tokens
      }
    }
  }
}

async function finalizeRequest(
  ctx: { runQuery: Function; runMutation: Function },
  requestId: Id<"captureRequests">
) {
  const request = await ctx.runQuery(internal.captureRequests.getInternal, {
    id: requestId,
  });
  if (!request) return;

  const { processedEvents, failedEvents } = request.progress;

  let status: "completed" | "partially_completed" | "failed";
  if (failedEvents === 0) {
    status = "completed";
  } else if (processedEvents > 0) {
    status = "partially_completed";
  } else {
    status = "failed";
  }

  console.log(
    `Finalizing request ${requestId}: ${status} (${processedEvents} processed, ${failedEvents} failed)`
  );

  await ctx.runMutation(internal.captureRequests.updateStatus, {
    id: requestId,
    status,
  });
}
