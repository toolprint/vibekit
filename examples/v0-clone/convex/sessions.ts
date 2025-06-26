import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Queries
export const list = query({
  handler: async (ctx) => {
    const sessions = await ctx.db.query("sessions").order("desc").collect();

    // Get messages for each session
    const sessionsWithMessages = await Promise.all(
      sessions.map(async (session) => {
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_session", (q) => q.eq("sessionId", session._id))
          .order("asc")
          .collect();

        return {
          ...session,
          id: session._id,
          messages: messages.map((msg) => ({
            ...msg,
            id: msg._id,
            createdAt: new Date(msg.createdAt).toISOString(),
          })),
        };
      })
    );

    return sessionsWithMessages;
  },
});

export const getById = query({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session) return null;

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.id))
      .order("asc")
      .collect();

    return {
      ...session,
      id: session._id,
      messages: messages.map((msg) => ({
        ...msg,
        id: msg._id,
        createdAt: new Date(msg.createdAt).toISOString(),
      })),
    };
  },
});

// Mutations
export const create = mutation({
  args: {
    sessionId: v.optional(v.string()),
    name: v.string(),
    tunnelUrl: v.optional(v.string()),
    status: v.union(
      v.literal("IN_PROGRESS"),
      v.literal("CLONING_REPO"),
      v.literal("INSTALLING_DEPENDENCIES"),
      v.literal("STARTING_DEV_SERVER"),
      v.literal("CREATING_TUNNEL"),
      v.literal("RUNNING")
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("sessions", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("sessions"),
    sessionId: v.optional(v.string()),
    name: v.optional(v.string()),
    tunnelUrl: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("IN_PROGRESS"),
        v.literal("CLONING_REPO"),
        v.literal("INSTALLING_DEPENDENCIES"),
        v.literal("STARTING_DEV_SERVER"),
        v.literal("CREATING_TUNNEL"),
        v.literal("RUNNING")
      )
    ),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    // Delete all messages for this session first
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.id))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete the session
    await ctx.db.delete(args.id);
  },
});
