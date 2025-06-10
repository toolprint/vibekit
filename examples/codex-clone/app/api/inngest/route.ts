import { serve } from "inngest/next";
import { inngest, createTask } from "@/lib/inngest";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [createTask],
});
