import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    userId: v.string(),
  }),
  sessions: defineTable({
    createdBy: v.optional(v.id("users")),
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
    createdAt: v.number(),
    updatedAt: v.number(),
  }),
  messages: defineTable({
    sessionId: v.id("sessions"),
    role: v.union(v.literal("user"), v.literal("assistant")),
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
    content: v.string(),
    createdAt: v.number(),
  }).index("by_session", ["sessionId"]),
});
