"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import {
  fetchMarkets,
  fetchEventsByTagSlug,
  fetchGammaEvent,
  fetchGammaMarket,
  fetchClobPriceHistory,
  sleep,
  GammaMarket,
  GammaEvent,
} from "../lib/polymarketClient";
import { Id } from "../_generated/dataModel";

const MARKETS_PER_BATCH = 10; // Process 10 markets per action call
const API_DELAY = 100; // ms between API calls
const CLOB_DELAY = 50; // ms between CLOB calls

// Parse JSON string arrays from Polymarket API
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
function deriveResolvedOutcome(
  outcomes: string[],
  outcomePrices: string[]
): string | undefined {
  if (!outcomes.length || !outcomePrices.length) return undefined;

  for (let i = 0; i < outcomePrices.length; i++) {
    const price = parseFloat(outcomePrices[i]);
    if (price >= 0.99) {
      return outcomes[i] || `Outcome ${i}`;
    }
  }
  return undefined;
}

// Main entry point - fetches markets by date range
export const startImport = internalAction({
  args: { requestId: v.id("captureRequests") },
  handler: async (ctx, { requestId }) => {
    const request = await ctx.runQuery(internal.captureRequests.getInternal, {
      id: requestId,
    });
    if (!request || request.status !== "pending") {
      console.log(`Request ${requestId} is not pending, skipping`);
      return;
    }

    // Mark as processing
    await ctx.runMutation(internal.captureRequests.updateStatus, {
      id: requestId,
      status: "processing",
    });

    try {
      // Convert timestamps to ISO date strings for API
      const startDateMin = new Date(request.dateRangeStart).toISOString();
      const startDateMax = new Date(request.dateRangeEnd).toISOString();
      const categoryFilter = request.category;

      console.log(`Fetching closed markets with startDate between ${startDateMin} and ${startDateMax}`);
      if (categoryFilter) {
        console.log(`Filtering by category: ${categoryFilter}`);
      }

      // Discover closed markets matching criteria
      const maxMarkets = request.limit ?? 100;

      let filteredMarkets: GammaMarket[] = [];
      const eventCategoryMap = new Map<string, string>();
      const eventTagsMap = new Map<string, string[]>();
      const eventDataMap = new Map<string, GammaEvent>();

      if (categoryFilter) {
        // EVENTS-FIRST APPROACH: Fetch closed events by tag, then extract their markets
        // This is much more efficient than fetching all markets and filtering
        const tagSlug = categoryFilter.toLowerCase().trim().replace(/\s+/g, '-');

        console.log(`Fetching closed events with tag: "${tagSlug}"`);

        const batchSize = 50;
        let offset = 0;
        let totalMarketsFound = 0;

        while (filteredMarkets.length < maxMarkets) {
          const events = await fetchEventsByTagSlug({
            tagSlug,
            closed: true,
            startDateMin,
            startDateMax,
            limit: batchSize,
            offset,
          });

          if (!events || events.length === 0) {
            console.log(`No more events at offset ${offset}`);
            break;
          }

          console.log(`Fetched ${events.length} events at offset ${offset}`);

          // Extract markets from each event
          for (const event of events) {
            // Store event data
            eventDataMap.set(event.id, event);
            if (event.category) {
              eventCategoryMap.set(event.id, event.category);
            }
            const tagLabels = (event.tags || []).map(t => t.label.toLowerCase().trim());
            eventTagsMap.set(event.id, tagLabels);

            // Get markets from this event
            const eventMarkets = event.markets || [];
            console.log(`Event "${event.title}" has ${eventMarkets.length} markets`);

            // Debug: log first market's clobTokenIds
            if (eventMarkets.length > 0 && filteredMarkets.length === 0) {
              const sampleMarket = eventMarkets[0];
              console.log(`  Sample embedded market:`);
              console.log(`    question: "${sampleMarket.question}"`);
              console.log(`    clobTokenIds: ${JSON.stringify(sampleMarket.clobTokenIds)}`);
              console.log(`    outcomes: ${JSON.stringify(sampleMarket.outcomes)}`);
              console.log(`    startDate: ${sampleMarket.startDate}`);
              console.log(`    endDate: ${sampleMarket.endDate}`);
            }

            for (const market of eventMarkets) {
              // Only include closed markets
              if (!market.closed) continue;

              // Check if market falls within date range
              if (market.startDate) {
                const marketStart = new Date(market.startDate);
                if (marketStart < new Date(startDateMin) || marketStart > new Date(startDateMax)) {
                  continue;
                }
              }

              // Fetch full market details if clobTokenIds is missing
              // (embedded markets in events don't have full trading data)
              let fullMarket = market;
              const clobIds = parseJsonArray(market.clobTokenIds);
              if (clobIds.length === 0 && market.id) {
                try {
                  console.log(`  Fetching full market details for ${market.id}...`);
                  fullMarket = await fetchGammaMarket(market.id);
                  await sleep(API_DELAY);
                } catch (error) {
                  console.error(`  Failed to fetch market ${market.id}:`, error);
                }
              }

              // Add event reference to market
              const marketWithEvent: GammaMarket = {
                ...fullMarket,
                events: [{ id: event.id, slug: event.slug, title: event.title }],
              };

              filteredMarkets.push(marketWithEvent);
              totalMarketsFound++;

              if (filteredMarkets.length >= maxMarkets) break;
            }

            if (filteredMarkets.length >= maxMarkets) break;
          }

          if (filteredMarkets.length >= maxMarkets) break;

          offset += batchSize;
          await sleep(API_DELAY);
        }

        console.log(`Found ${filteredMarkets.length} markets from ${eventDataMap.size} events with tag "${tagSlug}"`);

        if (filteredMarkets.length === 0) {
          console.log(`No markets match category filter: ${categoryFilter}`);
          await ctx.runMutation(internal.captureRequests.updateStatus, {
            id: requestId,
            status: "completed",
          });
          return;
        }
      } else {
        // No category filter - just fetch markets directly
        console.log(`Max markets to import: ${maxMarkets}`);

        const allMarkets = await discoverMarkets({
          startDateMin,
          startDateMax,
          closed: true,
          maxMarkets,
        });

        console.log(`Found ${allMarkets.length} markets from API`);

        if (allMarkets.length === 0) {
          await ctx.runMutation(internal.captureRequests.updateStatus, {
            id: requestId,
            status: "completed",
          });
          return;
        }

        filteredMarkets = allMarkets;

        // Fetch events for all markets
        const uniqueEventIds = new Set<string>();
        for (const market of allMarkets) {
          const eventId = market.events?.[0]?.id;
          if (eventId) {
            uniqueEventIds.add(eventId);
          }
        }

        console.log(`Found ${uniqueEventIds.size} unique events to fetch`);

        for (const eventId of uniqueEventIds) {
          try {
            const event = await fetchGammaEvent(eventId);
            await sleep(API_DELAY);

            if (event.category) {
              eventCategoryMap.set(eventId, event.category);
            }

            const tagLabels = (event.tags || []).map(t => t.label.toLowerCase().trim());
            eventTagsMap.set(eventId, tagLabels);

            if (!event.category && tagLabels.length > 0) {
              const categoryTag = tagLabels.find(t =>
                ['politics', 'sports', 'crypto', 'science', 'business', 'entertainment'].includes(t)
              ) || tagLabels[0];
              eventCategoryMap.set(eventId, categoryTag);
            }

            eventDataMap.set(eventId, event);

            const tagsStr = tagLabels.length > 0 ? `tags: [${tagLabels.join(', ')}]` : '';
            console.log(`Fetched event: ${event.title} (category: ${event.category}, ${tagsStr})`);
          } catch (error) {
            console.error(`Failed to fetch event ${eventId}:`, error);
          }
        }
      }

      // Update total count
      await ctx.runMutation(internal.captureRequests.updateProgress, {
        id: requestId,
        totalEvents: filteredMarkets.length,
      });

      // Save filtered markets
      await ctx.runMutation(internal.markets.saveDiscoveredMarkets, {
        requestId,
        markets: filteredMarkets.map((m) => ({
          id: m.id,
          question: m.question || "",
          slug: m.slug,
          conditionId: m.conditionId,
          description: m.description,
          category: m.category,
          outcomes: parseJsonArray(m.outcomes),
          outcomePrices: parseJsonArray(m.outcomePrices),
          clobTokenIds: parseJsonArray(m.clobTokenIds),
          active: m.active ?? false,
          closed: m.closed ?? false,
          volume: m.volumeNum ?? (m.volume ? parseFloat(m.volume) : undefined),
          liquidity: m.liquidityNum ?? (m.liquidity ? parseFloat(m.liquidity) : undefined),
          createdAt: m.createdAt,
          startDate: m.startDate,
          endDate: m.endDate,
          closedTime: m.closedTime,
          lastTradePrice: m.lastTradePrice,
          bestBid: m.bestBid,
          bestAsk: m.bestAsk,
          spread: m.spread,
          umaResolutionStatus: m.umaResolutionStatus,
          resolvedBy: m.resolvedBy,
          resolvedOutcome: m.closed
            ? deriveResolvedOutcome(
                parseJsonArray(m.outcomes),
                parseJsonArray(m.outcomePrices)
              )
            : undefined,
          polymarketEventId: m.events?.[0]?.id,
          eventTitle: m.events?.[0]?.title,
          eventSlug: m.events?.[0]?.slug,
          tags: (m.tags || []).map((t) => ({
            id: t.id,
            label: t.label,
            slug: t.slug,
          })),
        })),
      });

      // Save events that have markets we're importing
      const importedEventIds = new Set<string>();
      for (const market of filteredMarkets) {
        const eventId = market.events?.[0]?.id;
        if (eventId) {
          importedEventIds.add(eventId);
        }
      }

      for (const eventId of importedEventIds) {
        const event = eventDataMap.get(eventId);
        if (!event) continue;

        try {
          await ctx.runMutation(internal.events.upsertEvent, {
            requestId,
            event: {
              id: event.id,
              slug: event.slug,
              title: event.title,
              description: event.description,
              category: event.category,
              active: event.active,
              closed: event.closed,
              createdAt: event.createdAt,
              startDate: event.startDate,
              endDate: event.endDate,
              closedTime: event.closedTime,
              tags: (event.tags || []).map((t) => ({
                id: t.id,
                label: t.label,
                slug: t.slug,
              })),
            },
          });
          console.log(`Saved event: ${event.title}`);
        } catch (error) {
          console.error(`Failed to save event ${eventId}:`, error);
        }
      }

      // Schedule batch to link markets to events and fetch price history
      await ctx.scheduler.runAfter(0, internal.actions.importMarkets.processBatch, {
        requestId,
        offset: 0,
      });
    } catch (error) {
      console.error(`Failed to start import: ${error}`);
      await ctx.runMutation(internal.captureRequests.updateStatus, {
        id: requestId,
        status: "failed",
        errorMessage: String(error),
      });
    }
  },
});

// Discover markets in date range
async function discoverMarkets(params: {
  startDateMin: string;
  startDateMax: string;
  closed?: boolean;
  maxMarkets?: number;
}): Promise<GammaMarket[]> {
  const allMarkets: GammaMarket[] = [];
  const seenIds = new Set<string>();
  const limit = 100;
  let offset = 0;
  const maxMarkets = params.maxMarkets ?? 10000;

  while (allMarkets.length < maxMarkets) {
    console.log(`Fetching markets at offset ${offset}... (have ${allMarkets.length}/${maxMarkets})`);

    const markets = await fetchMarkets({
      closed: params.closed,
      startDateMin: params.startDateMin,
      startDateMax: params.startDateMax,
      limit,
      offset,
    });

    if (!markets || !markets.length) {
      console.log(`No more markets at offset ${offset}`);
      break;
    }

    // Log first market for debugging
    if (offset === 0 && markets.length > 0) {
      const sample = markets[0];
      console.log(`Sample market: "${sample.question}"`);
      console.log(`  startDate: ${sample.startDate}`);
      console.log(`  endDate: ${sample.endDate}`);
      console.log(`  closed: ${sample.closed}`);
    }

    for (const market of markets) {
      if (!seenIds.has(market.id)) {
        seenIds.add(market.id);
        allMarkets.push(market);
        if (allMarkets.length >= maxMarkets) {
          console.log(`Reached limit of ${maxMarkets} markets`);
          break;
        }
      }
    }

    console.log(`Fetched ${markets.length} markets, total: ${allMarkets.length}`);

    if (allMarkets.length >= maxMarkets || markets.length < limit) {
      break;
    }

    offset += limit;
    await sleep(API_DELAY);
  }

  // Ensure we don't exceed the limit
  return allMarkets.slice(0, maxMarkets);
}

// Process a batch of markets - fetch price history
export const processBatch = internalAction({
  args: {
    requestId: v.id("captureRequests"),
    offset: v.number(),
  },
  handler: async (ctx, { requestId, offset }) => {
    const markets = await ctx.runQuery(internal.markets.getUnprocessedMarkets, {
      requestId,
      offset,
      limit: MARKETS_PER_BATCH,
    });

    if (markets.length === 0) {
      await finalizeRequest(ctx, requestId);
      return;
    }

    console.log(`Processing batch: markets ${offset + 1} to ${offset + markets.length}`);

    // Debug: Log first market's data
    if (offset === 0 && markets.length > 0) {
      const sample = markets[0];
      console.log(`Sample market for price history:`);
      console.log(`  Question: "${sample.question}"`);
      console.log(`  clobTokenIds: ${JSON.stringify(sample.clobTokenIds)}`);
      console.log(`  outcomes: ${JSON.stringify(sample.outcomes)}`);
      console.log(`  startDate: ${sample.startDate}`);
      console.log(`  endDate: ${sample.endDate}`);
      console.log(`  closedTime: ${sample.closedTime}`);
    }

    for (const market of markets) {
      try {
        // Link market to event if we have a polymarketEventId
        if (market.polymarketEventId && !market.eventId) {
          const event = await ctx.runQuery(internal.events.getByPolymarketId, {
            polymarketEventId: market.polymarketEventId,
          });

          if (event) {
            await ctx.runMutation(internal.markets.linkToEvent, {
              marketId: market._id,
              eventId: event._id,
              eventCategory: event.category,
            });
          }
        }

        // Fetch price history for each outcome token
        const clobTokenIds = market.clobTokenIds || [];
        const outcomes = market.outcomes || [];

        // Use startDate for range start, but prefer closedTime over endDate for range end
        // because endDate is often the "scheduled" end date which can be before startDate
        // while closedTime is when the market actually resolved
        const startTs = market.startDate
          ? Math.floor(market.startDate / 1000)
          : Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60;

        // Prefer closedTime, then endDate, then fallback to now
        let endTs: number;
        if (market.closedTime) {
          endTs = Math.floor(market.closedTime / 1000);
        } else if (market.endDate && market.endDate > market.startDate!) {
          endTs = Math.floor(market.endDate / 1000);
        } else {
          endTs = Math.floor(Date.now() / 1000);
        }

        // Ensure endTs is after startTs
        if (endTs <= startTs) {
          console.log(`  Adjusting endTs: was ${endTs}, startTs is ${startTs}`);
          endTs = Math.floor(Date.now() / 1000);
        }

        if (clobTokenIds.length === 0) {
          console.log(`  No clobTokenIds for market "${market.question?.substring(0, 50)}..."`);
        } else {
          console.log(`  Market "${market.question?.substring(0, 40)}..." - fetching ${clobTokenIds.length} tokens`);
          console.log(`    Date range: ${new Date(startTs * 1000).toISOString()} to ${new Date(endTs * 1000).toISOString()}`);
        }

        for (let i = 0; i < clobTokenIds.length; i++) {
          const tokenId = clobTokenIds[i];
          const outcomeLabel = outcomes[i] || `Outcome ${i}`;

          try {

            const priceData = await fetchClobPriceHistory({
              tokenId,
              startTs,
              endTs,
              fidelity: 60,
            });

            console.log(`  Got ${priceData.history?.length || 0} price points for ${outcomeLabel}`);

            if (priceData.history && priceData.history.length > 0) {
              await ctx.runMutation(internal.priceHistory.savePriceHistory, {
                marketId: market._id,
                captureRequestId: requestId,
                clobTokenId: tokenId,
                outcomeLabel,
                history: priceData.history,
              });
              console.log(`  Saved price history for ${outcomeLabel}`);
            } else {
              console.log(`  No price history available for ${outcomeLabel} (token: ${tokenId})`);
              console.log(`    Market: "${market.question?.substring(0, 50)}..."`);
              console.log(`    Volume: ${market.volume || 'unknown'}`);
            }

            await sleep(CLOB_DELAY);
          } catch (error) {
            console.error(`Failed to fetch price history for token ${tokenId}:`, error);
          }
        }

        await ctx.runMutation(internal.captureRequests.incrementProgress, {
          id: requestId,
          processed: 1,
          failed: 0,
        });
      } catch (error) {
        console.error(`Failed to process market ${market.polymarketMarketId}:`, error);
        await ctx.runMutation(internal.captureRequests.incrementProgress, {
          id: requestId,
          processed: 0,
          failed: 1,
        });
      }
    }

    // Schedule next batch
    await ctx.scheduler.runAfter(0, internal.actions.importMarkets.processBatch, {
      requestId,
      offset: offset + MARKETS_PER_BATCH,
    });
  },
});

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

  console.log(`Finalizing request ${requestId}: ${status} (${processedEvents} processed, ${failedEvents} failed)`);

  await ctx.runMutation(internal.captureRequests.updateStatus, {
    id: requestId,
    status,
  });
}
