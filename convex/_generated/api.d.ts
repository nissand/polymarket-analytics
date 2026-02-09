/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions_importMarkets from "../actions/importMarkets.js";
import type * as actions_processCapture from "../actions/processCapture.js";
import type * as actions_syncTags from "../actions/syncTags.js";
import type * as auth from "../auth.js";
import type * as captureRequests from "../captureRequests.js";
import type * as categories from "../categories.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as debug from "../debug.js";
import type * as events from "../events.js";
import type * as http from "../http.js";
import type * as lib_mainCategories from "../lib/mainCategories.js";
import type * as lib_polymarketClient from "../lib/polymarketClient.js";
import type * as markets from "../markets.js";
import type * as priceHistory from "../priceHistory.js";
import type * as tags from "../tags.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "actions/importMarkets": typeof actions_importMarkets;
  "actions/processCapture": typeof actions_processCapture;
  "actions/syncTags": typeof actions_syncTags;
  auth: typeof auth;
  captureRequests: typeof captureRequests;
  categories: typeof categories;
  crons: typeof crons;
  dashboard: typeof dashboard;
  debug: typeof debug;
  events: typeof events;
  http: typeof http;
  "lib/mainCategories": typeof lib_mainCategories;
  "lib/polymarketClient": typeof lib_polymarketClient;
  markets: typeof markets;
  priceHistory: typeof priceHistory;
  tags: typeof tags;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
