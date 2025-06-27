"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import TVStatic from "@/components/tv-static";
import ChatForm from "@/components/chat/chat-form";
import { createSessionAction } from "./actions/vibekit";

function SessionCard({ session }: { session: Doc<"sessions"> }) {
  const router = useRouter();
  const deleteSession = useMutation(api.sessions.remove);

  const handleDeleteSession = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    await deleteSession({ id: session._id as Id<"sessions"> });
    router.push("/");
  };

  return (
    <Link passHref href={`/session/${session._id}`}>
      <div className="h-52 bg-background rounded-lg flex flex-col hover:bg-muted/80 transition-colors overflow-hidden border p-1 cursor-pointer group">
        {session.status === "RUNNING" || session.status === "CUSTOM" ? (
          <div className="bg-background overflow-hidden rounded-lg flex-1 border relative">
            <iframe
              src={session.tunnelUrl}
              className="w-full h-full origin-top-left"
              style={{
                width: "210%",
                height: "200%",
                transform: "scale(0.5)",
                transformOrigin: "top left",
                pointerEvents: "none",
              }}
              title={`Session ${session.name}`}
            />
          </div>
        ) : (
          <TVStatic label={session.status.replace(/_/g, " ")} size="md" />
        )}
        <div className="h-12 flex items-center px-2">
          <p className="text-sm truncate">{session.name}</p>
          <Button
            size="icon"
            variant="outline"
            className="ml-auto size-8"
            onClick={handleDeleteSession}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Link>
  );
}

export default function ClientPage() {
  const router = useRouter();
  const sessions = useQuery(api.sessions.list) ?? [];
  const createSession = useMutation(api.sessions.create);
  const addMessage = useMutation(api.messages.add);

  const handleChatSubmit = async (message: string) => {
    const sessionId = await createSession({
      name: "Untitled session",
      status: "IN_PROGRESS",
    });

    await createSessionAction(sessionId, message);

    await addMessage({
      sessionId,
      role: "user",
      content: message,
    });

    router.push(`/session/${sessionId}`);
  };

  return (
    <div className="flex flex-col gap-y-[100px]">
      <div className="max-w-2xl mx-auto w-full h-full flex flex-col gap-y-10 justify-center mt-[150px]">
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-3xl md:text-4xl font-bold text-center">
            What can I help you ship?
          </h1>
        </div>
        <ChatForm onSubmit={handleChatSubmit} />
      </div>
      {sessions.length > 0 && (
        <div className="flex flex-col gap-y-4 max-w-5xl w-full mx-auto">
          <p className="font-medium">Sessions</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {sessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
