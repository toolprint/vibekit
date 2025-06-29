"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "convex/react";
import { useSession } from "next-auth/react";

import { api } from "@/convex/_generated/api";

import ChatForm from "@/components/chat/chat-form";
import TemplatesSection from "@/components/templates-section";
import LoginDialog from "@/components/login-dialog";
import { createSessionAction } from "./actions/vibekit";

export default function ClientPage() {
  const { data: session } = useSession();
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const router = useRouter();
  const createSession = useMutation(api.sessions.create);
  const addMessage = useMutation(api.messages.add);

  const handleChatSubmit = async (message: string) => {
    if (!session) {
      setIsLoginDialogOpen(true);
      return;
    }

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
    <>
      <LoginDialog
        open={isLoginDialogOpen}
        onOpenChange={setIsLoginDialogOpen}
      />
      <div className="flex flex-col gap-y-[100px] h-screen">
        <div className="max-w-2xl mx-auto w-full flex flex-col gap-y-10 justify-center mt-[90px]">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-3xl md:text-4xl font-bold text-center">
              What can I help you ship?
            </h1>
          </div>
          <ChatForm onSubmit={handleChatSubmit} />
        </div>
        <div className="flex flex-col gap-y-8">
          <TemplatesSection />
        </div>
        <footer className="mt-auto py-8 text-center justify-end">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <a href="/sessions" className="hover:underline">
              Sessions
            </a>{" "}
            •{" "}
            <a href="/billing" className="hover:underline">
              Billing
            </a>{" "}
            •{" "}
            <a
              href="https://vibekit.sh/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              Privacy
            </a>{" "}
            •{" "}
            <a
              href="https://vibekit.sh/terms-of-service"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              Terms
            </a>{" "}
            •{" "}
            <a
              href="https://x.com/vibekit_sh"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              X
            </a>{" "}
            •{" "}
            <a
              href="https://github.com/superagent-ai/vibekit/templates/v0-clone"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              GitHub
            </a>
          </p>
        </footer>
      </div>
    </>
  );
}
