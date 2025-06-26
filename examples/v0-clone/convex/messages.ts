import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getBySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();

    return messages.map((msg) => ({
      ...msg,
      id: msg._id,
      createdAt: new Date(msg.createdAt).toISOString(),
    }));
  },
});

export const add = mutation({
  args: {
    sessionId: v.id("sessions"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    edits: v.optional(
      v.object({
        filePath: v.string(),
        oldString: v.string(),
        newString: v.string(),
      })
    ),
    todos: v.optional(
      v.array(
        v.object({
          id: v.string(),
          content: v.string(),
          status: v.string(),
          priority: v.string(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const messageId = await ctx.db.insert("messages", {
      ...args,
      createdAt: now,
    });

    // Update session's updatedAt timestamp
    await ctx.db.patch(args.sessionId, {
      updatedAt: now,
    });

    return messageId;
  },
});

export const remove = mutation({
  args: {
    id: v.id("messages"),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);

    // Update session's updatedAt timestamp
    await ctx.db.patch(args.sessionId, {
      updatedAt: Date.now(),
    });
  },
});

export const clearBySession = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Update session's updatedAt timestamp
    await ctx.db.patch(args.sessionId, {
      updatedAt: Date.now(),
    });
  },
});
