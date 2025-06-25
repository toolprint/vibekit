import ChatForm from "./chat-form";
import { Session } from "@/stores/sessions";
import { useSessionStore } from "@/stores/sessions";
import { ScrollArea } from "@/components/ui/scroll-area";
import Message from "./message";

export default function Chat({ session }: { session: Session }) {
  const { addMessage } = useSessionStore();

  const handleSubmit = (message: string) => {
    addMessage(session.id, {
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
