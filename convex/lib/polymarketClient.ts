const GAMMA_API_BASE = "https://gamma-api.polymarket.com";
const CLOB_API_BASE = "https://clob.polymarket.com";

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  options: RetryOptions = {}
): Promise<Response> {
  const { maxRetries = 5, initialDelay = 1000, maxDelay = 30000 } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url);

      if (response.status === 429) {
        const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
        console.log(`Rate limited, waiting ${delay}ms before retry...`);
        await sleep(delay);
        continue;
      }

      if (response.status >= 500) {
        console.log(`Server error ${response.status}, retrying...`);
        await sleep(2000);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error as Error;
      console.log(`Network error, retrying in ${initialDelay * Math.pow(2, attempt)}ms...`);
      await sleep(initialDelay * Math.pow(2, attempt));
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

export interface GammaEvent {
  id: string;
  slug: string;
  title: string;
  description?: string;
  category?: string;
  active: boolean;
  closed: boolean;
  createdAt?: string;
  startDate?: string;
  endDate?: string;
  closedTime?: string;
  tags?: Array<{ id: string; label: string; slug: string }>;
  markets?: GammaMarket[];
}

export interface GammaMarket {
  id: string;
  question?: string;
  slug?: string;
  conditionId: string;
  description?: string;
  category?: string;
  // These come as JSON strings from API: "[\"Yes\", \"No\"]"
  outcomes?: string | string[];
  outcomePrices?: string | string[];
  clobTokenIds?: string | string[];
  active?: boolean;
  closed?: boolean;
  volume?: string;
  volumeNum?: number;
  liquidity?: string;
  liquidityNum?: number;
  liquidityAmm?: number;
  createdAt?: string;
  startDate?: string;
  endDate?: string;
  closedTime?: string;
  // Trading data
  lastTradePrice?: number;
  bestBid?: number;
  bestAsk?: number;
  spread?: number;
  // Resolution data
  umaResolutionStatus?: string;
  resolutionSource?: string;
  resolvedBy?: string;
  // Related data from /markets endpoint
  events?: Array<{ id: string; slug: string; title: string }>;
  tags?: Array<{ id: string; label: string; slug: string }>;
  // Image
  image?: string;
  icon?: string;
}

export interface GammaTag {
  id: string;
  label: string;
  slug: string;
}

export interface PricePoint {
  t: number; // Unix timestamp
  p: number; // Price (0-1)
}

export interface PriceHistoryResponse {
  history: PricePoint[];
}

// Fetch markets directly from /markets endpoint
export interface FetchMarketsParams {
  closed?: boolean;
  startDateMin?: string;  // ISO date string
  startDateMax?: string;  // ISO date string
  limit: number;
  offset: number;
}

export async function fetchMarkets(params: FetchMarketsParams): Promise<GammaMarket[]> {
  const url = new URL(`${GAMMA_API_BASE}/markets`);

  url.searchParams.set("limit", String(params.limit));
  url.searchParams.set("offset", String(params.offset));
  url.searchParams.set("order", "startDate");
  url.searchParams.set("ascending", "true");

  if (params.closed !== undefined) {
    url.searchParams.set("closed", String(params.closed));
  }
  if (params.startDateMin) {
    url.searchParams.set("start_date_min", params.startDateMin);
  }
  if (params.startDateMax) {
    url.searchParams.set("start_date_max", params.startDateMax);
  }

  console.log(`Fetching: ${url.toString()}`);
  const response = await fetchWithRetry(url.toString());

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Polymarket API error: ${response.status} - ${text}`);
  }

  return response.json();
}

// Legacy: Fetch events by series_id (for sports)
export async function fetchEventsBySeries(params: {
  seriesId: string;
  closed: boolean;
  limit: number;
  offset: number;
}): Promise<GammaEvent[]> {
  const url = new URL(`${GAMMA_API_BASE}/events`);
  url.searchParams.set("series_id", params.seriesId);
  url.searchParams.set("closed", String(params.closed));
  url.searchParams.set("limit", String(params.limit));
  url.searchParams.set("offset", String(params.offset));
  url.searchParams.set("order", "endDate");
  url.searchParams.set("ascending", "false");

  const response = await fetchWithRetry(url.toString());

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gamma API error: ${response.status} - ${text}`);
  }

  return response.json();
}

// Fetch events by tag slug (e.g., "politics", "crypto", "sports")
export async function fetchEventsByTagSlug(params: {
  tagSlug: string;
  closed: boolean;
  startDateMin?: string;
  startDateMax?: string;
  limit: number;
  offset: number;
}): Promise<GammaEvent[]> {
  const url = new URL(`${GAMMA_API_BASE}/events`);
  url.searchParams.set("tag_slug", params.tagSlug);
  url.searchParams.set("closed", String(params.closed));
  url.searchParams.set("limit", String(params.limit));
  url.searchParams.set("offset", String(params.offset));
  url.searchParams.set("order", "startDate");
  url.searchParams.set("ascending", "true");

  if (params.startDateMin) {
    url.searchParams.set("start_date_min", params.startDateMin);
  }
  if (params.startDateMax) {
    url.searchParams.set("start_date_max", params.startDateMax);
  }

  console.log(`Fetching events: ${url.toString()}`);
  const response = await fetchWithRetry(url.toString());

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gamma API error: ${response.status} - ${text}`);
  }

  return response.json();
}

// Legacy: Fetch events by tag_id (for non-sports categories)
export async function fetchEventsByTag(params: {
  tagId: string;
  closed: boolean;
  limit: number;
  offset: number;
}): Promise<GammaEvent[]> {
  const url = new URL(`${GAMMA_API_BASE}/events`);
  url.searchParams.set("tag_id", params.tagId);
  url.searchParams.set("closed", String(params.closed));
  url.searchParams.set("limit", String(params.limit));
  url.searchParams.set("offset", String(params.offset));
  url.searchParams.set("order", "endDate");
  url.searchParams.set("ascending", "false");

  const response = await fetchWithRetry(url.toString());

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gamma API error: ${response.status} - ${text}`);
  }

  return response.json();
}

// Legacy function for backward compatibility
export async function fetchGammaEvents(params: {
  tagId?: string;
  seriesId?: string;
  closed: boolean;
  limit: number;
  offset: number;
}): Promise<GammaEvent[]> {
  if (params.seriesId) {
    return fetchEventsBySeries({
      seriesId: params.seriesId,
      closed: params.closed,
      limit: params.limit,
      offset: params.offset,
    });
  } else if (params.tagId) {
    return fetchEventsByTag({
      tagId: params.tagId,
      closed: params.closed,
      limit: params.limit,
      offset: params.offset,
    });
  } else {
    // Fallback: fetch all closed events
    const url = new URL(`${GAMMA_API_BASE}/events`);
    url.searchParams.set("closed", String(params.closed));
    url.searchParams.set("limit", String(params.limit));
    url.searchParams.set("offset", String(params.offset));

    const response = await fetchWithRetry(url.toString());
    if (!response.ok) {
      throw new Error(`Gamma API error: ${response.status}`);
    }
    return response.json();
  }
}

export async function fetchGammaEvent(eventId: string): Promise<GammaEvent> {
  const url = `${GAMMA_API_BASE}/events/${eventId}`;
  const response = await fetchWithRetry(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch event ${eventId}: ${response.status}`);
  }

  return response.json();
}

// Fetch a single market with full details
export async function fetchGammaMarket(marketId: string): Promise<GammaMarket> {
  const url = `${GAMMA_API_BASE}/markets/${marketId}`;
  console.log(`Fetching market: ${url}`);
  const response = await fetchWithRetry(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch market ${marketId}: ${response.status}`);
  }

  return response.json();
}

// Maximum interval the CLOB API accepts (14 days in seconds)
const MAX_CLOB_INTERVAL = 14 * 24 * 60 * 60;

export async function fetchClobPriceHistory(params: {
  tokenId: string;
  startTs: number;
  endTs: number;
  fidelity: number;
}): Promise<PriceHistoryResponse> {
  const { tokenId, startTs, endTs, fidelity } = params;
  const interval = endTs - startTs;

  // If interval exceeds max, fetch in chunks
  if (interval > MAX_CLOB_INTERVAL) {
    console.log(`CLOB: Interval ${Math.round(interval / 86400)} days exceeds max, fetching in chunks...`);
    const allHistory: PricePoint[] = [];
    let currentStart = startTs;

    while (currentStart < endTs) {
      const currentEnd = Math.min(currentStart + MAX_CLOB_INTERVAL, endTs);

      try {
        const chunkData = await fetchClobPriceHistoryChunk({
          tokenId,
          startTs: currentStart,
          endTs: currentEnd,
          fidelity,
        });

        if (chunkData.history && chunkData.history.length > 0) {
          allHistory.push(...chunkData.history);
        }
      } catch (error) {
        console.error(`CLOB chunk error for ${currentStart}-${currentEnd}:`, error);
      }

      currentStart = currentEnd;
      await sleep(50); // Small delay between chunks
    }

    console.log(`CLOB: Fetched ${allHistory.length} total points across chunks`);
    return { history: allHistory };
  }

  return fetchClobPriceHistoryChunk(params);
}

async function fetchClobPriceHistoryChunk(params: {
  tokenId: string;
  startTs: number;
  endTs: number;
  fidelity: number;
}): Promise<PriceHistoryResponse> {
  const url = new URL(`${CLOB_API_BASE}/prices-history`);
  url.searchParams.set("market", params.tokenId);
  url.searchParams.set("startTs", String(params.startTs));
  url.searchParams.set("endTs", String(params.endTs));
  url.searchParams.set("fidelity", String(params.fidelity));

  const response = await fetchWithRetry(url.toString());

  if (!response.ok) {
    const text = await response.text();
    console.error(`CLOB API error for token ${params.tokenId}: ${response.status} - ${text}`);
    throw new Error(`CLOB API error: ${response.status}`);
  }

  const data = await response.json();

  // Handle "interval too long" error in response body
  if (data.error) {
    console.error(`CLOB API error response: ${data.error}`);
    return { history: [] };
  }

  // Handle different response formats
  if (!data.history) {
    console.log(`CLOB API returned no history field for token ${params.tokenId}:`, JSON.stringify(data).substring(0, 500));
    return { history: [] };
  }

  return data;
}

// Fetch tags from Polymarket
export async function fetchGammaTags(
  limit: number,
  offset: number
): Promise<GammaTag[]> {
  const url = new URL(`${GAMMA_API_BASE}/tags`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));

  const response = await fetchWithRetry(url.toString());

  if (!response.ok) {
    throw new Error(`Gamma API error fetching tags: ${response.status}`);
  }

  return response.json();
}
