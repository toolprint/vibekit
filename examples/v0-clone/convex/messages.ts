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
    read: v.optional(
      v.object({
        filePath: v.string(),
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
    const messageId = await ctx.db.insert("messages", {
      ...args,
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
  },
});
