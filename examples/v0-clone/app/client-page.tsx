"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useSessionStore, Session } from "../stores/sessions";
import TVStatic from "@/components/tv-static";
import ChatForm from "@/components/chat/chat-form";

function SessionCard({ session }: { session: Session }) {
  const router = useRouter();
  const { deleteSession } = useSessionStore();

  const handleDeleteSession = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    deleteSession(session.id);
    router.push("/");
  };

  return (
    <Link passHref href={`/session/${session.id}`}>
      <div className="h-52 bg-background rounded-lg flex flex-col hover:bg-muted/80 transition-colors overflow-hidden border p-1 cursor-pointer group">
        {session.tunnelUrl ? (
          <div className="bg-background overflow-hidden rounded-lg flex-1 border relative">
            <iframe
              src={session.tunnelUrl}
              className="w-full h-full border rounded origin-top-left"
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
          <TVStatic label="NO SIGNAL" size="md" />
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
  const sessions = useSessionStore((state) => state.sessions);
  const { createSession } = useSessionStore();

  const handleChatSubmit = () => {
    const session = createSession({
      name: "Untitled session",
      messages: [],
    });
    router.push(`/session/${session.id}`);
  };

  return (
    <div className="flex flex-col gap-y-[100px]">
      <div className="max-w-xl mx-auto w-full h-full flex flex-col gap-y-10 justify-center mt-[150px]">
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-3xl md:text-4xl font-bold text-center">
            What can I help you ship?
          </h1>
        </div>
        <ChatForm onSubmit={handleChatSubmit} />
      </div>
      <div className="flex flex-col gap-y-4 max-w-5xl w-full mx-auto">
        <p className="font-medium">Sessions</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      </div>
    </div>
  );
}
