"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import Chat from "@/components/chat";
import Preview from "@/components/preview";
import { useSessionStore } from "@/stores/sessions";
import { createSession } from "@/app/actions/vibekit";

export default function ClientPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  // Use a selector to subscribe to session changes
  const session = useSessionStore((state) => state.getSessionById(sessionId));
  const createSessionInStore = useSessionStore((state) => state.createSession);
  const setCurrentSession = useSessionStore((state) => state.setCurrentSession);
  const updateSession = useSessionStore((state) => state.updateSession);

  useEffect(() => {
    const initializeSession = async () => {
      // Check if session exists but doesn't have a tunnelUrl
      if (!session?.tunnelUrl) {
        try {
          // Create session using vibekit
          const tunnelResponse = await createSession();

          // Extract tunnel URL from the response stdout
          // The tunnel URL should be in the stdout response
          const tunnelUrl = tunnelResponse.tunnels[0].public_url;

          // Update the session with the tunnel URL
          updateSession(sessionId, {
            tunnelUrl,
            sessionId: tunnelResponse.sandboxId,
          });
        } catch (error) {
          console.error("Failed to create session:", error);
        }
      }
    };

    initializeSession();
  }, [
    sessionId,
    session,
    createSessionInStore,
    setCurrentSession,
    updateSession,
    router,
  ]);

  return (
    <div className="grid grid-cols-4 flex-1 h-screen gap-x-2 pb-2">
      {session && <Chat session={session} />}
      <Preview />
    </div>
  );
}
