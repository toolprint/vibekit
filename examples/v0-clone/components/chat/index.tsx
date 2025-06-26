import ChatForm from "./chat-form";
import { Session } from "@/types/sessions";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ScrollArea } from "@/components/ui/scroll-area";
import Message from "./message";
import { TextShimmer } from "../ui/text-shimmer";

export default function Chat({ session }: { session: Session }) {
  const addMessage = useMutation(api.messages.add);

  const handleSubmit = async (message: string) => {
    await addMessage({
      sessionId: session.id as Id<"sessions">,
      role: "user",
      content: message,
    });
  };

  return (
    <div className="col-span-1 bg-background rounded-lg flex flex-col border p-2 relative">
      <ScrollArea className="h-full">
        <div className="flex flex-col gap-y-2 p-1">
          {session.messages.map((message) => (
            <Message key={message.id} message={message} />
          ))}
          {session.status !== "RUNNING" && (
            <div className="flex items-center gap-x-2 mt-2">
              <div className="size-3 bg-primary rounded-full animate-fast-pulse" />
              <TextShimmer className="text-sm">
                {session.status
                  .toLowerCase()
                  .replace(/_/g, " ")
                  .replace(/^./, (str) => str.toUpperCase())}
              </TextShimmer>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="absolute bottom-2 left-3 right-3 bg-background flex flex-col gap-y-2">
        <ChatForm onSubmit={handleSubmit} />
        <p className="text-xs text-muted-foreground text-center">
          vibe0 never makes mistakes. Like the other ones do.
        </p>
      </div>
    </div>
  );
}
