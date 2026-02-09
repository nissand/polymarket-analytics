import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";

export const checkDatabase = query({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const sessions = await ctx.db.query("authSessions").collect();
    const accounts = await ctx.db.query("authAccounts").collect();
    const refreshTokens = await ctx.db.query("authRefreshTokens").collect();
    const verifiers = await ctx.db.query("authVerifiers").collect();

    return {
      users: users.map(u => ({ id: u._id, email: u.email, name: u.name })),
      sessions: sessions.map(s => ({
        id: s._id,
        userId: s.userId,
        expirationTime: s.expirationTime,
      })),
      sessionCount: sessions.length,
      accountCount: accounts.length,
      refreshTokenCount: refreshTokens.length,
      verifierCount: verifiers.length,
      verifiers: verifiers.map(v => ({ id: v._id, createdAt: v._creationTime })),
    };
  },
});

export const checkEnv = action({
  handler: async () => {
    return {
      hasGoogleId: !!process.env.AUTH_GOOGLE_ID,
      hasGoogleSecret: !!process.env.AUTH_GOOGLE_SECRET,
      hasSiteUrl: !!process.env.SITE_URL,
      siteUrl: process.env.SITE_URL,
      googleIdPrefix: process.env.AUTH_GOOGLE_ID?.substring(0, 10) + "...",
    };
  },
});

export const clearVerifiers = mutation({
  handler: async (ctx) => {
    const verifiers = await ctx.db.query("authVerifiers").collect();
    for (const v of verifiers) {
      await ctx.db.delete(v._id);
    }
    return { deleted: verifiers.length };
  },
});

export const testCreateSession = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.db.query("users").first();
    if (!user) {
      return { error: "No user found" };
    }

    const expirationTime = Date.now() + 1000 * 60 * 60 * 24 * 30;
    const sessionId = await ctx.db.insert("authSessions", {
      userId: user._id,
      expirationTime,
    });

    return {
      success: true,
      sessionId,
      userId: user._id,
    };
  },
});

export const deleteTestSession = mutation({
  args: { sessionId: v.id("authSessions") },
  handler: async (ctx, { sessionId }) => {
    await ctx.db.delete(sessionId);
    return { deleted: true };
  },
});
