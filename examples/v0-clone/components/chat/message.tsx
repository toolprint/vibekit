"use client";
import { useCopyToClipboard } from "usehooks-ts";
import { useState } from "react";
import { useParams } from "next/navigation";
import { User, Copy, Trash2, Check } from "lucide-react";
import { useQuery, useMutation } from "convex/react";

import { Message as MessageType } from "@/types/sessions";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";

export default function Message({ message }: { message: MessageType }) {
  const params = useParams();
  const sessionId = params.id as string;
  const session = useQuery(api.sessions.getById, {
    id: sessionId as Id<"sessions">,
  });
  const deleteMessage = useMutation(api.messages.remove);
  const [, copy] = useCopyToClipboard();
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copy(message.content);
    if (success) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleDelete = async () => {
    if (session) {
      await deleteMessage({
        id: message.id as Id<"messages">,
        sessionId: session.id as Id<"sessions">,
      });
    }
  };

  if (message.role === "user") {
    return (
      <div className="group relative rounded-lg">
        <div className="flex items-start gap-x-2">
          <div className="size-8 rounded-lg bg-muted flex items-center justify-center">
            <User className="size-4" />
          </div>
          <div className="flex flex-col gap-y-1 flex-1">
            <p className="text-sm">{message.content}</p>
          </div>
        </div>
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="outline"
            size="icon"
            className="size-6"
            aria-label="Copied!"
            onClick={handleCopy}
          >
            {isCopied ? (
              <Check className="size-3 text-green-600" />
            ) : (
              <Copy className="size-3" />
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleDelete}
            className="size-6"
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative">
      <div className="mb-2">{message.content}</div>
    </div>
  );
}
