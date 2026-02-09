import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Check for pending capture requests every 30 seconds
crons.interval(
  "process-pending-captures",
  { seconds: 30 },
  internal.captureRequests.processPending
);

// Sync tags daily at midnight UTC
crons.daily(
  "sync-tags",
  { hourUTC: 0, minuteUTC: 0 },
  internal.actions.syncTags.syncTags
);

export default crons;
