import { query } from "./_generated/server";

// Category types for Polymarket API
// - Sports use series_id from /sports endpoint
// - Non-sports use tag_id from /tags endpoint

export interface Category {
  id: string;           // Our internal ID
  label: string;        // Display name
  slug: string;         // URL-friendly name
  type: "sport" | "tag"; // How to query the API
  seriesId?: string;    // For sports: series ID
  tagId?: string;       // For non-sports: tag ID
}

// Sports leagues - fetched from /sports endpoint
// series IDs map to specific leagues
const SPORTS_CATEGORIES: Category[] = [
  { id: "nfl", label: "NFL", slug: "nfl", type: "sport", seriesId: "1" },
  { id: "nba", label: "NBA", slug: "nba", type: "sport", seriesId: "2" },
  { id: "mlb", label: "MLB", slug: "mlb", type: "sport", seriesId: "10" },
  { id: "nhl", label: "NHL", slug: "nhl", type: "sport", seriesId: "10247" },
  { id: "epl", label: "Premier League", slug: "epl", type: "sport", seriesId: "10188" },
  { id: "ufc", label: "UFC", slug: "ufc", type: "sport", seriesId: "11" },
  { id: "ncaab", label: "NCAA Basketball", slug: "ncaab", type: "sport", seriesId: "39" },
  { id: "ncaaf", label: "NCAA Football", slug: "ncaaf", type: "sport", seriesId: "10324" },
];

// Non-sports categories - use tag_id
const TAG_CATEGORIES: Category[] = [
  { id: "politics", label: "Politics", slug: "politics", type: "tag", tagId: "2" },
  { id: "crypto", label: "Cryptocurrency", slug: "crypto", type: "tag", tagId: "744" },
  { id: "bitcoin", label: "Bitcoin", slug: "bitcoin", type: "tag", tagId: "102115" },
  { id: "elections", label: "Elections", slug: "elections", type: "tag", tagId: "339" },
  { id: "trump", label: "Trump", slug: "trump", type: "tag", tagId: "126" },
];

const ALL_CATEGORIES = [...SPORTS_CATEGORIES, ...TAG_CATEGORIES];

export const list = query({
  handler: async () => {
    return ALL_CATEGORIES.map((cat) => ({
      polymarketTagId: cat.id,
      label: cat.label,
      slug: cat.slug,
      type: cat.type,
      seriesId: cat.seriesId,
      tagId: cat.tagId,
    }));
  },
});

// Export for use in actions
export { ALL_CATEGORIES, SPORTS_CATEGORIES, TAG_CATEGORIES };
